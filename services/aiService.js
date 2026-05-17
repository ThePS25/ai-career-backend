const axios = require('axios');
const { hfApiKey, hfChatUrl, hfModel } = require('../config/env');

function parseJsonFromAI(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

async function callHuggingFaceChat(prompt, maxTokens = 1024) {
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
      timeout: 120000,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response');
  }
  return content;
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

  return callHuggingFaceChat(prompt);
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

  const content = await callHuggingFaceChat(prompt, 2048);
  return parseJsonFromAI(content);
}

module.exports = { analyzeResumeWithAI, generateResumeInsights };
