const express = require('express');
const { downloadReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/:resumeId/download', protect, asyncHandler(downloadReport));

module.exports = router;
