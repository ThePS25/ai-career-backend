const PDFDocument = require('pdfkit');

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
    doc.text(`File: ${resume.fileName || 'N/A'}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    addSectionTitle(doc, 'ATS Score');
    doc.text(`${resume.atsScore ?? 'N/A'} / 100`);

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

    addSectionTitle(doc, 'Improvements');
    if (resume.improvements?.summaryRewrite) {
      doc.text('Professional Summary Rewrite:');
      doc.text(resume.improvements.summaryRewrite);
      doc.moveDown(0.25);
    }
    if (resume.improvements?.improvedBullets?.length) {
      doc.text('Improved Bullets:');
      addBulletList(doc, resume.improvements.improvedBullets);
    }

    addSectionTitle(doc, 'AI Analysis');
    doc.text(resume.aiAnalysis || 'No analysis available.', { align: 'left' });

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
