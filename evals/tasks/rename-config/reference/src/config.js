const defaults = require('../defaults.json');

const ENV_KEYS = {
  APP_BASE_URL: 'baseUrl',
  APP_REQUEST_TIMEOUT: 'requestTimeout',
  APP_RETRIES: 'retries',
};

// Old name -> new name, for each kind of source.
const DEPRECATED = {
  file: { timeout: 'requestTimeout' },
  env: { APP_TIMEOUT: 'requestTimeout' },
  flag: { timeout: 'requestTimeout' },
};

const NUMERIC = new Set(['requestTimeout', 'retries']);

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

function migrate(source, kind, label) {
  const out = { ...source };
  for (const [oldKey, newKey] of Object.entries(DEPRECATED[kind])) {
    if (out[oldKey] === undefined) continue;
    console.warn(`${label} "${oldKey}" is deprecated; use "${newKey}" instead.`);
    if (out[newKey] === undefined) out[newKey] = out[oldKey];
    delete out[oldKey];
  }
  return out;
}

function coerce(config) {
  for (const key of NUMERIC) {
    if (config[key] !== undefined) config[key] = Number(config[key]);
  }
  return config;
}

function loadConfig({ fileConfig = {}, env = {}, argv = [] } = {}) {
  const fromEnv = {};
  for (const [name, key] of Object.entries(ENV_KEYS)) {
    if (env[name] !== undefined) fromEnv[key] = env[name];
  }
  for (const [name, key] of Object.entries(DEPRECATED.env)) {
    if (env[name] === undefined) continue;
    console.warn(`Environment variable ${name} is deprecated; use APP_REQUEST_TIMEOUT instead.`);
    if (fromEnv[key] === undefined) fromEnv[key] = env[name];
  }
  const flags = parseFlags(argv);
  return coerce({
    ...defaults,
    ...migrate(fileConfig, 'file', 'Config key'),
    ...fromEnv,
    ...migrate(flags, 'flag', 'Flag --'),
  });
}

module.exports = { loadConfig };
