const { nodeEnv } = require('../config/env');

function notFound(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  console.error(`[${statusCode}] ${message}`, nodeEnv === 'development' ? err.stack : '');

  res.status(statusCode).json({
    success: false,
    message,
    ...(nodeEnv === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
