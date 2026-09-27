import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdgeProxyControl, parseEdgeProxyControlCommand, EDGE_PROXY_WEBHOOK_URL, PRIMARY_WEBHOOK_URL } from './edge_proxy_control.mjs';

test('parses only exact cutover and rollback commands', () => {
  assert.deepEqual(parseEdgeProxyControlCommand('VICTOR EDGE PROXY CUTOVER'), { action: 'CUTOVER', target_url: EDGE_PROXY_WEBHOOK_URL });
  assert.deepEqual(parseEdgeProxyControlCommand(' victor edge proxy rollback '), { action: 'ROLLBACK', target_url: PRIMARY_WEBHOOK_URL });
  assert.equal(parseEdgeProxyControlCommand('cutover proxy'), null);
  assert.equal(parseEdgeProxyControlCommand('VICTOR EDGE PROXY CUTOVER NOW'), null);
});

test('fails closed when Telegram control configuration is incomplete', async () => {
  const result = await applyEdgeProxyControl({}, parseEdgeProxyControlCommand('VICTOR EDGE PROXY CUTOVER'), async () => { throw new Error('should not call'); });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'CONFIGURATION_INCOMPLETE');
  assert.equal(result.secrets_exposed, false);
});

test('uses existing secret token without exposing it', async () => {
  let request;
  const fakeFetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const env = { TELEGRAM_BOT_TOKEN_VICTOR: 'bot-secret', TELEGRAM_WEBHOOK_SECRET: 'hook-secret' };
  const result = await applyEdgeProxyControl(env, parseEdgeProxyControlCommand('VICTOR EDGE PROXY CUTOVER'), fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'EDGE_PROXY_CUTOVER_APPLIED');
  assert.equal(result.target_url, EDGE_PROXY_WEBHOOK_URL);
  assert.equal(result.secrets_exposed, false);
  assert.match(request.url, /\/setWebhook$/);
  const payload = JSON.parse(request.init.body);
  assert.equal(payload.url, EDGE_PROXY_WEBHOOK_URL);
  assert.equal(payload.secret_token, 'hook-secret');
  assert.equal(payload.drop_pending_updates, false);
  assert.equal(JSON.stringify(result).includes('bot-secret'), false);
  assert.equal(JSON.stringify(result).includes('hook-secret'), false);
});
