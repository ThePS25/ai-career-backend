const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const { extractTextFromPDF } = require('../services/pdfService');
const {
  analyzeResumeWithAI,
  generateResumeInsights,
  generateCourseRecommendations,
} = require('../services/aiService');
const { buildJobRecommendations } = require('../services/jobService');
const logger = require('../utils/logger');

exports.uploadResume = async (req, res, next) => {
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

    const [courseRecommendations, jobRecommendations] = await Promise.all([
      generateCourseRecommendations(resumeDoc),
      buildJobRecommendations(resumeDoc),
    ]);

    resumeDoc.courseRecommendations = courseRecommendations;
    resumeDoc.jobRecommendations = jobRecommendations;
    await resumeDoc.save();

    res.json({ success: true, data: resumeDoc });
  } catch (err) {
    logger.error('Resume upload error', { message: err.message });
    next(err);
  }
};

exports.getMyResumes = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const resumes = await Resume.find({ user: userId })
      .sort({ createdAt: -1 })
      .select(
        '_id fileName createdAt atsScore sections skills strengths weaknesses improvements courseRecommendations jobRecommendations'
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
      jobRecommendations: resume.jobRecommendations?.jobs ?? [],
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('Resume history error', { message: err.message });
    next(err);
  }
};

exports.reanalyzeResume = async (req, res, next) => {
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
    resume.courseRecommendations = undefined;
    resume.jobRecommendations = undefined;
    await resume.save();

    const [courseRecommendations, jobRecommendations] = await Promise.all([
      generateCourseRecommendations(resume),
      buildJobRecommendations(resume),
    ]);

    resume.courseRecommendations = courseRecommendations;
    resume.jobRecommendations = jobRecommendations;
    await resume.save();

    res.json({ success: true, data: resume });
  } catch (err) {
    logger.error('Resume reanalysis error', { message: err.message });
    next(err);
  }
};
