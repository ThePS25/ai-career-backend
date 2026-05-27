function getRequestedAiProvider(req) {
  const headerProvider = req.headers['x-ai-provider'];
  if (typeof headerProvider === 'string' && headerProvider.trim()) {
    return headerProvider.trim().toLowerCase();
  }

  if (typeof req.body?.aiProvider === 'string' && req.body.aiProvider.trim()) {
    return req.body.aiProvider.trim().toLowerCase();
  }

  if (typeof req.query?.aiProvider === 'string' && req.query.aiProvider.trim()) {
    return req.query.aiProvider.trim().toLowerCase();
  }

  return undefined;
}

module.exports = { getRequestedAiProvider };
