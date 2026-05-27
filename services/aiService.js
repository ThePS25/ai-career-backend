const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  hfApiKey,
  hfChatUrl,
  hfModels,
  hfTimeoutMs,
  hfMaxRetries,
  hfCooldownMs,
  hf429RetryBaseMs,
  hfSkipStartupCheck,
  geminiApiKey,
  geminiPrimaryModel,
  geminiFallbackModel,
  geminiModelChain,
  geminiTimeoutMs,
  geminiMaxRetries,
  defaultAiProvider,
} = require('../config/env');
const logger = require('../utils/logger');

const FALLBACK_ANALYSIS = `Resume analysis is temporarily unavailable. Please try again later.

Suggested next steps:
- Review formatting and section completeness
- Add measurable achievements to experience bullets
- Align skills with target job descriptions`;

const FALLBACK_INSIGHTS = {
  atsScore: 0,
  summary: 'AI service temporarily unavailable',
  recommendedRoles: [],
  skillGaps: [],
  courseSuggestions: [],
  interviewQuestions: [],
  sections: {
    hasSummary: false,
    hasProjects: false,
    hasExperience: false,
    hasEducation: false,
    hasSkills: false,
    hasCertifications: false,
  },
  skills: { technical: [], soft: [], tools: [] },
  strengths: [],
  weaknesses: ['AI service temporarily unavailable'],
  improvements: {
    improvedBullets: [],
    summaryRewrite: 'AI service temporarily unavailable',
  },
};

const FALLBACK_COURSES = {
  courses: [
    {
      title: 'JavaScript: The Complete Guide',
      platform: 'Udemy',
      reason: 'Strengthen core programming fundamentals',
      skillsCovered: ['JavaScript'],
    },
  ],
};

const FALLBACK_JOBS = {
  jobs: [
    {
      title: 'Software Engineer',
      jobCode: 'REQ-FALLBACK-001',
      company: 'Various Employers',
      location: 'Remote',
      matchScore: 60,
      reason: 'AI job matching temporarily unavailable',
      requiredSkills: [],
      source: 'ai',
    },
  ],
};

const AI_PROVIDERS = {
  HUGGINGFACE: 'huggingface',
  GEMINI: 'gemini',
};

let aiStartupChecked = false;
let providerRuntimeStatus = {
  huggingface: Boolean(hfApiKey && hfModels.length > 0),
  gemini: Boolean(geminiApiKey && geminiPrimaryModel),
};

function parseJsonFromAI(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

function getProviderAvailability() {
  if (aiStartupChecked) {
    return { ...providerRuntimeStatus };
  }
  return {
    huggingface: Boolean(hfApiKey && hfModels.length > 0),
    gemini: Boolean(geminiApiKey && geminiPrimaryModel),
  };
}

function getAvailableProviders() {
  const availability = getProviderAvailability();
  return Object.entries(availability)
    .filter(([, isAvailable]) => isAvailable)
    .map(([provider]) => provider);
}

function resolveAiProvider(requestedProvider) {
  const available = getAvailableProviders();
  if (!available.length) {
    throw new Error('No configured AI providers available');
  }

  const normalized = (requestedProvider || '').toLowerCase();
  if (normalized && available.includes(normalized)) {
    return normalized;
  }

  if (available.includes(defaultAiProvider)) {
    return defaultAiProvider;
  }

  return available[0];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serialize HF calls + cooldown to avoid 429 bursts during upload (4+ calls per resume)
let hfQueue = Promise.resolve();

function enqueueHfTask(task) {
  const result = hfQueue.then(() => task());
  hfQueue = result
    .catch(() => {})
    .then(() => sleep(hfCooldownMs));
  return result;
}

function extractHfMessage(error) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.message
  );
}

function formatHfError(error, model) {
  const status = error.response?.status;
  const hfMessage = extractHfMessage(error);
  const modelLabel = model || hfModels.join(' → ');

  if (status === 401) {
    return (
      'Hugging Face API authentication failed (401). ' +
      'Regenerate HF_API_KEY at https://huggingface.co/settings/tokens ' +
      'with "Inference Providers" permission, update .env, and restart the server.'
    );
  }

  if (status === 403) {
    return `Hugging Face access denied for model "${modelLabel}". ${hfMessage}`;
  }

  if (status === 429) {
    return (
      `Hugging Face router overloaded (429) for "${modelLabel}". ` +
      `Configured models: ${hfModels.join(', ')}`
    );
  }

  return hfMessage;
}

function shouldTryNextModel(error) {
  const status = error.response?.status;
  if (status === 401) return false;
  return true;
}

function isRetryableHfError(error) {
  const status = error.response?.status;
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    status === 429 ||
    (status >= 500 && status < 600)
  );
}

