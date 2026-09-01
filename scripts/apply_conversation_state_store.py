#!/usr/bin/env python3
from pathlib import Path

WORKER = Path('victor-telegram-worker/worker.js')
text = WORKER.read_text(encoding='utf-8')

import_anchor = "import { classifyOwnedProblem, buildOwnedProblemPrompt, naturalOwnedProblemAck } from '../brain/problem_ownership.mjs';\n"
import_line = "import { conversationStateCapability, readConversationState, writeConversationState } from '../brain/conversation_state_store.mjs';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('conversation state import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

health_old = "        active_thread_memory: 'BEST_EFFORT_WORKING_CONTEXT_V1',\n"
health_new = "        active_thread_memory: conversationStateCapability(env).durable ? 'DURABLE_CONVERSATION_STATE_V1' : 'BEST_EFFORT_WORKING_CONTEXT_V1',\n        active_thread_memory_durable: conversationStateCapability(env).durable,\n        active_thread_memory_reason: conversationStateCapability(env).reason,\n"
if health_new not in text:
    if health_old not in text:
        raise SystemExit('active thread health anchor missing')
    text = text.replace(health_old, health_new, 1)

old = '''async function readConversationSession(chatId) {
  try {
    const cache = caches.default;
    const key = new Request(`https://victor.internal/conversation/${encodeURIComponent(String(chatId))}`);
    const hit = await cache.match(key);
    return hit ? await hit.json() : {};
  } catch (_) {
    return {};
  }
}

async function writeConversationSession(chatId, next) {
  try {
    const cache = caches.default;
    const key = new Request(`https://victor.internal/conversation/${encodeURIComponent(String(chatId))}`);
    const current = await readConversationSession(chatId);
    const payload = { ...current, ...next, updated_at: new Date().toISOString() };
    await cache.put(key, new Response(JSON.stringify(payload), { headers: { 'Cache-Control': 'public, max-age=7200', 'Content-Type': 'application/json' } }));
  } catch (_) {}
}
'''
new = '''async function readConversationSession(chatId, env = {}) {
  try {
    const record = await readConversationState(env, chatId);
    return record.state || {};
  } catch (_) {
    return {};
  }
}

async function writeConversationSession(chatId, next, env = {}) {
  try {
    await writeConversationState(env, chatId, next || {});
  } catch (_) {}
}
'''
if new not in text:
    if old not in text:
        raise SystemExit('conversation session function anchor missing')
    text = text.replace(old, new, 1)

# All runtime call sites must pass env so the durable binding is actually used.
text = text.replace('readConversationSession(chatId);', 'readConversationSession(chatId, env);')
text = text.replace('writeConversationSession(chatId, ', 'writeConversationSession(chatId, ')
# add env to write calls with common terminal patterns without disturbing function declaration
replacements = {
    'await writeConversationSession(chatId, sessionWithFounderTurn);': 'await writeConversationSession(chatId, sessionWithFounderTurn, env);',
    "await writeConversationSession(chatId, { last_target: 'hulk', last_founder_text: text, task_state: 'NO_VERIFIED_BRIDGE' });": "await writeConversationSession(chatId, { last_target: 'hulk', last_founder_text: text, task_state: 'NO_VERIFIED_BRIDGE' }, env);",
}
for a,b in replacements.items():
    text = text.replace(a,b)

# General multiline object calls: insert env at the closing pattern used by this worker.
text = text.replace("          task_state: 'OWNED_RECOVERY_RUNNING',\n        });", "          task_state: 'OWNED_RECOVERY_RUNNING',\n        }, env);")
text = text.replace("          task_state: 'PENDING_INVESTIGATION',\n        });", "          task_state: 'PENDING_INVESTIGATION',\n        }, env);")
text = text.replace("          task_state: 'RESULT_VERIFIED',\n  });", "          task_state: 'RESULT_VERIFIED',\n  }, env);")

# Single-line department task writes.
for target in ['rio', 'tony_stark', 'aura3']:
    needle = f"await writeConversationSession(chatId, {{ last_target: '{target}', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' }});"
    repl = needle[:-2] + ', env);'
    text = text.replace(needle, repl)

# Existing-task and natural-result paths.
text = text.replace("await writeConversationSession(chatId, { last_target: target, last_task_id: taskId, task_state: 'RESULT_VERIFIED' });", "await writeConversationSession(chatId, { last_target: target, last_task_id: taskId, task_state: 'RESULT_VERIFIED' }, env);")
text = text.replace("  await writeConversationSession(chatId, {\n    last_victor_reply: reply,\n    unresolved_question: null,\n    task_state: 'RESULT_VERIFIED',\n  });", "  await writeConversationSession(chatId, {\n    last_victor_reply: reply,\n    unresolved_question: null,\n    task_state: 'RESULT_VERIFIED',\n  }, env);")
text = text.replace("    const current = await readConversationSession(chatId);", "    const current = await readConversationSession(chatId, env);")
text = text.replace("    await writeConversationSession(chatId, withReply);", "    await writeConversationSession(chatId, withReply, env);")

WORKER.write_text(text, encoding='utf-8')
print('CONVERSATION_STATE_STORE_INTEGRATED')
