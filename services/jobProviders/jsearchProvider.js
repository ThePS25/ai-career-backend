const axios = require('axios');

const BASE_URL = 'https://jsearch.p.rapidapi.com/search';

/**
 * @param {unknown[]} apiJobs
 * @returns {import('../../types/job').Job[]}
 */
function normalizeJobs(apiJobs) {
  if (!Array.isArray(apiJobs)) {
    return [];
  }

  return apiJobs.map((job) => ({
    id: job.job_id,
    title: job.job_title,
    company: job.employer_name,
    location: job.job_city || job.job_country || 'Remote',
    description: job.job_description,
    applyUrl: job.job_apply_link,
    salary: job.job_salary || undefined,
    jobType: job.job_employment_type,
    postedAt: job.job_posted_at_datetime_utc,
    source: 'JSearch',
  }));
}

/**
 * @param {string} query
 * @param {string} [location]
 * @param {number} [page]
 * @returns {Promise<import('../../types/job').Job[]>}
 */
async function fetchJobsFromJSearch(query, location = 'India', page = 1) {
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'jsearch.p.rapidapi.com';

  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        query,
        location,
        page,
        num_pages: 1,
      },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
      timeout: 20000,
    });

    return normalizeJobs(response.data?.data);
  } catch (error) {
    console.error('JSearch API error:', error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  fetchJobsFromJSearch,
  normalizeJobs,
};
