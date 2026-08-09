const DEFAULT_DATE_OPTIONS = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const DEFAULT_DATE_TIME_OPTIONS = {
  ...DEFAULT_DATE_OPTIONS,
  hour: 'numeric',
  minute: '2-digit',
};

export function parseApiDate(value) {
  if (value === null || value === undefined || value === '') return null;

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, fallback = 'No date') {
  const date = parseApiDate(value);
  if (!date) return fallback;

  try {
    return new Intl.DateTimeFormat(undefined, DEFAULT_DATE_OPTIONS).format(date);
  } catch {
    return fallback;
  }
}

export function formatDateTime(value, fallback = 'No deadline') {
  const date = parseApiDate(value);
  if (!date) return fallback;

  try {
    return new Intl.DateTimeFormat(undefined, DEFAULT_DATE_TIME_OPTIONS).format(date);
  } catch {
    return fallback;
  }
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

export function toDateTimeLocalValue(value) {
  const date = parseApiDate(value);
  if (!date) return '';

  return [
    date.getFullYear(),
    '-',
    padDatePart(date.getMonth() + 1),
    '-',
    padDatePart(date.getDate()),
    'T',
    padDatePart(date.getHours()),
    ':',
    padDatePart(date.getMinutes()),
  ].join('');
}

export function localDateTimeToIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  if (year < 1000) return null;

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  const componentsMatch = date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute
    && date.getSeconds() === second;

  return componentsMatch ? date.toISOString() : null;
}

export function isOverdue(deadline, status = 'pending', now = new Date()) {
  if (status === 'completed') return false;

  const deadlineDate = parseApiDate(deadline);
  const nowDate = parseApiDate(now);
  return Boolean(deadlineDate && nowDate && deadlineDate.getTime() < nowDate.getTime());
}

export function isUpcoming(
  deadline,
  status = 'pending',
  now = new Date(),
  numberOfDays = 7,
) {
  if (status === 'completed') return false;

  const deadlineDate = parseApiDate(deadline);
  const nowDate = parseApiDate(now);
  if (!deadlineDate || !nowDate) return false;

  const deadlineTime = deadlineDate.getTime();
  const nowTime = nowDate.getTime();
  const windowEnd = nowTime + numberOfDays * 24 * 60 * 60 * 1000;

  return deadlineTime >= nowTime && deadlineTime <= windowEnd;
}
