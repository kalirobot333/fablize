const defaults = require('../defaults.json');

const ENV_KEYS = {
  APP_BASE_URL: 'baseUrl',
  APP_TIMEOUT: 'timeout',
  APP_RETRIES: 'retries',
};

const NUMERIC = new Set(['timeout', 'retries']);

function parseFlags(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = m[2];
  }
  return out;
}

function coerce(config) {
  for (const key of NUMERIC) {
    if (config[key] !== undefined) config[key] = Number(config[key]);
  }
  return config;
}

/**
 * Build the effective config. Later sources win:
 * defaults.json < fileConfig < environment < CLI flags.
 */
function loadConfig({ fileConfig = {}, env = {}, argv = [] } = {}) {
  const fromEnv = {};
  for (const [name, key] of Object.entries(ENV_KEYS)) {
    if (env[name] !== undefined) fromEnv[key] = env[name];
  }
  return coerce({ ...defaults, ...fileConfig, ...fromEnv, ...parseFlags(argv) });
}

module.exports = { loadConfig };
