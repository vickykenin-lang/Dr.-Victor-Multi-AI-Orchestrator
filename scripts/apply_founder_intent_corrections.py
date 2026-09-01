from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

import_anchor = "import { parseEmergencyCommand, applyEmergencyCommand, isExecutionPaused } from './emergency_pause_runtime.mjs';\n"
import_line = "import { resolveFounderIntent, founderDirectionReply, clarificationFallback } from '../brain/founder_intent.mjs';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('founder intent import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

# If the integrated Founder intent flow already exists, do not try to reapply an
# obsolete exact block. This patcher must remain idempotent as later runtime
# layers add session/context logic around the same planning stage.
integrated = (
    "const deterministicIntent = resolveFounderIntent(text, replyContext);" in text
    and "deterministicIntent.mode === 'FOUNDER_DIRECTION'" in text
    and "deterministicIntent.mode === 'CLARIFICATION'" in text
)

if not integrated:
    planning_anchor = "      processingStage = 'REQUEST_PLANNING';\n      const plan = await planFounderRequest(env, text, message?.reply_to_message?.text || '');\n"
    replacement = "      processingStage = 'REQUEST_PLANNING';\n      const replyContext = message?.reply_to_message?.text || '';\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n\n      if (!memoryDirective && deterministicIntent.mode === 'FOUNDER_DIRECTION') {\n        await sendTelegramMessage(env, chatId, founderDirectionReply(), message.message_id);\n        return json({ ok: true, mode: deterministicIntent.mode, reason: deterministicIntent.reason });\n      }\n\n      if (!memoryDirective && deterministicIntent.mode === 'CLARIFICATION') {\n        let clarification = clarificationFallback(replyContext);\n        if (replyContext && env.ENABLE_AI_INFERENCE === 'true') {\n          clarification = await askModel(env, 'Explain the immediately previous Victor reply to the Founder. Do not greet, change topic, or execute a new task.', `Previous Victor reply: ${replyContext}\\nFounder clarification: ${text}`);\n        }\n        await sendTelegramMessage(env, chatId, clarification, message.message_id);\n        return json({ ok: true, mode: deterministicIntent.mode, reason: deterministicIntent.reason });\n      }\n\n      const plan = await planFounderRequest(env, text, replyContext);\n"
    if planning_anchor not in text:
        raise SystemExit('founder intent flow missing and legacy planning anchor unavailable')
    text = text.replace(planning_anchor, replacement, 1)

# Add semantic guard only when the legacy planner wording is present. Later
# planner revisions may already contain equivalent or stronger language.
guard = "- Do not reinterpret a Founder preference statement as permission to run the currently active goal."
if guard not in text:
    old_modes = "Modes:\n- CHAT: normal conversation, story, explanation, brainstorming, general question.\n- DEPARTMENT_STATUS: asks current/fresh/status/result/facts about RIO, Tony Stark or AURA3.\n- DEPARTMENT_ACTION: asks to fix, run, start, stop, recover, build, change, execute or otherwise act on RIO, Tony Stark or AURA3.\n- EXECUTIVE_GOAL: organization-level objective/strategy/root-cause/replanning request that Victor should manage across departments.\n"
    if old_modes in text:
        text = text.replace(old_modes, old_modes + "\nImportant semantic guard:\n- Operating preference/direction such as 'focus on operation, not payment' is NOT an EXECUTIVE_GOAL trigger by itself. It is handled before this planner.\n- Do not reinterpret a Founder preference statement as permission to run the currently active goal.\n", 1)

path.write_text(text, encoding='utf-8')
print('Founder intent corrections verified/applied')
