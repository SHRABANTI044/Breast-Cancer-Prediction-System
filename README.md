# Breast Cancer Prediction System (frontend + inference)

An **educational prototype** for breast-tumour classification (Benign / Malignant)
serving **your notebook model** (`Breast_Cancer_Prediction.ipynb`) over Flask.
**Not a clinical diagnostic system.**

## Architecture

```
ml/                              # your files — notebook, data, model, scaler
  Breast_Cancer_Prediction.ipynb # your training notebook (kept for reference)
  data.csv                       # actual dataset: 569 records · id + diagnosis + 30 features + Unnamed: 32 (empty)
  model.pkl                      # YOUR served model: LogisticRegression (31 feats incl. id)
  scaler.pkl                     # StandardScaler fit on the notebook train split (test_size=0.2, random_state=42)
  features.json                  # 31 feature names in training order (id first)
  label_map.json                 # 0 -> B, 1 -> M
  metrics.json                   # held-out evaluation recomputed on the notebook split
server/
  app.py                         # Flask · PostgreSQL/SQLite-backed auth, history + inference
  requirements.txt               # Flask and inference dependencies
src/                             # React dashboard — four views: Home · Predict · History · About
```

> **Faithful to your notebook:** `X = breast.drop('diagnosis')` keeps **`id` +
> 30 measurements (31 columns)**; `StandardScaler` is fit on the train split and
> applied before `LogisticRegression`. The server does exactly the same —
> `scaler.transform` then `model.predict` — and the Predict form sends all 31
> raw values (`id` first). `Unnamed: 32` (all-NaN) is the only dropped column.

## Run it

Use Python 3.11 for the backend, matching the Docker runtime and the scikit-learn
1.6.1 version used to save the model artifacts.

```bash
# 1. API server (model is already trained — just serve it)
pip install -r server/requirements.txt
python server/app.py          # Flask on http://127.0.0.1:5000

# 2. React dashboard (another terminal)
npm install
npm run dev                   # open the printed URL
```

In local development the Vite dev server proxies `/api` to Flask automatically. Set
`VITE_API_URL` only when using a compatible same-origin API setup.

### Accounts, history, and database

Sign-up saves the user's name, normalized email, and a Werkzeug password hash in PostgreSQL on
Render. The app reads the connection string from `DATABASE_URL`; production startup fails clearly
if it is missing. `FLASK_SECRET_KEY` is also required in production so signed-in sessions stay
valid across restarts. Passwords are never stored as plain text. Successful predictions and their
input values are saved to the active database (PostgreSQL on Render, SQLite in local development)
and associated with the signed-in user. History can be loaded, deleted, and cleared from the
account. Sign-in checks the stored hash and creates an HTTP-only, 12-hour server session. The
dashboard, model metrics, predictions, and history require authentication.

For local development, the Flask API uses `server/users.sqlite3` unless `DATABASE_URL` is set.
SQLite is not used as a production fallback. PostgreSQL tables are created idempotently when the
Flask application starts; no page request is needed to initialize them.

The existing `server/users.sqlite3` file is local-only and excluded from Git. It currently contains
2 user records and 5 prediction records. Those records are not copied automatically to the Render
database. If they must be retained, first make a separate backup of the SQLite file, then use a
one-time migration that maps each SQLite user ID to its PostgreSQL user ID (preserving existing
password hashes), copies the corresponding prediction rows with those mapped IDs, and inserts
without overwriting existing PostgreSQL rows. Verify account and history counts in PostgreSQL
before treating the migration as complete; do not upload the SQLite file to the public repository.

#### Deploy to Render

The included `render.yaml` and `Dockerfile` configure a single Render web service to serve the
built frontend and Flask API from the same origin, and provision a separate hosted PostgreSQL
database. Push the project to a Git repository, then in Render choose **New → Blueprint** and
select that repository. Render reads the blueprint, connects the service to PostgreSQL through
`DATABASE_URL`, generates `FLASK_SECRET_KEY`, and enables secure session cookies. The database is
separate from the web service's deployment filesystem, so user accounts and prediction history
persist across app redeploys. The configured PostgreSQL plan is `basic-256mb` and may incur
charges; confirm current Render pricing before creating it.

The database connection string is a secret: keep it in Render environment settings and do not
commit it to source control. The Render configuration sets `APP_ENV=production`; it generates
`FLASK_SECRET_KEY` and sets secure session cookies. For other production deployments, set
`APP_ENV=production`, `DATABASE_URL` to a PostgreSQL connection string, a stable random
`FLASK_SECRET_KEY`, and `SESSION_COOKIE_SECURE=true` over HTTPS. For local use, keep
`APP_ENV=development` (the default) and use SQLite or set a private local `DATABASE_URL`.

### API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | liveness + loaded-artifact info |
| `POST /api/auth/register` | create a user account and start a session |
| `POST /api/auth/login` | verify credentials and start a session |
| `GET /api/auth/me` | return the signed-in user's profile |
| `POST /api/auth/logout` | clear the current session |
| `GET /api/history` (authenticated) | get the signed-in user's latest 100 predictions |
| `DELETE /api/history` (authenticated) | clear the signed-in user's prediction history |
| `DELETE /api/history/<id>` (authenticated) | delete one of the signed-in user's predictions |
| `GET /api/metrics` (authenticated) | the training-time evaluation (accuracy, precision, recall, F1, confusion matrix) |
| `POST /api/predict` (authenticated) | `{"features": {"id": 842302, "radius_mean": 17.99, …all 31 features…}}` → code `B`/`M`, label, `predict_proba` probabilities |

Behaviour guarantees: predictions come only from the loaded pipeline; database history contains
only requests that received a genuine prediction; if the server is offline the UI reports it
instead of fabricating a result. Existing local SQLite accounts and history are not copied to
the separately provisioned Render database automatically.

The Predict form starts empty so dataset median placeholders are not submitted as patient
measurements. Enter all 31 feature values to run an inference; the labeled dataset examples are
available only to verify the model pipeline and are not patient data.

### Replacing the model

Drop your own trained `*.pkl` / `*.joblib` into `ml/` alongside matching
`features.json`, `label_map.json`, `metrics.json` — the server loads
`model_pipeline.joblib` first, otherwise the first `*.pkl` it finds.
