"""Breast Cancer Prediction System - Flask inference and account server
=====================================================

Serves YOUR notebook model (Breast_Cancer_Prediction.ipynb):

* `ml/model.pkl`    -> LogisticRegression, 31 cols (id + 30 measurements)
* `ml/scaler.pkl`   -> StandardScaler fit on the notebook train split
* `ml/features.json`  -> 31 feature names, in training order (id first)
* `ml/label_map.json` -> '0'->'B', '1'->'M'
* `ml/metrics.json`   -> held-out evaluation (same split as notebook)
* `ml/data.csv`       -> actual dataset (569 records)

POST /api/predict -> { "features": {"id": 842302, "radius_mean": 17.99, ...} }
POST /api/auth/register and /api/auth/login manage persistent user accounts.
DATABASE_URL selects PostgreSQL; BREASTCARE_DATABASE selects the local SQLite file.
Run: pip install -r server/requirements.txt + python server/app.py
"""

from __future__ import annotations

import json
import os
import pickle
import re
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Generator, LiteralString, cast, overload

import pandas as pd
import psycopg
from flask import Flask, jsonify, request, send_file, send_from_directory, session
from flask_cors import CORS
from psycopg.rows import dict_row
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent.parent
ML_DIR = ROOT / "ml"

MODEL_FILE = ML_DIR / "model.pkl"
SCALER_FILE = ML_DIR / "scaler.pkl"
FEATURES_FILE = ML_DIR / "features.json"
LABEL_MAP_FILE = ML_DIR / "label_map.json"
METRICS_FILE = ML_DIR / "metrics.json"
DATABASE_FILE = Path(
    os.environ.get("BREASTCARE_DATABASE", str(Path(__file__).with_name("users.sqlite3")))
)
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://") :]
APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production" or bool(os.environ.get("RENDER_SERVICE_ID"))
FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY")

if IS_PRODUCTION and not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL must be configured in production; PostgreSQL is required."
    )
if IS_PRODUCTION and not FLASK_SECRET_KEY:
    raise RuntimeError(
        "FLASK_SECRET_KEY must be configured in production to keep sessions secure."
    )

FULL_LABELS = {"B": "Benign", "M": "Malignant"}

