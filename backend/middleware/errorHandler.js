const AppError = require('../utils/AppError');

function getSqlServerErrorNumber(error) {
  const errors = [
    error,
    error && error.originalError,
    error && error.cause,
    ...(Array.isArray(error && error.precedingErrors) ? error.precedingErrors : []),
  ];
  const numbers = [];

  for (const currentError of errors) {
    const candidates = [
      currentError && currentError.number,
      currentError && currentError.info && currentError.info.number,
    ];

    for (const candidate of candidates) {
      const number = Number(candidate);
      if (Number.isInteger(number)) numbers.push(number);
    }
  }

  return numbers.find((number) => [2601, 2627, 547].includes(number))
    ?? numbers[0]
    ?? null;
}

function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (error && error.type === 'entity.too.large') {
    return new AppError('Request body is too large', 413, 'PAYLOAD_TOO_LARGE');
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return new AppError('Request body contains invalid JSON', 400, 'INVALID_JSON');
  }

  const sqlErrorNumber = getSqlServerErrorNumber(error);

  if ([2601, 2627].includes(sqlErrorNumber)) {
    return new AppError(
      'A record with that unique value already exists',
      409,
      'DUPLICATE_VALUE',
    );
  }

  if (sqlErrorNumber === 547) {
    return new AppError(
      'The request violates a database relationship or value constraint',
      400,
      'INVALID_RELATION',
    );
  }

  return new AppError('An unexpected server error occurred', 500, 'INTERNAL_ERROR');
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const normalized = normalizeError(error);

  if (normalized.statusCode >= 500 && !(error instanceof AppError && error.isOperational)) {
    const safeDiagnostic = error && error.code ? ` (${error.code})` : '';
    console.error(`Unexpected server error${safeDiagnostic}`);
  }

  const body = {
    success: false,
    message: normalized.message,
  };

  if (normalized.code) body.code = normalized.code;

  return res.status(normalized.statusCode).json(body);
}

module.exports = errorHandler;
module.exports.normalizeError = normalizeError;
module.exports.getSqlServerErrorNumber = getSqlServerErrorNumber;
