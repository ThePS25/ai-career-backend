const express = require("express");
const healthRoutes = require("./healthRoutes");
const authRoutes = require("./authRoutes");
const resumeRoutes = require("./resumeRoutes");
const courseRoutes = require("./courseRoutes");
const reportRoutes = require("./reportRoutes");
const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/resume", resumeRoutes);
router.use("/courses", courseRoutes);
router.use("/report", reportRoutes);
module.exports = router;
