const mongoose = require('mongoose');
const { getAvailableProviders, resolveAiProvider } = require('../services/aiService');

function getHealth(_req, res) {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatusMap[dbState] || 'unknown',
  });
}

function getAiStatus(req, res) {
  const availableProviders = getAvailableProviders();
  const activeProvider = availableProviders.length
    ? resolveAiProvider(req.query.provider)
    : null;

  res.status(200).json({
    success: true,
    data: {
      availableProviders,
      activeProvider,
      canSwitch: availableProviders.length > 1,
    },
  });
}

module.exports = { getHealth, getAiStatus };
