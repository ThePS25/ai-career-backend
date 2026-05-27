const express = require('express');
const { getCourseRecommendations } = require('../controllers/courseController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/:resumeId/recommend', protect, asyncHandler(getCourseRecommendations));

module.exports = router;
