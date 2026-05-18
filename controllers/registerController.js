const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { formatAuthUser } = require('../utils/authResponse');

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const message = existingUser.googleId
        ? 'Email already registered with Google. Please continue with Google.'
        : 'Email already registered';
      return res.status(409).json({
        success: false,
        message,
      });
    }

    const user = await User.create({ email, password, authProvider: 'local' });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }
    next(error);
  }
}

module.exports = { register };
