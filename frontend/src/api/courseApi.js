import { apiRequest } from './api';

export async function getCourses({ signal } = {}) {
  const payload = await apiRequest('/courses', { signal });
  return payload?.data ?? [];
}

export async function getCourse(id, { signal } = {}) {
  const payload = await apiRequest(`/courses/${id}`, { signal });
  return payload?.data;
}

export async function createCourse(course, { signal } = {}) {
  const payload = await apiRequest('/courses', {
    method: 'POST',
    body: course,
    signal,
  });
  return payload?.data;
}

export async function updateCourse(id, course, { signal } = {}) {
  const payload = await apiRequest(`/courses/${id}`, {
    method: 'PUT',
    body: course,
    signal,
  });
  return payload?.data;
}

export function deleteCourse(id, { signal } = {}) {
  return apiRequest(`/courses/${id}`, { method: 'DELETE', signal });
}

