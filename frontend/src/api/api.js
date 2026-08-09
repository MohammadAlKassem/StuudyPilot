const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (configuredApiUrl || 'http://localhost:5000/api').replace(
  /\/+$/,
  '',
);

export const AUTH_TOKEN_KEY = 'studypilot.auth.token';
export const SESSION_INVALID_EVENT = 'studypilot:session-invalid';

let lastInvalidatedToken = null;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details = null, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    if (cause) this.cause = cause;
  }
}

export function getStoredToken() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  if (typeof token !== 'string' || !token) {
    throw new TypeError('A valid authentication token is required');
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  lastInvalidatedToken = null;
}

export function clearStoredToken() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // The in-memory session is still cleared by AuthContext.
  }
}

function notifyInvalidSession(token, error) {
  if (!token || lastInvalidatedToken === token || getStoredToken() !== token) return;

  lastInvalidatedToken = token;
  clearStoredToken();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SESSION_INVALID_EVENT, {
        detail: {
          code: error.code,
          message: error.message,
        },
      }),
    );
  }
}

async function readResponse(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function requestUrl(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new TypeError('An API endpoint is required');
  }

  return `${API_BASE_URL}/${endpoint.replace(/^\/+/, '')}`;
}

function errorMessageFor(response, payload) {
  if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
    return payload.message;
  }

  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return response.statusText || `Request failed with status ${response.status}`;
}

export async function apiRequest(
  endpoint,
  {
    method = 'GET',
    body,
    signal,
    headers: suppliedHeaders,
    auth = true,
  } = {},
) {
  const headers = new Headers(suppliedHeaders);
  headers.set('Accept', 'application/json');

  const token = auth ? getStoredToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const hasBody = body !== undefined;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(requestUrl(endpoint), {
      method: method.toUpperCase(),
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;

    throw new ApiError(
      'Unable to connect to StudyPilot. Check your connection and try again.',
      { code: 'NETWORK_ERROR', cause: error },
    );
  }

  const payload = await readResponse(response);
  const failedEnvelope = payload && typeof payload === 'object' && payload.success === false;

  if (!response.ok || failedEnvelope) {
    const apiError = new ApiError(errorMessageFor(response, payload), {
      status: response.status,
      code:
        payload && typeof payload === 'object' && typeof payload.code === 'string'
          ? payload.code
          : 'REQUEST_FAILED',
      details: payload,
    });

    if (token && (response.status === 401 || apiError.code === 'ACCOUNT_INACTIVE')) {
      notifyInvalidSession(token, apiError);
    }

    throw apiError;
  }

  return payload;
}
