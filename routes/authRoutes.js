const express = require('express');
const { register } = require('../controllers/registerController');
const { login } = require('../controllers/loginController');
const { googleLogin } = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');
const { formatAuthUser } = require('../utils/authResponse');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);

router.get('/me', protect, (req, res) => {
  res.status(200).json({
    success: true,
    user: formatAuthUser(req.user),
  });
});

module.exports = router;
