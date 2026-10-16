import type { ApiMetrics, AuthUser, HistoryEntry, PredictResponse } from "./types";

/**
 * The UI talks to the REAL Flask inference server (server/app.py), which loads
 * your notebook model (ml/model.pkl + ml/scaler.pkl) and enforces the exact
 * training feature contract. If the server is unreachable the UI reports it
 * honestly — it never fabricates predictions, probabilities or metrics.
 */
const configuredApiBase =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ?? "";
export const API_BASE = configuredApiBase.replace(/\/+$/, "");

const JSON_HEADERS = { "Content-Type": "application/json" };

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { credentials: "include", ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/health`, undefined, 3500);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchMetrics(): Promise<ApiMetrics> {
  const res = await fetchWithTimeout(`${API_BASE}/api/metrics`, undefined, 5000);
  if (!res.ok) throw new Error(`Metrics request failed (${res.status})`);
  return res.json();
}

export class ApiError extends Error {
  status: number;
  missing?: string[];
  constructor(message: string, status: number, missing?: string[]) {
    super(message);
    this.missing = missing;
    this.status = status;
  }
}

async function authRequest(
  endpoint: string,
  payload?: Record<string, string>
): Promise<{ user?: AuthUser }> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE}/api/auth/${endpoint}`,
      payload
        ? { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload) }
        : undefined,
      8000
    );
  } catch {
    throw new ApiError("The authentication server could not be reached. Start the Flask server and try again.", 0);
  }
  const responseText = await response.text();
  let body: { error?: string; user?: AuthUser } = {};
  try {
    body = JSON.parse(responseText) as typeof body;
  } catch {
    if (!response.ok && response.status >= 500) {
      throw new ApiError(
        "The local API returned a server error. Start Flask with `python server/app.py` and check its terminal output.",
        response.status
      );
    }
  }
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Authentication failed (${response.status})`, response.status);
  }
  return body;
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const body = await authRequest("register", { name, email, password });
  if (!body.user) throw new ApiError("The server returned an invalid account response.", 500);
  return body.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const body = await authRequest("login", { email, password });
  if (!body.user) throw new ApiError("The server returned an invalid account response.", 500);
  return body.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const body = await authRequest("me");
    if (!body.user) throw new ApiError("The server returned an invalid account response.", 500);
    return body.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function logout(): Promise<void> {
  await authRequest("logout", {});
}

async function historyRequest(
  method: "GET" | "DELETE",
  id?: string
): Promise<{ entries?: HistoryEntry[] }> {
  const endpoint = id ? `/api/history/${encodeURIComponent(id)}` : "/api/history";
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE}${endpoint}`,
      { method, headers: JSON_HEADERS },
      8000
    );
  } catch {
    throw new ApiError("The server could not be reached while loading prediction history.", 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body?.error ?? `History request failed (${response.status})`, response.status);
  }
  return body as { entries?: HistoryEntry[] };
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const body = await historyRequest("GET");
  if (!Array.isArray(body.entries)) throw new ApiError("The server returned invalid prediction history.", 500);
  return body.entries;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await historyRequest("DELETE", id);
}

export async function clearHistory(): Promise<void> {
  await historyRequest("DELETE");
}

export interface PredictResult extends PredictResponse {
  /** Wall-clock time of the HTTP response — recorded for history. */
  receivedAt: string;
}

export async function predict(features: Record<string, number>): Promise<PredictResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_BASE}/api/predict`,
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ features }) },
      8000
    );
  } catch (err) {
    throw new ApiError(
      "The Flask server could not be reached. Start it with `python server/app.py` (port 5000) and try again.",
      0
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Prediction failed (${res.status})`, res.status, body?.missing);
  }
  return { ...(body as PredictResponse), receivedAt: new Date().toISOString() };
}
