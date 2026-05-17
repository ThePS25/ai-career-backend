const Resume = require('../models/Resume');
const { ensureJobRecommendations, searchJobs } = require('../services/jobService');

exports.getJobs = async (req, res) => {
  try {
    const { query, location } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'query parameter is required',
      });
    }

    const jobs = await searchJobs(query, location);

    res.json(jobs);
  } catch (err) {
    console.error('Job search error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to search jobs',
    });
  }
};

exports.getJobRecommendations = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.resumeId,
      user: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    const jobRecommendations = await ensureJobRecommendations(resume);

    res.json({ success: true, data: jobRecommendations });
  } catch (err) {
    console.error('Job recommendations error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate job recommendations',
    });
  }
};
