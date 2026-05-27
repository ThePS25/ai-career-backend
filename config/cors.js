const { clientUrl, nodeEnv } = require('./env');

const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function getAllowedOrigins() {
  const origins = new Set(devOrigins);

  if (clientUrl) {
    origins.add(clientUrl.replace(/\/$/, ''));
  }

  return [...origins];
}

function corsOriginValidator(origin, callback) {
  const allowed = getAllowedOrigins();

  // Same-origin or server-to-server requests (no Origin header)
  if (!origin) {
    return callback(null, true);
  }

  const normalized = origin.replace(/\/$/, '');

  if (allowed.includes(normalized)) {
    return callback(null, true);
  }

  if (nodeEnv === 'development') {
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }

  return callback(new Error('Not allowed by CORS'));
}

module.exports = { getAllowedOrigins, corsOriginValidator };
