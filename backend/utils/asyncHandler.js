// Express 5 forwards rejected async route promises automatically. This helper is
// kept for places where an explicit wrapper makes intent easier to read.
const asyncHandler = (handler) => (req, res, next) => {
  return Promise.resolve(handler(req, res, next)).catch(next);
};

module.exports = asyncHandler;
