const express = require('express');
const rateLimit = require('express-rate-limit');

const { getMe, login, register } = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
    });
  },
});

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, getMe);

module.exports = router;
