const express = require('express');
const multer = require('multer');
const {
  uploadResume,
  reanalyzeResume,
  getMyResumes,
} = require('../controllers/resumeController');
const { protect } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/my', protect, getMyResumes);
router.post('/my', protect, getMyResumes);
router.post('/upload', protect, upload.single('resume'), uploadResume);
router.post('/reanalyze/:id', protect, reanalyzeResume);

module.exports = router;
