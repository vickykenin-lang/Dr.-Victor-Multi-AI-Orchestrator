from pathlib import Path

WORKER = Path('victor-telegram-worker/worker.js')
AUTONOMY = Path('victor-telegram-worker/autonomy_runtime.mjs')


def patch_file(path: Path, replacements):
    text = path.read_text(encoding='utf-8')
    original = text
    for old, new, label in replacements:
        if new in text:
            continue
        if old not in text:
            raise SystemExit(f'PATCH_ANCHOR_NOT_FOUND:{path}:{label}')
        text = text.replace(old, new, 1)
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False

worker_import_old = "import { parseEmergencyCommand, applyEmergencyCommand, isExecutionPaused } from './emergency_pause_runtime.mjs';\n"
worker_import_new = worker_import_old + "import { classifyTelegramBrainIntent, buildCrossDepartmentSupportPrompt } from '../brain/telegram_gateway.mjs';\n"

routing_anchor = "      const entity = resolveFounderEntityQuery(text);\n\n      processingStage = 'DEPARTMENT_ROUTING';\n"
brain_gateway = """      const entity = resolveFounderEntityQuery(text);\n      const brainIntent = classifyTelegramBrainIntent(text, {\n        entity,\n        replyText: message?.reply_to_message?.text || '',\n      });\n\n      if (!memoryDirective && brainIntent.mode === 'EXECUTIVE_GOAL_REVIEW') {\n        processingStage = 'BRAIN_EXECUTIVE_GOAL_REVIEW';\n        const brainController = { cron: '*/15 * * * *', scheduledTime: Date.now() };\n        let brainResult;\n        try {\n          brainResult = await runAutonomousCycle(brainController, env);\n          await persistAutonomyEvidence(env, brainController, brainResult);\n        } catch (brainError) {\n          console.error('Victor Brain Telegram cycle failed:', brainError?.message || 'unknown');\n          await sendTelegramMessage(env, chatId, 'Victor Brain cycle execute nahi hua. Main direct department keyword-routing par silently fallback nahi karunga; runtime evidence check required hai.', message.message_id);\n          return json({ ok: false, brain_gateway: 'FAILED' }, 503);\n        }\n        const brainPhase = brainResult?.result?.phase || brainResult?.result?.assessment?.phase || 'EXECUTIVE_REVIEW';\n        const brainTaskId = brainResult?.result?.taskId || null;\n        const lines = [\n          'Victor Brain executive cycle completed.',\n          `Status: ${brainResult.status}`,\n          `Goal: ${brainResult.goalId || 'none'}`,\n          `Route: ${brainResult.target || 'none'}`,\n          `Mode: ${brainPhase}`,\n          brainTaskId ? `Task ID: ${brainTaskId}` : null,\n        ].filter(Boolean);\n        await sendTelegramMessage(env, chatId, lines.join('\\n'), message.message_id);\n        return json({ ok: true, brain_gateway: 'EXECUTED', result: brainResult });\n      }\n\n      if (!memoryDirective && brainIntent.mode === 'CROSS_DEPARTMENT_SUPPORT') {\n        processingStage = 'BRAIN_CROSS_DEPARTMENT_SUPPORT';\n        const plan = brainIntent.plan || {};\n        if (plan.department !== 'tony_stark') {\n          await sendTelegramMessage(env, chatId, 'Brain ne cross-department task identify kiya, lekin requested support department ka direct governed bridge available nahi hai. Unsafe fallback nahi kiya gaya.', message.message_id);\n          return json({ ok: true, brain_gateway: 'UNSUPPORTED_SUPPORT_DEPARTMENT', department: plan.department || null });\n        }\n        const tonyPause = await isExecutionPaused(env, 'tony_stark');\n        if (tonyPause.paused) {\n          const reason = tonyPause.global_pause_active ? 'SYSTEM PAUSE active hai.' : 'Tony Stark department PAUSED hai.';\n          await sendTelegramMessage(env, chatId, `Brain task dispatch refused: ${reason}`, message.message_id);\n          return json({ ok: true, brain_gateway: 'PAUSED', pause: tonyPause });\n        }\n        if (!tonyBridgeConfigured(env)) {\n          await sendTelegramMessage(env, chatId, 'Brain ne Tony-compatible support task banaya, lekin Tony governed bridge configured nahi hai.', message.message_id);\n          return json({ ok: true, brain_gateway: 'PENDING_CONFIGURATION' });\n        }\n        const taskPrompt = buildCrossDepartmentSupportPrompt(plan, text);\n        let dispatch;\n        try {\n          dispatch = await dispatchTonyTask(env, taskPrompt, { messageId: message.message_id });\n        } catch (bridgeError) {\n          console.error('Brain Tony support dispatch failed:', bridgeError?.message || 'unknown');\n          await sendTelegramMessage(env, chatId, 'Brain ne task decompose kiya, lekin Tony dispatch fail hua. Connection success claim nahi kiya jayega.', message.message_id);\n          return json({ ok: true, brain_gateway: 'DISPATCH_FAILED' });\n        }\n        await sendTelegramMessage(env, chatId, `Victor Brain ne Founder instruction ko Tony-compatible RIO support task me convert karke dispatch kiya. Task ID: ${dispatch.taskId}.`, message.message_id);\n        ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));\n        return json({ ok: true, brain_gateway: 'CROSS_DEPARTMENT_DISPATCHED', task_id: dispatch.taskId });\n      }\n\n      processingStage = 'DEPARTMENT_ROUTING';\n"""

health_old = "        autonomy_reporting: 'ESCALATIONS_VERIFIED_SUCCESS_AND_DAILY_SUMMARY',\n"
health_new = health_old + "        telegram_brain_gateway: 'BRAIN_FIRST_FOR_EXECUTIVE_AND_CROSS_DEPARTMENT_COMMANDS_V1',\n"

worker_changed = patch_file(WORKER, [
    (worker_import_old, worker_import_new, 'telegram_brain_import'),
    (routing_anchor, brain_gateway, 'telegram_brain_gateway'),
    (health_old, health_new, 'health_brain_gateway'),
])

autonomy_old = """  const initialPhase = selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'\n    ? 'FIVE_WHYS_DIAGNOSIS'\n    : 'EXECUTE';\n"""
autonomy_new = """  const initialPhase = (\n    selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'\n    || Number(selection.runtimeGoal?.same_recommendation_count) >= 2\n    || Number(selection.runtimeGoal?.same_failure_count) >= 2\n    || selection.runtimeGoal?.brain_review?.repeat_loop_detected === true\n  )\n    ? 'FIVE_WHYS_DIAGNOSIS'\n    : 'EXECUTE';\n"""
autonomy_changed = patch_file(AUTONOMY, [(autonomy_old, autonomy_new, 'force_five_whys_before_dispatch')])

print('TELEGRAM_BRAIN_GATEWAY_PATCH_APPLIED' if worker_changed or autonomy_changed else 'NO_CHANGES_ALREADY_APPLIED')
