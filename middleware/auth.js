const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (authHeader?.trim()) {
    token = authHeader.trim();
  }

  // Allow token in query for GET file downloads (browser / download managers)
  if (!token && req.method === 'GET') {
    const queryToken = req.query.token || req.query.access_token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      token = queryToken.trim();
    }
  }

  return token;
}

async function protect(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          'Not authorized — add header: Authorization: Bearer <your-jwt-token>',
      });
    }
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized — user no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Token expired'
        : 'Not authorized — invalid token';

    return res.status(401).json({ success: false, message });
  }
}

module.exports = { protect };
