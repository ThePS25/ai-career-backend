require('dotenv').config();

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'RAPIDAPI_KEY',
  'RAPIDAPI_HOST',
];

function resolveMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI;
}

function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (!resolveMongoUri()) {
    missing.push('MONGO_URI (or MONGODB_URI)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
    throw new Error(
      'Missing required environment variable: CLIENT_URL (required in production)'
    );
  }

  const port = parseInt(process.env.PORT, 10);
  if (Number.isNaN(port) || port < 1) {
    throw new Error('PORT must be a valid positive number');
  }

  const hasHf = Boolean(process.env.HF_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!hasHf && !hasGemini) {
    throw new Error('At least one AI provider key is required: HF_API_KEY or GEMINI_API_KEY');
  }
}

const mongodbUri = resolveMongoUri();

function resolveHfModels() {
  const model = (process.env.HF_MODEL || 'google/gemma-4-31B-it').trim();
  return [model];
}

const hfModels = resolveHfModels();

/** Default fallback order when a model is quota-limited or unavailable */
const DEFAULT_GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

const geminiPrimaryModel = (
  process.env.GEMINI_PRIMARY_MODEL || DEFAULT_GEMINI_MODELS[1]
).trim();
const geminiFallbackModel = (
  process.env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_MODELS[DEFAULT_GEMINI_MODELS.length - 1]
).trim();

function buildGeminiModelChain() {
  const extra = (process.env.GEMINI_EXTRA_MODELS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return [
    ...new Set(
      [geminiPrimaryModel, ...DEFAULT_GEMINI_MODELS, ...extra, geminiFallbackModel].filter(Boolean)
    ),
  ];
}

const geminiModelChain = buildGeminiModelChain();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri,
  clientUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim(),
  hfApiKey: process.env.HF_API_KEY?.trim(),
  hfChatUrl:
    process.env.HF_CHAT_URL ||
    'https://router.huggingface.co/v1/chat/completions',
  hfModels,
  hfModel: hfModels[0],
  hfTimeoutMs: parseInt(process.env.HF_TIMEOUT_MS, 10) || 90000,
  hfMaxRetries: parseInt(process.env.HF_MAX_RETRIES, 10) || 5,
  hfCooldownMs: parseInt(process.env.HF_COOLDOWN_MS, 10) || 3000,
  hf429RetryBaseMs: parseInt(process.env.HF_429_RETRY_BASE_MS, 10) || 3000,
  hfSkipStartupCheck: process.env.HF_SKIP_STARTUP_CHECK === 'true',
  geminiApiKey: process.env.GEMINI_API_KEY?.trim(),
  geminiPrimaryModel,
  geminiFallbackModel,
  geminiModelChain,
  defaultGeminiModels: DEFAULT_GEMINI_MODELS,
  geminiModel: geminiPrimaryModel,
  geminiTimeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 90000,
  geminiMaxRetries: parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 3,
  defaultAiProvider: (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(),
  rapidApi: {
    key: process.env.RAPIDAPI_KEY,
    host: process.env.RAPIDAPI_HOST,
    jsearchLocation: process.env.JSEARCH_LOCATION || 'India',
  },
  validateEnv,
};
