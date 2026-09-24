import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTruthGuardFallback, classifyProcessingError, isAuthorizedFounderMessage, shouldRunDeadEndRecovery } from './worker.js';
import { validateVictorReply } from './core_rules.mjs';

test('classifies AI upstream HTTP errors without exposing credentials', () => {
  const error = new Error('Victor AI upstream HTTP 401');
  error.code = 'AI_UPSTREAM_HTTP_ERROR';
  error.upstreamHttpStatus = 401;

  const result = classifyProcessingError(error, 'AI_INFERENCE');

  assert.equal(result.category, 'AI_UPSTREAM_HTTP_ERROR');
  assert.equal(result.upstreamHttpStatus, 401);
  assert.match(result.founderMessage('tg-1-2'), /HTTP 401/);
  assert.match(result.founderMessage('tg-1-2'), /Trace: tg-1-2/);
});

test('classifies truth guard rejection separately from core failure', () => {
  const error = new Error('rejected');
  error.code = 'TRUTH_GUARD_REJECTED';

  const result = classifyProcessingError(error, 'AI_INFERENCE');

  assert.equal(result.category, 'TRUTH_GUARD_REJECTED');
  assert.match(result.founderMessage('tg-3-4'), /truth verification/);
});

test('uses processing stage for uncoded Telegram delivery errors', () => {
  const result = classifyProcessingError(new Error('send failed'), 'TELEGRAM_DELIVERY');

  assert.equal(result.category, 'TELEGRAM_DELIVERY_FAILED');
});

test('builds a validator-safe deterministic fallback for generic status checks', () => {
  const truth = {
    request_facts: { telegram_message_received_now: true },
  };

  const reply = buildTruthGuardFallback('SYSTEM_QUERY', truth);

  assert.match(reply, /canonical core context loaded/i);
  assert.equal(validateVictorReply(reply, 'SYSTEM_QUERY', truth).ok, true);
});

test('builds a validator-safe canonical department fallback', () => {
  const truth = {
    request_facts: { telegram_message_received_now: true },
    resolved_department: {
      id: 'rio',
      name: 'RIO',
      registry_status: 'PARKED',
      victor_connection: 'NOT_VERIFIED',
    },
  };

  const reply = buildTruthGuardFallback('SYSTEM_QUERY', truth);

  assert.match(reply, /RIO ka canonical status PARKED/);
  assert.equal(validateVictorReply(reply, 'SYSTEM_QUERY', truth).ok, true);
});

test('builds useful organization status instead of repeating a generic fallback', () => {
  const truth = {
    request_facts: { telegram_message_received_now: true },
    departments: [
      { id: 'rio', registry_status: 'ACTIVE_GOVERNED' },
      { id: 'aura3', registry_status: 'LIVE_CERTIFIED' },
      { id: 'aura2', registry_status: 'HOLD' },
      { id: 'tony_stark', registry_status: 'MANAGED_DIAGNOSTIC' },
      { id: 'hulk', registry_status: 'MANDATE_LOCKED_RESEARCH_START' },
      { id: 'oracle', registry_status: 'UNVERIFIED' },
    ],
  };
  const reply = buildTruthGuardFallback('SYSTEM_QUERY', truth, 'Sabka status batao');
  assert.match(reply, /RIO ACTIVE_GOVERNED/);
  assert.match(reply, /AURA3 LIVE_CERTIFIED/);
  assert.match(reply, /baaki 1 departments UNVERIFIED/);
  assert.equal(validateVictorReply(reply, 'SYSTEM_QUERY', truth).ok, true);
});

test('authorizes Founder in private chat and management group only', () => {
  const env = { VICTOR_FOUNDER_CHAT_ID: '123', TELEGRAM_MANAGEMENT_CHAT_ID: '-999' };
  assert.equal(isAuthorizedFounderMessage(env, '123', '123'), true);
  assert.equal(isAuthorizedFounderMessage(env, '-999', '123'), true);
  assert.equal(isAuthorizedFounderMessage(env, '-999', '456'), false);
  assert.equal(isAuthorizedFounderMessage(env, '-888', '123'), false);
});

test('explicit organization goal command bypasses repeated-answer recovery', () => {
  const repeatedDeadEnd = { matched: true, target: 'tony_stark' };

  assert.equal(shouldRunDeadEndRecovery(false, true, repeatedDeadEnd), false);
  assert.equal(shouldRunDeadEndRecovery(false, false, repeatedDeadEnd), true);
});
