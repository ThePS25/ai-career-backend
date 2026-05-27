const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('./middleware/mongoSanitize');
const xssSanitize = require('./middleware/xssSanitize');

const { validateEnv, port, nodeEnv } = require('./config/env');
const { corsOriginValidator } = require('./config/cors');
const connectDB = require('./config/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { verifyHfConnection } = require('./services/aiService');

validateEnv();

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: nodeEnv === 'production',
  })
);

app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-AI-Provider'],
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize);
app.use(xssSanitize);
app.use(hpp());

if (nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      skip: (_req, res) => res.statusCode < 400,
    })
  );
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: nodeEnv === 'production' ? 100 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

app.use(globalLimiter);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  await connectDB();
  await verifyHfConnection();

  const host = '0.0.0.0';
  const server = app.listen(port, host, () => {
    logger.info(`Server running in ${nodeEnv} mode on port ${port}`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('Failed to start server', { message: err.message });
  process.exit(1);
});

module.exports = app;
