from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

# Later layers extend imports and planning blocks. Detect semantic end-state, not exact historical text.
if (
    "classifyConversationFollowUp" in text
    and "const session = await readConversationSession(chatId);" in text
    and "async function writeConversationSession(chatId, next)" in text
    and "async function answerExistingDepartmentTask(env, chatId, followUp, session, replyToMessageId)" in text
    and "last_task_id: dispatch.taskId" in text
):
    print('CONVERSATION_CONTINUITY_ALREADY_APPLIED')
    raise SystemExit(0)

raise SystemExit('conversation continuity semantic end-state missing; manual integration review required')
