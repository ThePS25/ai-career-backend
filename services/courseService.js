const { generateCourseRecommendations } = require('./aiService');

function hasCachedCourses(resume) {
  return resume.courseRecommendations?.courses?.length > 0;
}

async function ensureCourseRecommendations(resume, options = {}) {
  if (hasCachedCourses(resume)) {
    return resume.courseRecommendations;
  }

  const recommendations = await generateCourseRecommendations(resume, options);
  resume.courseRecommendations = recommendations;
  await resume.save();
  return resume.courseRecommendations;
}

module.exports = { ensureCourseRecommendations };
