const express = require('express');
const {
  uploadResume,
  reanalyzeResume,
  getMyResumes,
} = require('../controllers/resumeController');
const { protect } = require('../middleware/auth');
const { uploadResume: uploadMiddleware, handleUploadError } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/my', protect, asyncHandler(getMyResumes));
router.post('/my', protect, asyncHandler(getMyResumes));
router.post(
  '/upload',
  protect,
  uploadLimiter,
  uploadMiddleware,
  handleUploadError,
  asyncHandler(uploadResume)
);
router.post('/reanalyze/:id', protect, uploadLimiter, asyncHandler(reanalyzeResume));

module.exports = router;
