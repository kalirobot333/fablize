const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadConfig } = require('../src/config');
const { createClient } = require('../src/client');

test('defaults load', () => {
  const c = loadConfig();
  assert.equal(c.baseUrl, 'http://localhost:8080');
  assert.equal(c.retries, 2);
});

test('flags override env', () => {
  const c = loadConfig({ env: { APP_RETRIES: '5' }, argv: ['--retries=7'] });
  assert.equal(c.retries, 7);
});

test('client builds urls', () => {
  const client = createClient(loadConfig());
  assert.equal(client.request('/x').url, 'http://localhost:8080/x');
});