app = Flask(__name__)
app.config.update(
    SECRET_KEY=FLASK_SECRET_KEY or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "").lower()
    in {"1", "true", "yes"},
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    DATABASE_URL=DATABASE_URL,
)
allowed_origins = os.environ.get(
    "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
CORS(app, origins=[origin.strip() for origin in allowed_origins], supports_credentials=True)


def _is_postgres() -> bool:
    return bool(app.config.get("DATABASE_URL"))


def _connect_database() -> sqlite3.Connection | psycopg.Connection[dict[str, Any]]:
    if _is_postgres():
        connection = psycopg.connect(app.config["DATABASE_URL"], connect_timeout=10)
        connection.row_factory = cast(Any, dict_row)
        return cast(psycopg.Connection[dict[str, Any]], connection)
    database_path = Path(app.config.get("DATABASE", DATABASE_FILE))
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def _database() -> Generator[
    sqlite3.Connection | psycopg.Connection[dict[str, Any]], None, None
]:
    connection = _connect_database()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


@overload
def _execute(
    connection: sqlite3.Connection,
    query: str,
    parameters: tuple = (),
) -> sqlite3.Cursor: ...


@overload
def _execute(
    connection: psycopg.Connection[dict[str, Any]],
    query: str,
    parameters: tuple = (),
) -> psycopg.Cursor[dict[str, Any]]: ...


def _execute(
    connection: sqlite3.Connection | psycopg.Connection[dict[str, Any]],
    query: str,
    parameters: tuple = (),
) -> sqlite3.Cursor | psycopg.Cursor[dict[str, Any]]:
    if isinstance(connection, psycopg.Connection):
        query = query.replace("?", "%s")
        return connection.execute(cast(LiteralString, query), parameters)
    return connection.execute(query, parameters)


def _initialize_database() -> None:
    with _database() as connection:
        if isinstance(connection, psycopg.Connection):
            # Serialize Gunicorn worker startup while idempotent DDL runs.
            _execute(
                connection,
                "SELECT pg_advisory_xact_lock(477867884660)",
            )
            _execute(
                connection,
                """
                CREATE TABLE IF NOT EXISTS users (
                    id BIGSERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """,
            )
            _execute(
                connection,
                """
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL,
                    inputs_json TEXT NOT NULL,
                    prediction_json TEXT NOT NULL,
                    probability_json TEXT
                )
                """,
            )
        else:
            _execute(
                connection,
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """,
            )
            _execute(
                connection,
                """
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    inputs_json TEXT NOT NULL,
                    prediction_json TEXT NOT NULL,
                    probability_json TEXT
                )
                """,
            )


def _user_payload(user) -> dict[str, int | str]:
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


def _login_required(handler: Callable):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Authentication required"}), 401
        return handler(*args, **kwargs)

    return wrapped


try:
    _initialize_database()
except (sqlite3.Error, psycopg.Error):
    if _is_postgres():
        raise RuntimeError(
            "Could not initialize PostgreSQL tables. Check DATABASE_URL and database availability."
        ) from None
    raise RuntimeError("Could not initialize the local SQLite database.") from None


@app.errorhandler(psycopg.Error)
@app.errorhandler(sqlite3.Error)
def handle_database_error(error: Exception):
    app.logger.error("Database operation failed (%s)", type(error).__name__)
    return jsonify({"error": "Database temporarily unavailable. Please try again."}), 503

# Notebook model: bare LogisticRegression (31 feats incl. id) trained on
# StandardScaler output — scaler.pkl is REQUIRED to score raw values.
if not MODEL_FILE.exists():
    raise SystemExit(f"Model not found: {MODEL_FILE}")
if not SCALER_FILE.exists():
    raise SystemExit(f"Scaler not found: {SCALER_FILE} (raw values need scaling)")

with open(MODEL_FILE, "rb") as fh:
    model = pickle.load(fh)
with open(SCALER_FILE, "rb") as fh:
    scaler = pickle.load(fh)

FEATURES: list[str] = json.loads(FEATURES_FILE.read_text())
LABEL_MAP: dict[str, str] = json.loads(LABEL_MAP_FILE.read_text())  # {'0': 'B', '1': 'M'}
METRICS = json.loads(METRICS_FILE.read_text())

# Guard: served contract must match the fitted model (31 feats, id first).
_n_expected = int(getattr(model, "n_features_in_", len(FEATURES)))
if _n_expected != len(FEATURES):
    raise SystemExit(
        f"{MODEL_FILE.name} expects {_n_expected} features but features.json "
        f"lists {len(FEATURES)}."
    )

print(f"Loaded model: {MODEL_FILE.name} ({type(model).__name__}) + {SCALER_FILE.name}")


def _predict_df(X: "pd.DataFrame"):
    """Scale exactly like the notebook, then predict."""
    Xs = scaler.transform(X)
    proba = model.predict_proba(Xs) if hasattr(model, "predict_proba") else None
    return model.predict(Xs), proba


def _decode(raw) -> dict:
    """Map the model's raw output back to the original diagnosis label.

    Handles: 0/1 ints (LabelEncoder B=0, M=1), 'B'/'M' strings,
    and 0/1 stored as strings.
    """
    if isinstance(raw, str):
        code = raw.strip().upper()
        if code.startswith("B"):
            code = "B"
        elif code.startswith("M"):
            code = "M"
        else:
            code = LABEL_MAP.get(str(raw), LABEL_MAP.get("1" if str(raw) == "1" else "0", "B"))
        return {"code": code, "label": FULL_LABELS[code]}
    code_int = int(raw)
    code = LABEL_MAP.get(str(code_int), "M" if code_int == 1 else "B")
    return {"code": code, "label": FULL_LABELS[code]}


@app.get("/")
def index():
    frontend = ROOT / "dist" / "index.html"
    if frontend.exists():
        return send_file(frontend)
    return jsonify(
        {
            "app": "Breast Cancer Prediction System — inference server",
            "status": "ok",
            "model": METRICS["model"]["algorithm"] + " + " + METRICS["model"]["scaler"],
            "pipeline": f"{MODEL_FILE.name} + {SCALER_FILE.name}",
            "features_expected": len(FEATURES),
            "frontend": "http://127.0.0.1:5173",
            "endpoints": {
                "health": "GET /api/health",
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login",
                "logout": "POST /api/auth/logout",
                "current_user": "GET /api/auth/me",
                "history": "GET /api/history",
                "delete_history": "DELETE /api/history or /api/history/<id>",
                "metrics": "GET /api/metrics",
                "predict": "POST /api/predict  {\"features\": {\"id\": 842302, ... (31 values)}}",
            },
        }
    )


@app.get("/assets/<path:asset_path>")
def frontend_asset(asset_path: str):
    return send_from_directory(ROOT / "dist" / "assets", asset_path)


@app.get("/api/health")
def health():
    with _database() as connection:
        _execute(connection, "SELECT 1")
    return jsonify(
        {
            "status": "ok",
            "database": "postgresql" if _is_postgres() else "sqlite",
            "model": METRICS["model"]["algorithm"] + " + " + METRICS["model"]["scaler"],
            "pipeline": f"{MODEL_FILE.name} + {SCALER_FILE.name}",
            "features_expected": len(FEATURES),
            "label_map": LABEL_MAP,
        }
    )


@app.post("/api/auth/register")
def register():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400
    name = payload.get("name")
    email = payload.get("email")
    password = payload.get("password")

    if (
        not isinstance(name, str)
        or not isinstance(email, str)
        or not isinstance(password, str)
    ):
        return jsonify({"error": "Name, email, and password are required"}), 400

    name = name.strip()
    email = email.strip().lower()
    if not name or len(name) > 100:
        return jsonify({"error": "Name must be between 1 and 100 characters"}), 422
    if len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "Enter a valid email address"}), 422
    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "Password must be between 8 and 128 characters"}), 422

    try:
        with _database() as connection:
            if isinstance(connection, psycopg.Connection):
                user = _execute(
                    connection,
                    """
                    INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)
                    RETURNING id, name, email
                    """,
                    (name, email, generate_password_hash(password)),
                ).fetchone()
            else:
                cursor = _execute(
                    connection,
                    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                    (name, email, generate_password_hash(password)),
                )
                user = _execute(
                    connection,
                    "SELECT id, name, email FROM users WHERE id = ?",
                    (cursor.lastrowid,),
                ).fetchone()
    except (sqlite3.IntegrityError, psycopg.IntegrityError):
        return jsonify({"error": "An account with this email already exists"}), 409

    if user is None:
        raise RuntimeError("Account creation did not return the new user record.")
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    return jsonify({"user": _user_payload(user)}), 201


@app.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400
    email = payload.get("email")
    password = payload.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    with _database() as connection:
        user = _execute(
            connection,
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Email or password is incorrect"}), 401

    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    return jsonify({"user": _user_payload(user)})


@app.get("/api/auth/me")
def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    with _database() as connection:
        user = _execute(
            connection,
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if user is None:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401
    return jsonify({"user": _user_payload(user)})


@app.post("/api/auth/logout")
def logout():
    if not request.is_json:
        return jsonify({"error": "Expected a JSON request"}), 400
    session.clear()
    return jsonify({"status": "ok"})


@app.get("/api/metrics")
@_login_required
def metrics():
    """Model evaluation, computed at training time on the held-out test split."""
    return jsonify(
        {
            "evaluation": METRICS["evaluation"],
            "dataset": METRICS["dataset"],
            "split": METRICS["split"],
            "model": METRICS["model"],
            "supports_probability": hasattr(model, "predict_proba"),
        }
    )


@app.post("/api/predict")
@_login_required
def predict():
    payload = request.get_json(silent=True) or {}
    features = payload.get("features")

    if not isinstance(features, dict):
        return (
            jsonify(
                {
                    "error": "Request body must be JSON: {\"features\": {<name>: <number>, ...}}",
                    "expected_features": FEATURES,
                }
            ),
            400,
        )

    missing = [f for f in FEATURES if f not in features]
    if missing:
        return jsonify({"error": "Missing required features", "missing": missing}), 400

    row: dict[str, float] = {}
    for name in FEATURES:  # enforce the exact training order
        raw = features[name]
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return jsonify({"error": f"Feature '{name}' must be numeric", "received": raw}), 422
        if value != value or value in (float("inf"), float("-inf")):
            return jsonify({"error": f"Feature '{name}' must be a finite number"}), 422
        row[name] = value

    X = pd.DataFrame([row], columns=FEATURES)

    preds, proba = _predict_df(X)
    raw_pred = preds[0]
    try:
        encoded = int(raw_pred)
    except (TypeError, ValueError):
        encoded = 1 if str(raw_pred).strip().upper().startswith("M") else 0
    decoded = _decode(raw_pred)

    response = {
        "prediction": {
            "encoded": encoded,
            "code": decoded["code"],      # 'B' or 'M'
            "label": decoded["label"],    # 'Benign' or 'Malignant'
        },
        "supports_probability": proba is not None,
    }

    if proba is not None:
        proba_row = proba[0]
        classes = list(model.classes_)
        by_code: dict[str, float] = {}
        for i, c in enumerate(classes):
            key = str(c).strip()
            if key in ("0", "1"):
                by_code[LABEL_MAP.get(key, key)] = float(proba_row[i])
            elif key.upper().startswith("B"):
                by_code["B"] = float(proba_row[i])
            elif key.upper().startswith("M"):
                by_code["M"] = float(proba_row[i])
            else:
                by_code[key] = float(proba_row[i])
        response["probability"] = {
            "benign": by_code.get("B"),
            "malignant": by_code.get("M"),
        }

    prediction_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    probability = response.get("probability")
    with _database() as connection:
        _execute(
            connection,
            """
            INSERT INTO predictions
                (id, user_id, created_at, inputs_json, prediction_json, probability_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                prediction_id,
                session["user_id"],
                created_at,
                json.dumps(row),
                json.dumps(response["prediction"]),
                json.dumps(probability) if probability is not None else None,
            ),
        )

    return jsonify(response)


