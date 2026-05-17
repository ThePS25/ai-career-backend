const PDFDocument = require('pdfkit');

function sanitizeText(value) {
  if (value == null) return '';
  return String(value).replace(/\0/g, '').trim();
}

function addSectionTitle(doc, title) {
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text(title);
  doc.moveDown(0.25);
  doc.fontSize(10).font('Helvetica');
}

function addBulletList(doc, items) {
  if (!items?.length) {
    doc.text('None');
    return;
  }
  items.forEach((item) => doc.text(`• ${item}`));
}

function generateReportPdf(resume) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text('Resume Analysis Report');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`File: ${sanitizeText(resume.fileName) || 'N/A'}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    addSectionTitle(doc, 'ATS Score');
    doc.text(`${resume.atsScore ?? 'N/A'} / 100`);

    addSectionTitle(doc, 'Summary');
    const summaryText = sanitizeText(resume.improvements?.summaryRewrite);
    if (summaryText) {
      doc.text(summaryText, { align: 'left', lineGap: 2 });
    } else {
      doc.text('No professional summary available.');
    }

    addSectionTitle(doc, 'Resume Sections');
    const sections = resume.sections || {};
    Object.entries(sections).forEach(([key, present]) => {
      const label = key.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim();
      doc.text(`${label}: ${present ? 'Yes' : 'No'}`);
    });

    addSectionTitle(doc, 'Skills');
    doc.text(`Technical: ${(resume.skills?.technical || []).join(', ') || 'None'}`);
    doc.text(`Soft: ${(resume.skills?.soft || []).join(', ') || 'None'}`);
    doc.text(`Tools: ${(resume.skills?.tools || []).join(', ') || 'None'}`);

    addSectionTitle(doc, 'Strengths');
    addBulletList(doc, resume.strengths);

    addSectionTitle(doc, 'Weaknesses');
    addBulletList(doc, resume.weaknesses);

    addSectionTitle(doc, 'Suggested Improvements');
    if (resume.improvements?.improvedBullets?.length) {
      doc.text('Improved achievement bullets:');
      addBulletList(doc, resume.improvements.improvedBullets);
    } else {
      doc.text('No bullet improvements suggested.');
    }

    addSectionTitle(doc, 'AI Analysis');
    doc.text(sanitizeText(resume.aiAnalysis) || 'No analysis available.', {
      align: 'left',
    });

    addSectionTitle(doc, 'Recommended Jobs');
    const jobs = resume.jobRecommendations?.jobs || [];
    if (!jobs.length) {
      doc.text('No job recommendations available.');
    } else {
      jobs.forEach((job, index) => {
        doc.font('Helvetica-Bold').text(`${index + 1}. ${job.title}`);
        doc.font('Helvetica-Bold').fillColor('#3f4bd8');
        doc.text(`Job Code: ${sanitizeText(job.jobCode) || 'N/A'}`);
        doc.text(`Company: ${sanitizeText(job.company) || 'N/A'}`);
        doc.text(`Source: ${sanitizeText(job.source) || 'N/A'}`);
        if (job.jobUrl) {
          doc.text(`Apply: ${sanitizeText(job.jobUrl)}`);
        }
        doc.fillColor('#000000').font('Helvetica');
        doc.text(`Location: ${job.location || 'N/A'}`);
        doc.text(`Match score: ${job.matchScore ?? 'N/A'}%`);
        doc.text(`Required skills: ${(job.requiredSkills || []).join(', ') || 'N/A'}`);
        doc.text(`Why recommended: ${job.reason || 'N/A'}`);
        doc.moveDown(0.5);
      });
    }

    addSectionTitle(doc, 'Recommended Courses');
    const courses = resume.courseRecommendations?.courses || [];
    if (!courses.length) {
      doc.text('No course recommendations available.');
    } else {
      courses.forEach((course, index) => {
        doc.font('Helvetica-Bold').text(`${index + 1}. ${course.title}`);
        doc.font('Helvetica');
        doc.text(`Platform: ${course.platform || 'N/A'}`);
        doc.text(`Skills covered: ${(course.skillsCovered || []).join(', ') || 'N/A'}`);
        doc.text(`Why recommended: ${course.reason || 'N/A'}`);
        doc.moveDown(0.5);
      });
    }

    doc.end();
  });
}

module.exports = { generateReportPdf };
