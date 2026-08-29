#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
worker=root/'victor-telegram-worker/worker.js'; auto=root/'victor-telegram-worker/autonomy_runtime.mjs'
w=worker.read_text(encoding='utf-8')
imp="import { parseEmergencyCommand, applyEmergencyCommand } from './emergency_pause_runtime.mjs';\n"
if imp not in w:
    anchor="import { autonomyConfigured, persistAutonomyEvidence, runAutonomousCycle } from './autonomy_runtime.mjs';\n"
    if anchor not in w:raise SystemExit('WORKER_IMPORT_ANCHOR_NOT_FOUND')
    w=w.replace(anchor,anchor+imp,1)
needle="    const traceId = buildTraceId(update?.update_id, message.message_id);\n    let processingStage = 'REQUEST_ACCEPTED';\n"
insert="    const traceId = buildTraceId(update?.update_id, message.message_id);\n    const emergencyCommand = parseEmergencyCommand(text);\n    if (emergencyCommand) {\n      try {\n        const pauseResult = await applyEmergencyCommand(env, emergencyCommand, { chatId, messageId: message.message_id });\n        const label = pauseResult.status === 'PAUSE_UNCONFIRMED'\n          ? 'Emergency pause requested but RIO acknowledgement failed. Victor remains fail-closed for new dispatch; check RIO mirror before assuming organization-wide pause.'\n          : `${pauseResult.status}: ${emergencyCommand.scope === 'system' ? 'SYSTEM' : emergencyCommand.department}. RIO mirror: ${pauseResult.rio_mirror}.`;\n        await sendTelegramMessage(env, chatId, label, message.message_id);\n        return json({ ok: true, emergency_pause: pauseResult.status, rio_mirror: pauseResult.rio_mirror });\n      } catch (pauseError) {\n        await sendTelegramMessage(env, chatId, 'Emergency pause command failed to persist. Treat execution state as unconfirmed; no success claimed.', message.message_id);\n        return json({ ok: false, emergency_pause: 'FAILED' }, 503);\n      }\n    }\n    let processingStage = 'REQUEST_ACCEPTED';\n"
if needle in w and 'const emergencyCommand = parseEmergencyCommand(text);' not in w:w=w.replace(needle,insert,1)
worker.write_text(w,encoding='utf-8')

a=auto.read_text(encoding='utf-8')
imp2="import { isExecutionPaused } from './emergency_pause_runtime.mjs';\n"
if imp2 not in a:
    marker="const TELEGRAM_API = 'https://api.telegram.org';"
    if marker not in a:raise SystemExit('AUTONOMY_IMPORT_ANCHOR_NOT_FOUND')
    a=a.replace(marker,imp2+'\n'+marker,1)
needle2="  if (controller.cron !== SUPERVISION_CRON) return { status: 'IGNORED_UNKNOWN_CRON', cron: controller.cron };\n\n  const registry = await loadGoalRegistry(env);"
replace2="  if (controller.cron !== SUPERVISION_CRON) return { status: 'IGNORED_UNKNOWN_CRON', cron: controller.cron };\n\n  const pause = await isExecutionPaused(env);\n  if (pause.paused) return { status: 'SAFE_STOP', goalId: null, target: null, error_code: 'EMERGENCY_PAUSE_ACTIVE', diagnostics: pause };\n\n  const registry = await loadGoalRegistry(env);"
if needle2 in a and "error_code: 'EMERGENCY_PAUSE_ACTIVE'" not in a:a=a.replace(needle2,replace2,1)
auto.write_text(a,encoding='utf-8')
print('VICTOR_EMERGENCY_PAUSE_RUNTIME_PATCHED')
