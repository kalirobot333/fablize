const { backoff } = require('./retry');

function createClient(config) {
  return {
    request(path) {
      return { url: config.baseUrl + path, timeout: config.timeout };
    },
    delays() {
      return Array.from({ length: config.retries }, (_, i) => backoff(config, i));
    },
  };
}

module.exports = { createClient };
