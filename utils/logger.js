const { nodeEnv } = require('../config/env');

const SENSITIVE_KEYS = /password|token|secret|authorization|api[_-]?key|credential/i;

function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redact(val),
      ])
    );
  }
  return value;
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level.toUpperCase()}`;
  if (meta === undefined) {
    return `${prefix} ${message}`;
  }
  if (nodeEnv === 'production') {
    return `${prefix} ${message}`;
  }
  return `${prefix} ${message} ${JSON.stringify(redact(meta))}`;
}

const logger = {
  info(message, meta) {
    console.log(formatMessage('info', message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage('warn', message, meta));
  },
  error(message, meta) {
    console.error(formatMessage('error', message, meta));
  },
  debug(message, meta) {
    if (nodeEnv === 'development') {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

module.exports = logger;
