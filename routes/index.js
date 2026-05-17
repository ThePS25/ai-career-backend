const express = require("express");
const healthRoutes = require("./healthRoutes");
const authRoutes = require("./authRoutes");
const resumeRoutes = require("./resumeRoutes");
const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/resume", resumeRoutes);
module.exports = router;
