const PDF_FONT_WARNINGS = /TT:\s*undefined function/i;

function suppressPdfFontWarnings() {
  const originalWarn = console.warn;

  console.warn = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && PDF_FONT_WARNINGS.test(first)) {
      return;
    }
    originalWarn.apply(console, args);
  };

  return () => {
    console.warn = originalWarn;
  };
}

async function extractTextFromPDF(buffer) {
  const pdfParse = require('pdf-parse');
  const restoreWarn = suppressPdfFontWarnings();

  try {
    const { text } = await pdfParse(buffer);
    return text?.trim() || '';
  } finally {
    restoreWarn();
  }
}

module.exports = { extractTextFromPDF };