function getRetryDelayMs(attempt, status) {
  if (status === 429) {
    return hf429RetryBaseMs * 2 ** attempt;
  }
  return 1000 * (attempt + 1);
}

const geminiClient = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const geminiChainLabel = geminiModelChain.join(' -> ');

function getModel(modelName) {
  if (!geminiClient) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return geminiClient.getGenerativeModel({ model: modelName });
}

function getGeminiErrorStatus(error) {
  return error?.status || error?.cause?.status || error?.response?.status;
}

function isRetryableGeminiError(error) {
  const status = getGeminiErrorStatus(error);
  if (status === 404 || status === 400 || status === 429) {
    return false;
  }
  return (
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT' ||
    (status >= 500 && status < 600)
  );
}

function formatGeminiError(error, modelName) {
  const actual = error?.cause || error;
  const status = getGeminiErrorStatus(actual);
  const modelLabel = modelName || geminiChainLabel;
  const message =
    actual?.response?.data?.error?.message ||
    actual?.response?.data?.message ||
    actual?.message ||
    error?.message ||
    'Unknown Gemini error';

  if (status === 401 || status === 403) {
    return `Gemini auth failed for "${modelLabel}". Check GEMINI_API_KEY.`;
  }
  if (status === 404 || status === 400) {
    return `Gemini model "${modelLabel}" is unavailable: ${message}`;
  }
  if (status === 429) {
    return `Gemini quota exceeded (429) on "${modelLabel}". Try another model in GEMINI_FALLBACK_MODEL or enable billing.`;
  }
  return `Gemini error on "${modelLabel}": ${message}`;
}

