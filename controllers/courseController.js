const Resume = require('../models/Resume');
const { ensureCourseRecommendations } = require('../services/courseService');
const logger = require('../utils/logger');

exports.getCourseRecommendations = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.resumeId,
      user: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    const courseRecommendations = await ensureCourseRecommendations(resume);

    res.json({ success: true, data: courseRecommendations });
  } catch (err) {
    logger.error('Course recommendations error', { message: err.message });
    next(err);
  }
};
