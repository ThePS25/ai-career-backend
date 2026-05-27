const dns = require('dns');
const mongoose = require('mongoose');
const { mongodbUri, nodeEnv } = require('./env');
const logger = require('../utils/logger');

if (mongodbUri.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

async function connectDB() {
  try {
    const conn = await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 10000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { message: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      if (nodeEnv !== 'test') {
        logger.warn('MongoDB disconnected');
      }
    });
  } catch (error) {
    logger.error('MongoDB connection failed', { message: error.message });
    if (error.message.includes('querySrv')) {
      logger.warn(
        'Tip: On Windows, SRV DNS can fail. Use the standard (non-srv) connection string from MongoDB Atlas.'
      );
    }
    process.exit(1);
  }
}

module.exports = connectDB;
