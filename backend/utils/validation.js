const AppError = require('./AppError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value, field, { min = 1, max = Infinity } = {}) {
  if (typeof value !== 'string') {
    throw new AppError(`${field} is required`, 400, 'VALIDATION_ERROR');
  }

  const trimmed = value.trim();
  if (trimmed.length < min) {
    const message = min > 1
      ? `${field} must be at least ${min} characters long`
      : `${field} is required`;
    throw new AppError(message, 400, 'VALIDATION_ERROR');
  }
  if (trimmed.length > max) {
    throw new AppError(`${field} must not exceed ${max} characters`, 400, 'VALIDATION_ERROR');
  }

  return trimmed;
}

function optionalString(value, field, { max = Infinity, allowNull = true } = {}) {
  if (value === undefined) return undefined;
  if (value === null && allowNull) return null;
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be a string`, 400, 'VALIDATION_ERROR');
  }

  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new AppError(`${field} must not exceed ${max} characters`, 400, 'VALIDATION_ERROR');
  }
  return trimmed;
}

function normalizeEmail(value) {
  const email = requiredString(value, 'Email', { max: 150 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError('Please provide a valid email address', 400, 'VALIDATION_ERROR');
  }
  return email;
}

function enumValue(value, field, allowed, { defaultValue, optional = false } = {}) {
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    if (optional) return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new AppError(`${field} must be one of: ${allowed.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  return value;
}

function positiveIntegerId(value, field = 'ID') {
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    throw new AppError(`${field} must be a positive integer`, 400, 'VALIDATION_ERROR');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(`${field} must be a positive integer`, 400, 'VALIDATION_ERROR');
  }
  return id;
}

function optionalDate(value, field = 'Deadline') {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new AppError(`${field} must be a valid date`, 400, 'VALIDATION_ERROR');
    }
    return value;
  }
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be a valid date`, 400, 'VALIDATION_ERROR');
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?$/,
  );
  if (!isoMatch) {
    throw new AppError(`${field} must be a valid ISO date`, 400, 'VALIDATION_ERROR');
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = isoMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText === undefined ? 0 : Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;

  if (
    year < 1000
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth
    || hour > 23
    || minute > 59
    || second > 59
  ) {
    throw new AppError(`${field} must be a valid date`, 400, 'VALIDATION_ERROR');
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} must be a valid date`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function integerInRange(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError(`${field} must be an integer between ${min} and ${max}`, 400, 'VALIDATION_ERROR');
  }
  return value;
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') {
    throw new AppError(`${field} must be a boolean`, 400, 'VALIDATION_ERROR');
  }
  return value;
}

function ensureOnlyFields(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a JSON object', 400, 'VALIDATION_ERROR');
  }
  const unexpected = Object.keys(body).filter((key) => !allowedFields.includes(key));
  if (unexpected.length) {
    throw new AppError(`Unexpected field${unexpected.length > 1 ? 's' : ''}: ${unexpected.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
}

module.exports = {
  EMAIL_PATTERN,
  requiredString,
  optionalString,
  normalizeEmail,
  enumValue,
  positiveIntegerId,
  optionalDate,
  integerInRange,
  booleanValue,
  ensureOnlyFields,
};
