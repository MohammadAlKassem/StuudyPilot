import { apiRequest } from './api';

export async function getNotes({ signal } = {}) {
  const payload = await apiRequest('/notes', { signal });
  return payload?.data ?? [];
}

export async function getNote(id, { signal } = {}) {
  const payload = await apiRequest(`/notes/${id}`, { signal });
  return payload?.data;
}

export async function createNote(note, { signal } = {}) {
  const payload = await apiRequest('/notes', {
    method: 'POST',
    body: note,
    signal,
  });
  return payload?.data;
}

export async function updateNote(id, note, { signal } = {}) {
  const payload = await apiRequest(`/notes/${id}`, {
    method: 'PUT',
    body: note,
    signal,
  });
  return payload?.data;
}

export function deleteNote(id, { signal } = {}) {
  return apiRequest(`/notes/${id}`, { method: 'DELETE', signal });
}

