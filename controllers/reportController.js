const Resume = require('../models/Resume');
const { ensureCourseRecommendations } = require('../services/courseService');
const { ensureJobRecommendations } = require('../services/jobService');
const { resolveAiProvider } = require('../services/aiService');
const { generateReportPdf } = require('../services/pdfReportService');
const logger = require('../utils/logger');
const { getRequestedAiProvider } = require('../utils/aiProvider');

exports.downloadReport = async (req, res, next) => {
  try {
    const aiProvider = resolveAiProvider(getRequestedAiProvider(req));
    const resume = await Resume.findOne({
      _id: req.params.resumeId,
      user: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    await Promise.all([
      ensureCourseRecommendations(resume, { provider: aiProvider }),
      ensureJobRecommendations(resume, { provider: aiProvider }),
    ]);

    const pdfBuffer = await generateReportPdf(resume);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resume-report-${resume._id}.pdf"`
    );
    res.end(pdfBuffer);
  } catch (err) {
    logger.error('Report download error', { message: err.message });
    next(err);
  }
};
