const express = require('express');
const { register } = require('../controllers/registerController');
const { login } = require('../controllers/loginController');
const { googleLogin } = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');
const { formatAuthUser } = require('../utils/authResponse');
const { authLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/register', authLimiter, asyncHandler(register));
router.post('/login', authLimiter, asyncHandler(login));
router.post('/google', authLimiter, asyncHandler(googleLogin));

router.get(
  '/me',
  protect,
  asyncHandler((req, res) => {
    res.status(200).json({
      success: true,
      user: formatAuthUser(req.user),
    });
  })
);

module.exports = router;
