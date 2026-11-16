#!/usr/bin/env node
// Prints the effective config. Example: node cli.js --timeout=2000
const { loadConfig } = require('./src/config');
const { createClient } = require('./src/client');

const config = loadConfig({ env: process.env, argv: process.argv.slice(2) });
const client = createClient(config);
console.log(JSON.stringify({ config, sample: client.request('/health'), delays: client.delays() }, null, 2));
