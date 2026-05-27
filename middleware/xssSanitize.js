const { filterXSS } = require('xss');

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script'],
};

function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return filterXSS(value, xssOptions);
}

function sanitizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = sanitizeValue(val);
  }
  return result;
}

function sanitizeInPlace(obj) {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = sanitizeString(val);
    } else if (val !== null && typeof val === 'object') {
      sanitizeInPlace(val);
    }
  }
}

/**
 * Sanitize user input to reduce XSS risk.
 * Express 5: req.query is read-only — mutate in place.
 */
function xssSanitize(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }

  if (req.query && typeof req.query === 'object') {
    sanitizeInPlace(req.query);
  }

  next();
}

module.exports = xssSanitize;
