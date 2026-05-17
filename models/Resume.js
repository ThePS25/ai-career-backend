const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: String,
    resumeText: String,
    aiAnalysis: String,

    atsScore: Number,

    sections: {
      hasSummary: Boolean,
      hasProjects: Boolean,
      hasExperience: Boolean,
      hasEducation: Boolean,
      hasSkills: Boolean,
      hasCertifications: Boolean,
    },

    skills: {
      technical: [String],
      soft: [String],
      tools: [String],
    },

    strengths: [String],
    weaknesses: [String],

    improvements: {
      improvedBullets: [String],
      summaryRewrite: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);