const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { formatAuthUser } = require('../utils/authResponse');
const { googleClientId } = require('../config/env');
const logger = require('../utils/logger');

const googleClient = new OAuth2Client(googleClientId);

async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google account data',
      });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name = payload.name?.trim();
    const avatar = payload.picture;

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    }).select('+password');

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (name && !user.name) user.name = name;
        if (avatar && !user.avatar) user.avatar = avatar;
        await user.save();
      }
    } else {
      user = await User.create({
        email,
        googleId,
        name: name || undefined,
        avatar: avatar || undefined,
        authProvider: 'google',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    logger.error('Google auth error', { message: error.message });
    const err = new Error('Google authentication failed');
    err.statusCode = 401;
    next(err);
  }
}

module.exports = { googleLogin };
