const Resume = require('../models/Resume');
const { extractTextFromPDF } = require('../services/pdfService');
const { analyzeResumeWithAI } = require('../services/aiService');
const { nodeEnv } = require('../config/env');

exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Use form field name "resume" with a PDF file.',
      });
    }

    const text = await extractTextFromPDF(req.file.buffer);

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract text from PDF. Upload a text-based PDF.',
      });
    }

    const aiAnalysis = await analyzeResumeWithAI(text);

    const resumeDoc = await Resume.create({
      user: req.user._id,
      fileName: req.file.originalname,
      resumeText: text,
      aiAnalysis,
    });

    res.json({ success: true, data: resumeDoc });
  } catch (err) {
    console.error('Resume upload error:', err.response?.data || err.message);

    const status = err.response?.status || 500;
    const message =
      err.response?.data?.error?.message ||
      err.message ||
      'Resume processing failed';

    res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message,
      ...(nodeEnv === 'development' && { detail: err.response?.data }),
    });
  }
};
