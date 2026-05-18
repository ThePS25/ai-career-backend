const dns = require('dns');
const mongoose = require('mongoose');
const { mongodbUri, nodeEnv } = require('./env');

// Node on Windows often fails SRV lookups (querySrv ECONNREFUSED) while nslookup works.
// Use public DNS so mongodb+srv URIs resolve reliably.
if (mongodbUri.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

async function connectDB() {
  try {
    const conn = await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 10000,
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
    if (error.message.includes('querySrv')) {
      console.error(
        'Tip: On Windows, SRV DNS can fail. Ensure internet access, or use the standard (non-srv) connection string from MongoDB Atlas.'
      );
    }
    process.exit(1);
  }
}

module.exports = connectDB;
