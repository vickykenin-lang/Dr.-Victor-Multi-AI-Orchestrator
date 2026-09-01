from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

conversation_import = "import { classifyConversationFollowUp, formatPendingTaskStatus } from '../brain/conversation_runtime.mjs';\n"
hulk_import = "import { classifyHulkRequest, hulkActionBlockedReply, hulkStatusReply, isCasualWellbeing, casualWellbeingReply } from '../brain/hulk_guard.mjs';\n"
if hulk_import not in text:
    if conversation_import not in text:
        raise SystemExit('conversation import anchor missing')
    text = text.replace(conversation_import, conversation_import + hulk_import, 1)

anchor = "      const deterministicIntent = resolveFounderIntent(text, replyContext);\n      const contextualFollowUp = classifyConversationFollowUp(text, session);\n"
inserted_marker = "      const hulkRequest = classifyHulkRequest(text);\n"
if inserted_marker not in text:
    replacement = anchor + "      const hulkRequest = classifyHulkRequest(text);\n\n      if (!memoryDirective && isCasualWellbeing(text)) {\n        await sendTelegramMessage(env, chatId, casualWellbeingReply(), message.message_id);\n        return json({ ok: true, mode: 'CASUAL_WELLBEING' });\n      }\n\n      if (!memoryDirective && hulkRequest.matched) {\n        await writeConversationSession(chatId, { last_target: 'hulk', last_founder_text: text, task_state: 'NO_VERIFIED_BRIDGE' });\n        const reply = hulkRequest.mode === 'HULK_ACTION' ? hulkActionBlockedReply() : hulkStatusReply();\n        await sendTelegramMessage(env, chatId, reply, message.message_id);\n        return json({ ok: true, mode: hulkRequest.mode, target: 'hulk', dispatch: 'NOT_ATTEMPTED_BRIDGE_UNVERIFIED' });\n      }\n"
    if anchor not in text:
        raise SystemExit('request planning anchor missing')
    text = text.replace(anchor, replacement, 1)

old_targets = "Targets: rio, tony_stark, aura3, or null."
new_targets = "Targets: rio, tony_stark, aura3, hulk, or null. HULK is intercepted before planner execution; never map HULK to RIO."
if new_targets not in text:
    if old_targets not in text:
        raise SystemExit('planner targets anchor missing')
    text = text.replace(old_targets, new_targets, 1)

old_schema = '{"mode":"CHAT|DEPARTMENT_STATUS|DEPARTMENT_ACTION|EXECUTIVE_GOAL","target":"rio|tony_stark|aura3|null","reason":"short"}'
new_schema = '{"mode":"CHAT|DEPARTMENT_STATUS|DEPARTMENT_ACTION|EXECUTIVE_GOAL","target":"rio|tony_stark|aura3|hulk|null","reason":"short"}'
if new_schema not in text:
    if old_schema not in text:
        raise SystemExit('planner schema anchor missing')
    text = text.replace(old_schema, new_schema, 1)

old_allowed = "  const allowedTargets = new Set(['rio', 'tony_stark', 'aura3', null]);"
new_allowed = "  const allowedTargets = new Set(['rio', 'tony_stark', 'aura3', 'hulk', null]);"
if new_allowed not in text:
    if old_allowed not in text:
        raise SystemExit('allowed targets anchor missing')
    text = text.replace(old_allowed, new_allowed, 1)

path.write_text(text, encoding='utf-8')
print('HULK_ROUTING_GUARD_ALREADY_APPLIED' if inserted_marker in text else 'HULK routing guard applied')
