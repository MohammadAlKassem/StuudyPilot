import { apiRequest } from './api';

export async function getCourseTasks(courseId, { signal } = {}) {
  const payload = await apiRequest(`/courses/${courseId}/tasks`, { signal });
  return payload?.data ?? [];
}

export async function getTask(id, { signal } = {}) {
  const payload = await apiRequest(`/tasks/${id}`, { signal });
  return payload?.data;
}

export async function createTask(courseId, task, { signal } = {}) {
  const payload = await apiRequest(`/courses/${courseId}/tasks`, {
    method: 'POST',
    body: task,
    signal,
  });
  return payload?.data;
}

export async function updateTask(id, task, { signal } = {}) {
  const payload = await apiRequest(`/tasks/${id}`, {
    method: 'PUT',
    body: task,
    signal,
  });
  return payload?.data;
}

export function deleteTask(id, { signal } = {}) {
  return apiRequest(`/tasks/${id}`, { method: 'DELETE', signal });
}

