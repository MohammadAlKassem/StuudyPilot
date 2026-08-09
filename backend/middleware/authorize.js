const AppError = require('../utils/AppError');

function authorize(...allowedRoles) {
  const roles = allowedRoles.flat();

  return function requireAllowedRole(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN');
    }

    return next();
  };
}

module.exports = authorize;
