const express = require('express');
const { downloadReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/:resumeId/download', protect, downloadReport);

module.exports = router;
