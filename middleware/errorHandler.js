const { nodeEnv } = require('../config/env');
const logger = require('../utils/logger');

function notFound(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier';
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
  }

  if (message.includes('CORS') || message.includes('Not allowed by CORS')) {
    statusCode = 403;
  }

  const clientMessage =
    statusCode >= 500 && nodeEnv === 'production'
      ? 'Something went wrong'
      : message;

  logger.error(clientMessage, {
    statusCode,
    ...(nodeEnv === 'development' && { stack: err.stack }),
  });

  const body = {
    success: false,
    message: clientMessage,
  };

  if (nodeEnv === 'development' && statusCode >= 500) {
    body.detail = message;
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
