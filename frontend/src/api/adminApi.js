import { apiRequest } from './api';

export async function getAdminStats({ signal } = {}) {
  const payload = await apiRequest('/admin/stats', { signal });
  return payload?.data;
}

export async function getAdminUsers(options = {}) {
  const normalizedOptions = typeof options === 'string' ? { status: options } : options;
  const { status, signal } = normalizedOptions;
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const payload = await apiRequest(`/admin/users${query}`, { signal });
  return payload?.data ?? [];
}

export async function updateUserStatus(id, activeOrBody, { signal } = {}) {
  const body = typeof activeOrBody === 'boolean'
    ? { isActive: activeOrBody }
    : activeOrBody;
  const payload = await apiRequest(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body,
    signal,
  });
  return payload?.data;
}

export async function getAiLogs({ signal } = {}) {
  const payload = await apiRequest('/admin/ai-logs', { signal });
  return payload?.data ?? [];
}

