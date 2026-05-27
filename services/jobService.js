const { generateJobRecommendations } = require('./aiService');
const { fetchJobsFromJSearch } = require('./jobProviders/jsearchProvider');
const {
  buildSearchKeyword,
  fetchJobsFromPortals,
  fetchJSearchJobsForRoles,
  fetchJSearchJobs,
  isJSearchConfigured,
  dedupeJobs,
} = require('./externalJobService');

function hasCachedJobs(resume) {
  return resume.jobRecommendations?.jobs?.length > 0;
}

function mergeAiJobs(portalJobs, aiPayload) {
  const aiJobs = (aiPayload?.jobs || []).map((job) => ({
    ...job,
    source: job.source || 'ai',
    jobUrl: job.jobUrl || '',
  }));

  const seen = new Set(portalJobs.map((j) => `${j.title}|${j.company}`.toLowerCase()));
  const merged = [...portalJobs];

  for (const job of aiJobs) {
    const key = `${job.title}|${job.company}`.toLowerCase();
    if (!seen.has(key) && merged.length < 5) {
      seen.add(key);
      merged.push(job);
    }
  }

  return { jobs: merged.slice(0, 5) };
}

async function searchJobs(query, location) {
  if (!query?.trim()) {
    return [];
  }
  return fetchJobsFromJSearch(query.trim(), location || 'India', 1);
}

async function fetchLiveJobsForRoles(resume, roleTitles) {
  const fetches = [fetchJobsFromPortals(resume)];

  if (roleTitles.length && isJSearchConfigured()) {
    fetches.unshift(fetchJSearchJobsForRoles(roleTitles, resume));
  }

  const results = await Promise.allSettled(fetches);
  let jobs = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      jobs = jobs.concat(result.value);
    } else {
      console.warn('Live job fetch failed:', result.reason?.message || result.reason);
    }
  }

  jobs = dedupeJobs(jobs);

  if (jobs.length < 5 && isJSearchConfigured()) {
    try {
      const keyword = buildSearchKeyword(resume);
      const extra = await fetchJSearchJobs(keyword, resume, 5 - jobs.length);
      jobs = dedupeJobs([...jobs, ...extra]);
    } catch (err) {
      console.warn('JSearch keyword fallback failed:', err.message);
    }
  }

  return jobs;
}

async function buildJobRecommendations(resume, options = {}) {
  let aiPayload = { jobs: [] };

  try {
    aiPayload = await generateJobRecommendations(resume, options);
  } catch (err) {
    console.warn('AI role suggestions failed:', err.message);
  }

  const roleTitles = (aiPayload?.jobs || []).map((j) => j.title).filter(Boolean);

  let liveJobs = [];
  try {
    liveJobs = await fetchLiveJobsForRoles(resume, roleTitles);
  } catch (err) {
    console.warn('Live job aggregation failed:', err.message);
  }

  if (liveJobs.length >= 5) {
    return { jobs: liveJobs.slice(0, 5) };
  }

  if (liveJobs.length > 0) {
    return { jobs: liveJobs };
  }

  if (aiPayload?.jobs?.length) {
    return mergeAiJobs([], aiPayload);
  }

  throw new Error('Unable to generate job recommendations');
}

async function ensureJobRecommendations(resume, options = {}) {
  if (hasCachedJobs(resume)) {
    return resume.jobRecommendations;
  }

  const recommendations = await buildJobRecommendations(resume, options);
  resume.jobRecommendations = recommendations;
  await resume.save();
  return resume.jobRecommendations;
}

module.exports = {
  ensureJobRecommendations,
  buildJobRecommendations,
  searchJobs,
};
