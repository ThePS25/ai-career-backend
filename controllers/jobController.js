const Resume = require('../models/Resume');
const { ensureJobRecommendations, searchJobs } = require('../services/jobService');
const { resolveAiProvider } = require('../services/aiService');
const logger = require('../utils/logger');
const { getRequestedAiProvider } = require('../utils/aiProvider');

exports.getJobs = async (req, res, next) => {
  try {
    const aiProvider = resolveAiProvider(getRequestedAiProvider(req));
    const { query, location } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'query parameter is required',
      });
    }

    const jobs = await searchJobs(query, location);

    res.json({ success: true, data: jobs });
  } catch (err) {
    logger.error('Job search error', { message: err.message });
    next(err);
  }
};

exports.getJobRecommendations = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.resumeId,
      user: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    const jobRecommendations = await ensureJobRecommendations(resume, {
      provider: aiProvider,
    });

    res.json({ success: true, data: jobRecommendations });
  } catch (err) {
    logger.error('Job recommendations error', { message: err.message });
    next(err);
  }
};
