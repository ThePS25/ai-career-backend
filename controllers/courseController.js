const Resume = require('../models/Resume');
const { ensureCourseRecommendations } = require('../services/courseService');
const { resolveAiProvider } = require('../services/aiService');
const logger = require('../utils/logger');
const { getRequestedAiProvider } = require('../utils/aiProvider');

exports.getCourseRecommendations = async (req, res, next) => {
  try {
    const aiProvider = resolveAiProvider(getRequestedAiProvider(req));
    const resume = await Resume.findOne({
      _id: req.params.resumeId,
      user: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    const courseRecommendations = await ensureCourseRecommendations(resume, {
      provider: aiProvider,
    });

    res.json({ success: true, data: courseRecommendations });
  } catch (err) {
    logger.error('Course recommendations error', { message: err.message });
    next(err);
  }
};
