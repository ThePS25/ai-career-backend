function isAiOverloadError(err) {
  const cause = err?.cause || err;
  const status = cause?.response?.status;
  const message = (err?.message || '').toLowerCase();

  return (
    status === 429 ||
    message.includes('overloaded') ||
    message.includes('429') ||
    message.includes('high demand')
  );
}

function sendBusyResponse(res) {
  return res.status(503).json({
    success: false,
    message:
      'AI service is busy due to high demand. Please wait a few minutes and try again.',
  });
}

module.exports = { isAiOverloadError, sendBusyResponse };
