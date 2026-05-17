const axios = require('axios');
const cheerio = require('cheerio');
const { fetchJobsFromJSearch } = require('./jobProviders/jsearchProvider');

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/json,application/xhtml+xml',
  'Accept-Language': 'en-IN,en;q=0.9',
};

function buildSearchKeyword(resumeDoc) {
  const technical = resumeDoc.skills?.technical || [];
  const tools = resumeDoc.skills?.tools || [];
  const combined = [...technical, ...tools].filter(Boolean);

  if (combined.length >= 2) {
    return combined.slice(0, 2).join(' ');
  }
  if (combined.length === 1) {
    return combined[0];
  }
  return 'software developer';
}

function getResumeSkills(resumeDoc) {
  return [
    ...(resumeDoc.skills?.technical || []),
    ...(resumeDoc.skills?.soft || []),
    ...(resumeDoc.skills?.tools || []),
  ];
}

function computeMatchScore(resumeDoc, jobText) {
  const skills = getResumeSkills(resumeDoc);
  if (!skills.length) return 72;

  const haystack = (jobText || '').toLowerCase();
  const matched = skills.filter((skill) => haystack.includes(skill.toLowerCase()));
  const ratio = matched.length / skills.length;
  return Math.min(98, Math.max(58, Math.round(55 + ratio * 45)));
}

function normalizeJob({
  title,
  company,
  location,
  jobCode,
  reason,
  requiredSkills,
  matchScore,
  source,
  jobUrl,
}) {
  return {
    title: title || 'Job Opening',
    jobCode: jobCode || `${source?.toUpperCase()}-ROLE`,
    company: company || 'Company not listed',
    location: location || 'India',
    matchScore: matchScore ?? 70,
    reason: reason || 'Matched based on your resume skills and experience.',
    requiredSkills: requiredSkills || [],
    source,
    jobUrl: jobUrl || '',
  };
}

async function fetchNaukriJobs(keyword, resumeDoc) {
  const headers = {
    ...BROWSER_HEADERS,
    Accept: 'application/json',
    appid: '109',
    systemid: 'Naukri',
    clientid: 'd3skt0p',
  };

  if (process.env.NAUKRI_NKPARAM) {
    headers.nkparam = process.env.NAUKRI_NKPARAM;
  }

  const { data } = await axios.get('https://www.naukri.com/jobapi/v3/search', {
    params: {
      noOfResults: 8,
      urlType: 'search_by_keyword',
      searchType: 'adv',
      keyword,
      page: 1,
    },
    headers,
    timeout: 20000,
  });

  const listings = data?.jobs || data?.jobDetails || [];
  return listings.slice(0, 5).map((job) => {
    const jobId = job.jobId || job.jobId?.toString?.() || job.id;
    const jdPath = job.jdURL || job.staticUrl || '';
    const jobUrl = jdPath.startsWith('http')
      ? jdPath
      : jdPath
        ? `https://www.naukri.com${jdPath}`
        : jobId
          ? `https://www.naukri.com/job-listings-${jobId}`
          : 'https://www.naukri.com';

    const location =
      job.location ||
      job.placeholders?.find((p) => p.type === 'location')?.label ||
      job.footerPlaceholderLabel ||
      'India';

    const experience = job.minimumExperience
      ? `${job.minimumExperience}-${job.maximumExperience || job.minimumExperience + 2} yrs`
      : job.experienceText || '';

    const salary = job.salaryDetail?.label || job.salary || '';
    const jobText = [job.title, job.companyName, job.tagsAndSkills, experience, salary]
      .filter(Boolean)
      .join(' ');

    const skillsFromJob = (job.tagsAndSkills || job.keySkills || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    return normalizeJob({
      title: job.title,
      company: job.companyName || job.company,
      location,
      jobCode: jobId ? `NAUKRI-${jobId}` : `NAUKRI-${Date.now()}`,
      reason: `Live listing on Naukri matching "${keyword}".${experience ? ` Experience: ${experience}.` : ''}${salary ? ` ${salary}.` : ''}`,
      requiredSkills: skillsFromJob.length ? skillsFromJob : [keyword],
      matchScore: computeMatchScore(resumeDoc, jobText),
      source: 'naukri',
      jobUrl,
    });
  });
}

function isJSearchConfigured() {
  return Boolean(process.env.RAPIDAPI_KEY);
}

function extractSkillsFromText(text, fallback) {
  const skills = [
    ...new Set(
      (text.match(
        /\b(JavaScript|TypeScript|React|Node\.?js|Python|Java|AWS|SQL|Angular|DevOps|Kubernetes|Docker|MongoDB|PostgreSQL|Go|Rust|C\+\+|\.NET|Azure|GCP)\b/gi
      ) || []).map((s) => s.trim())
    ),
  ].slice(0, 6);
  return skills.length ? skills : [fallback];
}

function jsearchJobToRecommendation(job, keyword, resumeDoc) {
  const description = (job.description || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const jobText = [job.title, job.company, job.location, description, job.salary, job.jobType]
    .filter(Boolean)
    .join(' ');

  return normalizeJob({
    title: job.title,
    company: job.company,
    location: job.location,
    jobCode: job.id ? `JSEARCH-${job.id}` : `JSEARCH-${Date.now()}`,
    reason: description
      ? `Live listing via JSearch for "${keyword}": ${description.slice(0, 180)}${description.length > 180 ? '…' : ''}`
      : `Live listing via JSearch matching "${keyword}".`,
    requiredSkills: extractSkillsFromText(description, keyword),
    matchScore: computeMatchScore(resumeDoc, jobText),
    source: 'jsearch',
    jobUrl: job.applyUrl || '',
  });
}

async function fetchJSearchJobs(keyword, resumeDoc, limit = 5) {
  if (!isJSearchConfigured()) {
    return [];
  }

  const location = process.env.JSEARCH_LOCATION || 'India';
  const jobs = await fetchJobsFromJSearch(keyword, location, 1);
  return jobs.slice(0, limit).map((job) => jsearchJobToRecommendation(job, keyword, resumeDoc));
}

async function fetchJSearchJobsForRoles(roleTitles, resumeDoc) {
  if (!isJSearchConfigured()) {
    return [];
  }

  const uniqueTitles = [...new Set(roleTitles.map((t) => t.trim()).filter(Boolean))].slice(0, 5);
  if (!uniqueTitles.length) {
    return [];
  }

  const perRole = Math.max(1, Math.ceil(8 / uniqueTitles.length));
  const results = await Promise.allSettled(
    uniqueTitles.map((title) => fetchJSearchJobs(title, resumeDoc, perRole))
  );

  let jobs = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      jobs = jobs.concat(result.value);
    } else {
      console.warn('JSearch role search failed:', result.reason?.message || result.reason);
    }
  }

  return dedupeJobs(jobs);
}

