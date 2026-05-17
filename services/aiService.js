const axios = require('axios');
const { hfApiKey, hfChatUrl, hfModel } = require('../config/env');

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

  const response = await axios.post(
    hfChatUrl,
    {
      model: hfModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
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

module.exports = { analyzeResumeWithAI };
