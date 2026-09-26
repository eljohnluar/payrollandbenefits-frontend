const TOKEN_KEY = 'payroll.jwt';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

/** Notify the app when the server rejects the token (401) — used for idle/session handling. */
const authLostListeners = new Set();
export const onAuthLost = (fn) => {
  authLostListeners.add(fn);
  return () => authLostListeners.delete(fn);
};
const notifyAuthLost = () => authLostListeners.forEach((fn) => fn());

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      notifyAuthLost();
    }
    throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status);
  }
  return payload;
}

/** Fetches a binary resource (e.g. a payslip PDF) with the auth header, returning an object URL. */
async function fetchObjectUrl(path) {
  const headers = { Accept: 'application/pdf' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, { headers });
  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** POSTs a JSON body (e.g. a password) and reads back a binary PDF as an object URL. */
async function postObjectUrl(path, body) {
  const headers = { Accept: 'application/pdf', 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    try { message = JSON.parse(text)?.error || message; } catch { /* non-JSON error body */ }
    throw new ApiError(message, response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  del: (path) => request('DELETE', path),
  objectUrl: (path) => fetchObjectUrl(path),
  postObjectUrl: (path, body) => postObjectUrl(path, body),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  register: (payload) => request('POST', '/api/auth/register', payload),
  health: () => request('GET', '/api/health'),
};
