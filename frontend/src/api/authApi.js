import { apiRequest } from './api';

export async function loginUser(credentials, { signal } = {}) {
  const payload = await apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
    signal,
    auth: false,
  });

  return payload?.data;
}

export async function registerUser(account, { signal } = {}) {
  const payload = await apiRequest('/auth/register', {
    method: 'POST',
    body: account,
    signal,
    auth: false,
  });

  return payload?.data;
}

export async function getCurrentUser({ signal } = {}) {
  const payload = await apiRequest('/auth/me', { signal });
  return payload?.data;
}

