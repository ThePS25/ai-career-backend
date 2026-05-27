const express = require('express');
const { getJobs, getJobRecommendations } = require('../controllers/jobController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/', protect, asyncHandler(getJobs));
router.get('/:resumeId/recommend', protect, asyncHandler(getJobRecommendations));

module.exports = router;
