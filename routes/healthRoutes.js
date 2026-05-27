const express = require('express');
const { getHealth, getAiStatus } = require('../controllers/healthController');

const router = express.Router();

router.get('/', getHealth);
router.get('/ai', getAiStatus);

module.exports = router;
