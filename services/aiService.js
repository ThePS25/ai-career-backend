const axios = require('axios');
const {
  hfApiKey,
  hfChatUrl,
  hfModel,
  hfTimeoutMs,
  hfMaxRetries,
} = require('../config/env');
const logger = require('../utils/logger');

const FALLBACK_ANALYSIS = `Resume analysis is temporarily unavailable. Please try again later.

Suggested next steps:
- Review formatting and section completeness
- Add measurable achievements to experience bullets
- Align skills with target job descriptions`;

const FALLBACK_INSIGHTS = {
  atsScore: 50,
  sections: {
    hasSummary: false,
    hasProjects: false,
    hasExperience: false,
    hasEducation: false,
    hasSkills: false,
    hasCertifications: false,
  },
  skills: { technical: [], soft: [], tools: [] },
  strengths: ['Resume uploaded successfully'],
  weaknesses: ['AI analysis temporarily unavailable — try re-analyzing later'],
  improvements: {
    improvedBullets: [],
    summaryRewrite: 'AI summary unavailable. Please re-analyze when the service is available.',
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

function parseJsonFromAI(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callHuggingFaceChat(prompt, maxTokens = 1024) {
  let lastError;

  for (let attempt = 0; attempt <= hfMaxRetries; attempt += 1) {
    try {
      const response = await axios.post(
        hfChatUrl,
        {
          model: hfModel,
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
      const isRetryable =
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        (error.response?.status >= 500 && error.response?.status < 600);

      if (attempt < hfMaxRetries && isRetryable) {
        const delay = 1000 * (attempt + 1);
        logger.warn(`HF API attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

async function analyzeResumeWithAI(resumeText) {
  const prompt = `You are an expert tech recruiter.

Analyze the resume and provide:
1. Resume feedback
2. 5 HR interview questions
3. 5 Technical interview questions
4. Career roadmap
5. Skill gaps

Resume:
${resumeText}`;

  try {
    return await callHuggingFaceChat(prompt);
  } catch (error) {
    logger.error('Resume analysis AI failed', { message: error.message });
    return FALLBACK_ANALYSIS;
  }
}

async function generateResumeInsights(resumeText) {
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
    const content = await callHuggingFaceChat(prompt, 2048);
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

async function generateCourseRecommendations(resumeDoc) {
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
    const content = await callHuggingFaceChat(prompt, 2048);
    return parseJsonFromAI(content);
  } catch (error) {
    logger.error('Course recommendations AI failed', { message: error.message });
    return { ...FALLBACK_COURSES };
  }
}

async function generateJobRecommendations(resumeDoc) {
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
    const content = await callHuggingFaceChat(prompt, 2048);
    return parseJsonFromAI(content);
  } catch (error) {
    logger.error('Job recommendations AI failed', { message: error.message });
    return { ...FALLBACK_JOBS };
  }
}

module.exports = {
  analyzeResumeWithAI,
  generateResumeInsights,
  generateCourseRecommendations,
  generateJobRecommendations,
};
