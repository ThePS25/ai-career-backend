require('dotenv').config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  hfApiKey: process.env.HF_API_KEY,
  hfChatUrl:
    process.env.HF_CHAT_URL ||
    'https://router.huggingface.co/v1/chat/completions',
  hfModel: process.env.HF_MODEL || 'google/gemma-4-31B-it',
  validateEnv,
};
