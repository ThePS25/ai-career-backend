const PROHIBITED_KEY = /^\$|\./;

function sanitizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (PROHIBITED_KEY.test(key)) {
      continue;
    }
    if (
      key !== '__proto__' &&
      key !== 'constructor' &&
      key !== 'prototype'
    ) {
      result[key] = sanitizeValue(val);
    }
  }
  return result;
}

function sanitizeInPlace(obj) {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  for (const key of [...Object.keys(obj)]) {
    if (PROHIBITED_KEY.test(key)) {
      delete obj[key];
      continue;
    }

    const val = obj[key];
    if (val !== null && typeof val === 'object') {
      sanitizeInPlace(val);
    }
  }
}

/**
 * Strip MongoDB operator keys ($gt, $where, etc.) from request input.
 * Express 5 makes req.query read-only — sanitize it in place instead of reassigning.
 */
function mongoSanitize(req, _res, next) {
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

module.exports = mongoSanitize;
