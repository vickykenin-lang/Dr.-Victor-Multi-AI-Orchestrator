import test from 'node:test';
import assert from 'node:assert/strict';
import { routePolicy, VERSION, MAX_TELEGRAM_BODY_BYTES, HEALTH_PATHS } from './worker.js';

test('allows only intended Telegram and health routes', () => {
  assert.equal(routePolicy('POST', '/telegram'), 'TELEGRAM');
  assert.equal(routePolicy('GET', '/proxy-health'), 'PROXY_HEALTH');
  assert.equal(routePolicy('GET', '/health'), 'UPSTREAM_HEALTH');
  assert.equal(routePolicy('GET', '/v2-health'), 'UPSTREAM_HEALTH');
  assert.equal(routePolicy('GET', '/telegram-webhook-health'), 'UPSTREAM_HEALTH');
});

test('fails closed for unintended methods and routes', () => {
  assert.equal(routePolicy('GET', '/telegram'), 'DENY');
  assert.equal(routePolicy('POST', '/health'), 'DENY');
  assert.equal(routePolicy('PUT', '/telegram'), 'DENY');
  assert.equal(routePolicy('GET', '/admin'), 'DENY');
  assert.equal(routePolicy('POST', '/proxy-health'), 'DENY');
});

test('proxy constants remain bounded', () => {
  assert.equal(VERSION, 'VICTOR_EDGE_PROXY_V1');
  assert.equal(MAX_TELEGRAM_BODY_BYTES, 1024 * 1024);
  assert.ok(HEALTH_PATHS.has('/endgame-runtime-health'));
  assert.ok(HEALTH_PATHS.has('/core-health'));
  assert.ok(HEALTH_PATHS.has('/aura3-bridge-health'));
  assert.ok(HEALTH_PATHS.has('/tony-bridge-health'));
});
