const mongoose = require('mongoose');

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

module.exports = { getHealth };
