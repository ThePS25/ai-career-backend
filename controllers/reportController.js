const Resume = require('../models/Resume');
const { ensureCourseRecommendations } = require('../services/courseService');
const { generateReportPdf } = require('../services/pdfReportService');

exports.downloadReport = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.resumeId,
      user: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    await ensureCourseRecommendations(resume);

    const pdfBuffer = await generateReportPdf(resume);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resume-report-${resume._id}.pdf"`
    );
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Report download error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};
