const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const { extractTextFromPDF } = require('../services/pdfService');
const {
  analyzeResumeWithAI,
  generateResumeInsights,
} = require('../services/aiService');
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
    const resumeInsights = await generateResumeInsights(text);

    const resumeDoc = await Resume.create({
      user: req.user._id,
      fileName: req.file.originalname,
      resumeText: text,
      aiAnalysis,

      atsScore: resumeInsights.atsScore,
      sections: resumeInsights.sections,
      skills: resumeInsights.skills,
      strengths: resumeInsights.strengths,
      weaknesses: resumeInsights.weaknesses,
      improvements: resumeInsights.improvements,
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

exports.getMyResumes = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const resumes = await Resume.find({ user: userId })
      .sort({ createdAt: -1 })
      .select(
        '_id fileName createdAt atsScore sections skills strengths weaknesses improvements courseRecommendations'
      )
      .lean();

    const data = resumes.map((resume) => ({
      _id: resume._id,
      fileName: resume.fileName,
      createdAt: resume.createdAt,
      atsScore: resume.atsScore ?? null,
      sections: resume.sections ?? null,
      skills: resume.skills ?? null,
      strengths: resume.strengths ?? [],
      weaknesses: resume.weaknesses ?? [],
      improvements: resume.improvements ?? null,
      courseRecommendations: resume.courseRecommendations?.courses ?? [],
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Resume history error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch resumes' });
  }
};

exports.reanalyzeResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    const insights = await generateResumeInsights(resume.resumeText);

    resume.atsScore = insights.atsScore;
    resume.sections = insights.sections;
    resume.skills = insights.skills;
    resume.strengths = insights.strengths;
    resume.weaknesses = insights.weaknesses;
    resume.improvements = insights.improvements;
    await resume.save();

    res.json({ success: true, data: resume });
  } catch (err) {
    console.error('Resume reanalysis error:', err.message);
    res.status(500).json({ success: false, message: 'Reanalysis failed' });
  }
};