async function fetchIndeedJobs(keyword, resumeDoc) {
  const { data: html } = await axios.get('https://in.indeed.com/jobs', {
    params: {
      q: keyword,
      l: 'India',
      sort: 'date',
    },
    headers: BROWSER_HEADERS,
    timeout: 20000,
  });

  const $ = cheerio.load(html);
  const jobs = [];

  $('div.job_seen_beacon, div.slider_item, div.cardOutline').each((_, element) => {
    if (jobs.length >= 5) return false;

    const root = $(element);
    const titleEl = root.find('h2.jobTitle a, h2 a.jcs-JobTitle, a[data-jk] span').first();
    const title =
      titleEl.attr('title')?.trim() ||
      titleEl.text().trim() ||
      root.find('h2').first().text().trim();

    if (!title) return;

    const company =
      root.find('[data-testid="company-name"]').text().trim() ||
      root.find('span.companyName').text().trim() ||
      root.find('.company').text().trim() ||
      'Company not listed';

    const location =
      root.find('[data-testid="text-location"]').text().trim() ||
      root.find('div.companyLocation').text().trim() ||
      'India';

    const jobKey =
      root.find('h2.jobTitle a').attr('data-jk') ||
      root.find('a[data-jk]').attr('data-jk') ||
      root.find('a.jcs-JobTitle').attr('data-jk');

    const snippet =
      root.find('.job-snippet').text().trim() ||
      root.find('[data-testid="job-snippet"]').text().trim() ||
      '';

    const jobUrl = jobKey
      ? `https://in.indeed.com/viewjob?jk=${jobKey}`
      : 'https://in.indeed.com/jobs?q=' + encodeURIComponent(keyword);

    const jobText = [title, company, location, snippet].join(' ');

    jobs.push(
      normalizeJob({
        title,
        company,
        location,
        jobCode: jobKey ? `INDEED-${jobKey}` : `INDEED-${jobs.length + 1}`,
        reason: snippet
          ? `Live listing on Indeed: ${snippet.slice(0, 180)}`
          : `Live listing on Indeed for "${keyword}".`,
        requiredSkills: snippet
          .match(/\b(JavaScript|React|Node|Python|Java|AWS|SQL|TypeScript|Angular|DevOps)\b/gi)
          ?.slice(0, 6) || [keyword],
        matchScore: computeMatchScore(resumeDoc, jobText),
        source: 'indeed',
        jobUrl,
      })
    );
  });

  return jobs;
}

function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchJobsFromPortals(resumeDoc) {
  const keyword = buildSearchKeyword(resumeDoc);
  const resumeSkills = getResumeSkills(resumeDoc);

  const results = await Promise.allSettled([
    fetchJSearchJobs(keyword, resumeDoc),
    fetchNaukriJobs(keyword, resumeDoc),
    fetchIndeedJobs(keyword, resumeDoc),
  ]);

  let jobs = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      jobs = jobs.concat(result.value);
    } else {
      console.warn('Job portal fetch failed:', result.reason?.message || result.reason);
    }
  }

  jobs = dedupeJobs(jobs).map((job) => ({
    ...job,
    matchScore: computeMatchScore(
      { skills: { technical: resumeSkills, soft: [], tools: [] } },
      [job.title, job.company, job.reason, ...(job.requiredSkills || [])].join(' ')
    ),
  }));

  return jobs.slice(0, 5);
}

module.exports = {
  buildSearchKeyword,
  fetchJobsFromPortals,
  fetchJSearchJobs,
  fetchJSearchJobsForRoles,
  isJSearchConfigured,
  fetchNaukriJobs,
  fetchIndeedJobs,
  dedupeJobs,
};
