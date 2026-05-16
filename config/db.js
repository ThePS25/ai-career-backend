const mongoose = require('mongoose');
const { mongodbUri, nodeEnv } = require('./env');

async function connectDB() {
  try {
    const conn = await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      if (nodeEnv !== 'test') {
        console.warn('MongoDB disconnected');
      }
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
