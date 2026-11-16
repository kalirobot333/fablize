// Exponential backoff, never longer than one request is allowed to take.
function backoff(cfg, attempt) {
  const limit = cfg.requestTimeout;
  return Math.min(limit, 100 * 2 ** attempt);
}

module.exports = { backoff };
