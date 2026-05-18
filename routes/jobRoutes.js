const express = require('express');
const { getJobs, getJobRecommendations } = require('../controllers/jobController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getJobs);
router.get('/:resumeId/recommend', protect, getJobRecommendations);

module.exports = router;
