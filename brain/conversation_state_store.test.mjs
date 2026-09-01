import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conversationStateCapability,
  readConversationState,
  writeConversationState,
  assertDurableConversationState,
} from './conversation_state_store.mjs';

function fakeBinding(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    async get(key, options = {}) {
      if (!map.has(key)) return null;
      const value = map.get(key);
      return options?.type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { map.set(key, value); },
    map,
  };
}

test('reports durable capability only when explicit get/put binding exists', () => {
  assert.equal(conversationStateCapability({}).durable, false);
  assert.equal(conversationStateCapability({ VICTOR_CONVERSATION_STATE: fakeBinding() }).durable, true);
});

test('durable binding preserves merged per-chat thread state', async () => {
  const binding = fakeBinding();
  const env = { VICTOR_CONVERSATION_STATE: binding };
  await writeConversationState(env, '123', { active_target: 'rio', unresolved_question: 'why?' }, { requireDurable: true });
  await writeConversationState(env, '123', { last_task_id: 'task-1' }, { requireDurable: true });
  const record = await readConversationState(env, '123', { requireDurable: true });
  assert.equal(record.capability.durable, true);
  assert.equal(record.state.active_target, 'rio');
  assert.equal(record.state.unresolved_question, 'why?');
  assert.equal(record.state.last_task_id, 'task-1');
  assert.ok(record.state.updated_at);
});

test('durability-dependent operation fails explicitly when binding is absent', async () => {
  assert.throws(() => assertDurableConversationState({}), /DURABLE_CONVERSATION_STATE_UNAVAILABLE/);
  await assert.rejects(() => readConversationState({}, '123', { requireDurable: true }), /DURABLE_CONVERSATION_STATE_UNAVAILABLE/);
  await assert.rejects(() => writeConversationState({}, '123', { active_target: 'rio' }, { requireDurable: true }), /DURABLE_CONVERSATION_STATE_UNAVAILABLE/);
});
