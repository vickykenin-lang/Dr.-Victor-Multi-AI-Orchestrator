from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

# Detect the semantic continuity end-state across both the legacy cache helper
# implementation and the newer conversation-state-store abstraction. Later
# consolidation layers are allowed to replace storage internals without making
# this historical patcher fail.
has_state_read = (
    "const session = await readConversationSession(chatId);" in text
    or "readConversationState(env, chatId" in text
)
has_state_write = (
    "async function writeConversationSession(chatId, next)" in text
    or "writeConversationState(env, chatId" in text
)

if (
    "classifyConversationFollowUp" in text
    and has_state_read
    and has_state_write
    and "async function answerExistingDepartmentTask(env, chatId, followUp, session, replyToMessageId)" in text
    and "last_task_id: dispatch.taskId" in text
):
    print('CONVERSATION_CONTINUITY_ALREADY_APPLIED')
    raise SystemExit(0)

raise SystemExit('conversation continuity semantic end-state missing; manual integration review required')