@app.get("/api/history")
@_login_required
def get_history():
    with _database() as connection:
        rows = _execute(
            connection,
            """
            SELECT id, created_at, inputs_json, prediction_json, probability_json
            FROM predictions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (session["user_id"],),
        ).fetchall()
    return jsonify(
        {
            "entries": [
                {
                    "id": row["id"],
                    "at": row["created_at"].isoformat()
                    if isinstance(row["created_at"], datetime)
                    else row["created_at"],
                    "inputs": json.loads(row["inputs_json"]),
                    "prediction": json.loads(row["prediction_json"]),
                    "probability": json.loads(row["probability_json"])
                    if row["probability_json"]
                    else None,
                }
                for row in rows
            ]
        }
    )


@app.delete("/api/history")
@_login_required
def clear_history():
    with _database() as connection:
        _execute(
            connection,
            "DELETE FROM predictions WHERE user_id = ?",
            (session["user_id"],),
        )
    return jsonify({"status": "ok"})


@app.delete("/api/history/<prediction_id>")
@_login_required
def delete_history_entry(prediction_id: str):
    with _database() as connection:
        cursor = _execute(
            connection,
            "DELETE FROM predictions WHERE id = ? AND user_id = ?",
            (prediction_id, session["user_id"]),
        )
    if cursor.rowcount == 0:
        return jsonify({"error": "Prediction record not found"}), 404
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=not IS_PRODUCTION)
