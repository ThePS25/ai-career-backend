const express = require('express');
const { getCourseRecommendations } = require('../controllers/courseController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/:resumeId/recommend', protect, getCourseRecommendations);

module.exports = router;
