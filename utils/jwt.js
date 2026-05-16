const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');

function generateToken(userId) {
  return jwt.sign({ id: userId }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, jwtConfig.secret);
}

module.exports = { generateToken, verifyToken };
