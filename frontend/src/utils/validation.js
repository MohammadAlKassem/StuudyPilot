import { localDateTimeToIso } from './date';

const PRIORITIES = ['low', 'medium', 'high'];
const TASK_STATUSES = ['pending', 'completed'];

function trimmedLength(value) {
  return typeof value === 'string' ? value.trim().length : 0;
}

export function validateCourse(values) {
  const errors = {};
  const titleLength = trimmedLength(values.title);

  if (!titleLength) errors.title = 'Course title is required.';
  else if (titleLength > 100) errors.title = 'Course title must not exceed 100 characters.';

  return errors;
}

export function validateTask(values, { isEditing = false } = {}) {
  const errors = {};
  const titleLength = trimmedLength(values.title);

  if (!titleLength) errors.title = 'Task title is required.';
  else if (titleLength > 150) errors.title = 'Task title must not exceed 150 characters.';

  if (typeof values.description !== 'string') {
    errors.description = 'Description must be text.';
  } else if (values.description.trim().length > 65535) {
    errors.description = 'Description must not exceed 65,535 characters.';
  }

  if (values.deadline && !localDateTimeToIso(values.deadline)) {
    errors.deadline = 'Enter a valid deadline.';
  }

  if (!PRIORITIES.includes(values.priority)) {
    errors.priority = 'Choose low, medium, or high priority.';
  }

  if (isEditing && !TASK_STATUSES.includes(values.status)) {
    errors.status = 'Choose pending or completed status.';
  }

  return errors;
}

export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}

