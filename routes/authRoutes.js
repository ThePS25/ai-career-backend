const express = require('express');
const { register } = require('../controllers/registerController');
const { login } = require('../controllers/loginController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Protected route example — attach `protect` to any route that requires auth
router.get('/me', protect, (req, res) => {
  res.status(200).json({
    success: true,
    user: { id: req.user._id, email: req.user.email },
  });
});

module.exports = router;
