import { apiRequest } from './api';

export async function getStudyPlans({ signal } = {}) {
  const payload = await apiRequest('/study-plans', { signal });
  return payload?.data ?? [];
}

export async function getStudyPlan(id, { signal } = {}) {
  const payload = await apiRequest(`/study-plans/${id}`, { signal });
  return payload?.data;
}

export async function generateStudyPlan(input, { signal } = {}) {
  const payload = await apiRequest('/study-plans/generate', {
    method: 'POST',
    body: input,
    signal,
  });
  return payload?.data;
}

export function deleteStudyPlan(id, { signal } = {}) {
  return apiRequest(`/study-plans/${id}`, { method: 'DELETE', signal });
}

