const Resume = require('../models/Resume');
const { ensureCourseRecommendations } = require('../services/courseService');

exports.getCourseRecommendations = async (req, res) => {
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
    console.error('Course recommendations error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate course recommendations',
    });
  }
};
