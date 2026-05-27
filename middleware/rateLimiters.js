const rateLimit = require('express-rate-limit');
const { nodeEnv } = require('../config/env');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: nodeEnv === 'production' ? 20 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: nodeEnv === 'production' ? 10 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload limit reached. Please try again later',
  },
});

module.exports = { authLimiter, uploadLimiter };
