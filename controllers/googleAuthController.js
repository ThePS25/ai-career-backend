const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { formatAuthUser } = require('../utils/authResponse');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: 'Google login is not configured on the server',
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
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
    console.error('Google auth error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Google authentication failed',
    });
  }
}

module.exports = { googleLogin };
