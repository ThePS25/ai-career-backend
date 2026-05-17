const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    let token = null;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (authHeader?.trim()) {
      token = authHeader.trim();
    }

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
