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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);