async function callSingleGeminiModel(prompt, maxTokens, modelName) {
  const model = getModel(modelName);
  let lastError;

  for (let attempt = 0; attempt <= geminiMaxRetries; attempt += 1) {
    try {
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini request timed out')), geminiTimeoutMs)
        ),
      ]);
      const text = result?.response?.text?.().trim();
      if (!text) {
        throw new Error('Gemini returned an empty response');
      }
      return { text, modelName };
    } catch (error) {
      lastError = error;
      if (attempt < geminiMaxRetries && isRetryableGeminiError(error)) {
        const delay = getRetryDelayMs(attempt, error?.status || error?.response?.status);
        logger.warn(
          `Gemini "${modelName}" attempt ${attempt + 1} failed, retry in ${Math.round(delay / 1000)}s`
        );
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  const wrapped = new Error(formatGeminiError(lastError, modelName));
  wrapped.cause = lastError;
  throw wrapped;
}

async function callGeminiWithFallback(prompt, maxTokens = 1024) {
  let lastError;

  for (let i = 0; i < geminiModelChain.length; i += 1) {
    const modelName = geminiModelChain[i];
    const nextModel = geminiModelChain[i + 1];
    try {
      const { text } = await callSingleGeminiModel(prompt, maxTokens, modelName);
      return text;
    } catch (error) {
      lastError = error;
      logger.warn(error.message);
      if (nextModel) {
        logger.warn(`Switching Gemini model from "${modelName}" to "${nextModel}"`);
      }
    }
  }

  const wrapped = new Error(`All Gemini models failed (${geminiChainLabel})`);
  wrapped.cause = lastError?.cause || lastError;
  throw wrapped;
}

async function pingModel(model) {
  await axios.post(
    hfChatUrl,
    {
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    },
    {
      headers: {
        Authorization: `Bearer ${hfApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );
}

async function pingGemini() {
  if (!geminiApiKey) return false;
  for (const modelName of geminiModelChain) {
    try {
      await callSingleGeminiModel('ping', 5, modelName);
      return modelName;
    } catch (error) {
      logger.warn(formatGeminiError(error, modelName));
    }
  }
  throw new Error(`All Gemini models failed (${geminiChainLabel})`);
}

async function verifyHfConnection() {
  if (hfSkipStartupCheck) {
    logger.info('AI startup check skipped');
    return true;
  }

  const available = [];
  providerRuntimeStatus = { huggingface: false, gemini: false };

  if (hfApiKey) {
    for (const model of hfModels) {
      try {
        await pingModel(model);
        available.push(AI_PROVIDERS.HUGGINGFACE);
        providerRuntimeStatus.huggingface = true;
        logger.info(`Hugging Face OK: ${model}`);
        break;
      } catch (error) {
        const status = error.response?.status;
        const hint =
          status === 400
            ? ' — enable this model at https://huggingface.co/settings/inference-providers'
            : '';
        logger.warn(
          `Hugging Face unavailable: ${model} (${status || error.code || 'error'})${hint}`
        );
      }
    }
  } else {
    logger.warn('HF_API_KEY is missing');
  }

  if (geminiApiKey) {
    try {
      const modelUsed = await pingGemini();
      available.push(AI_PROVIDERS.GEMINI);
      providerRuntimeStatus.gemini = true;
      logger.info(`Gemini OK: ${modelUsed} (chain: ${geminiChainLabel})`);
    } catch (error) {
      logger.warn(`Gemini unavailable: ${error.message}`);
    }
  } else {
    logger.warn('GEMINI_API_KEY is missing');
  }

  if (available.length === 0) {
    aiStartupChecked = true;
    logger.warn('No AI providers reachable at startup. Uploads will use fallback responses.');
    return false;
  }

  aiStartupChecked = true;
  logger.info(`AI providers ready: ${[...new Set(available)].join(', ')}`);
  return true;
}

async function callModelChat(model, prompt, maxTokens) {
  let lastError;

  for (let attempt = 0; attempt <= hfMaxRetries; attempt += 1) {
    try {
      const response = await axios.post(
        hfChatUrl,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${hfApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: hfTimeoutMs,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI returned an empty response');
      }
      return content;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      if (status === 401) {
        break;
      }

      if (attempt < hfMaxRetries && isRetryableHfError(error)) {
        const delay = getRetryDelayMs(attempt, status);
        const logFn = status === 429 ? logger.info.bind(logger) : logger.warn.bind(logger);
        logFn(
          `HF "${model}" attempt ${attempt + 1} failed (${status || error.code}), retry in ${Math.round(delay / 1000)}s`
        );
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  const wrapped = new Error(formatHfError(lastError, model));
  wrapped.cause = lastError;
  wrapped.model = model;
  throw wrapped;
}

async function callHuggingFaceChatUnqueued(prompt, maxTokens = 1024) {
  let lastError;

  for (let i = 0; i < hfModels.length; i += 1) {
    const model = hfModels[i];
    const isFallback = i > 0;

    try {
      const content = await callModelChat(model, prompt, maxTokens);
      if (isFallback) {
        logger.info(`HF fallback succeeded with "${model}"`);
      }
      return content;
    } catch (error) {
      lastError = error;
      const hasNext = i < hfModels.length - 1;

      if (!hasNext || !shouldTryNextModel(error.cause || error)) {
        break;
      }

      logger.warn(
        `HF primary model "${model}" failed — switching to "${hfModels[i + 1]}"`
      );
      await sleep(500);
    }
  }

  const wrapped = new Error(
    `All HF models failed (${hfModels.join(' → ')}): ${lastError?.message || 'unknown error'}`
  );
  wrapped.cause = lastError;
  throw wrapped;
}

function callHuggingFaceChat(prompt, maxTokens = 1024) {
  return enqueueHfTask(() => callHuggingFaceChatUnqueued(prompt, maxTokens));
}

async function callGeminiChat(prompt, maxTokens = 1024) {
  return callGeminiWithFallback(prompt, maxTokens);
}

async function callAiChat(prompt, maxTokens, provider) {
  const resolvedProvider = resolveAiProvider(provider);
  if (resolvedProvider === AI_PROVIDERS.GEMINI) {
    return callGeminiChat(prompt, maxTokens);
  }
  return callHuggingFaceChat(prompt, maxTokens);
}

async function analyzeResumeWithAI(resumeText, options = {}) {
  const prompt = `You are an expert tech recruiter.

Analyze the resume and provide:
1. Resume feedback
2. 5 HR interview questions
3. 5 Technical interview questions
4. Career roadmap
5. Skill gaps

Formatting rules:
- Use plain text only (no markdown symbols like ###, **, *, or code fences)
- Use numbered section headings (e.g., "1. Resume Feedback")
- Use simple bullet points with a dash (-) for lists
- Keep paragraphs concise and readable in a PDF report

Resume:
${resumeText}`;

  try {
    return await callAiChat(prompt, 1024, options.provider);
  } catch (error) {
    logger.error('Resume analysis AI failed', { message: error.message });
    return FALLBACK_ANALYSIS;
  }
}

async function generateResumeInsights(resumeText, options = {}) {
  const prompt = `
You are an expert ATS system and senior tech recruiter.

Analyze the resume and return STRICT JSON in this format:

{
  "atsScore": number (0-100),

  "sections": {
    "hasSummary": true/false,
    "hasProjects": true/false,
    "hasExperience": true/false,
    "hasEducation": true/false,
    "hasSkills": true/false,
    "hasCertifications": true/false
  },

  "skills": {
    "technical": [],
    "soft": [],
    "tools": []
  },

  "strengths": [],
  "weaknesses": [],

  "improvements": {
    "improvedBullets": [
      "old bullet -> improved bullet"
    ],
    "summaryRewrite": "write a strong professional summary"
  }
}

Rules:
- ATS score based on formatting, keywords, readability
- Skills must be deduplicated
- Weaknesses must be actionable
- Improved bullets must be achievement-based
- Return ONLY valid JSON, no markdown or extra text

Resume:
${resumeText}
`;

  try {
    const content = await callAiChat(prompt, 2048, options.provider);
    return parseJsonFromAI(content);
  } catch (error) {
    logger.error('Resume insights AI failed', { message: error.message });
    return { ...FALLBACK_INSIGHTS };
  }
}

function getMissingSections(sections) {
  if (!sections) return [];
  const labels = {
    hasSummary: 'Professional Summary',
    hasProjects: 'Projects',
    hasExperience: 'Experience',
    hasEducation: 'Education',
    hasSkills: 'Skills',
    hasCertifications: 'Certifications',
  };
  return Object.entries(labels)
    .filter(([key]) => sections[key] === false)
    .map(([, label]) => label);
}

async function generateCourseRecommendations(resumeDoc, options = {}) {
  const weaknesses = (resumeDoc.weaknesses || []).map((w) => `- ${w}`).join('\n');
  const missingSections = getMissingSections(resumeDoc.sections).join(', ') || 'None';
  const skills = [
    ...(resumeDoc.skills?.technical || []),
    ...(resumeDoc.skills?.soft || []),
    ...(resumeDoc.skills?.tools || []),
  ].join(', ');

  const prompt = `
You are a career coach for software engineers.

Based on the resume profile below, recommend exactly 5 realistic online courses.
Read the weaknesses and missing sections carefully. Tailor recommendations for software engineers.

Return ONLY valid JSON in this format (no markdown):

{
  "courses": [
    {
      "title": "",
      "platform": "Coursera | Udemy",
      "reason": "",
      "skillsCovered": []
    }
  ]
}

Rules:
- platform must be either "Coursera" or "Udemy"
- skillsCovered must be deduplicated
- courses must address weaknesses or missing sections
- use real-sounding course titles

Weaknesses:
${weaknesses || 'None listed'}

Missing sections:
${missingSections}

Current skills:
${skills || 'None listed'}

Resume excerpt:
${(resumeDoc.resumeText || '').slice(0, 2000)}
`;

  try {
    const content = await callAiChat(prompt, 2048, options.provider);
    return parseJsonFromAI(content);
  } catch (error) {
    logger.error('Course recommendations AI failed', { message: error.message });
    return { ...FALLBACK_COURSES };
  }
}

async function generateJobRecommendations(resumeDoc, options = {}) {
  const skills = [
    ...(resumeDoc.skills?.technical || []),
    ...(resumeDoc.skills?.soft || []),
    ...(resumeDoc.skills?.tools || []),
  ].join(', ');
  const strengths = (resumeDoc.strengths || []).map((s) => `- ${s}`).join('\n');
  const weaknesses = (resumeDoc.weaknesses || []).map((w) => `- ${w}`).join('\n');

  const prompt = `
You are an expert tech career advisor and recruiter.

Based on the resume profile below, recommend exactly 5 realistic job roles the candidate should apply for.
Match seniority and skills to the resume. Prefer software engineering and tech roles.

Return ONLY valid JSON in this format (no markdown):

{
  "jobs": [
    {
      "title": "Job Title",
      "jobCode": "REQ-12345 or SWE-2024-001 style requisition code",
      "company": "Realistic company name e.g. Stripe, Infosys, Google",
      "location": "Remote | Hybrid | City",
      "matchScore": 85,
      "reason": "Why this role fits the candidate",
      "requiredSkills": ["skill1", "skill2"]
    }
  ]
}

Rules:
- jobCode must be a unique realistic requisition ID (e.g. REQ-SWE-4821, JOB-ENG-1092)
- company must be a specific recognizable company or realistic employer name
- matchScore is 0-100 based on resume fit
- requiredSkills must be deduplicated (max 6 per job)
- jobs must be realistic for the candidate's experience level
- vary company types and work modes

Strengths:
${strengths || 'None listed'}

Weaknesses:
${weaknesses || 'None listed'}

Current skills:
${skills || 'None listed'}

ATS score: ${resumeDoc.atsScore ?? 'N/A'}

Resume excerpt:
${(resumeDoc.resumeText || '').slice(0, 2000)}
`;

  try {
    const content = await callAiChat(prompt, 2048, options.provider);
    return parseJsonFromAI(content);
  } catch (error) {
    logger.error('Job recommendations AI failed', { message: error.message });
    return { ...FALLBACK_JOBS };
  }
}

module.exports = {
  AI_PROVIDERS,
  resolveAiProvider,
  getAvailableProviders,
  getProviderAvailability,
  verifyHfConnection,
  analyzeResumeWithAI,
  generateResumeInsights,
  generateCourseRecommendations,
  generateJobRecommendations,
};
