async function extractTextFromPDF(buffer) {
  const pdfParse = require('pdf-parse');
  const { text } = await pdfParse(buffer);
  return text;
}

module.exports = { extractTextFromPDF };
