from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')
original = text

import_line = "import { evaluateWatchdog, WATCHDOG_VERSION } from '../brain/safety_watchdog.mjs';\n"
cert_import = "import { parseDepartmentCertificationCommand, certificationAllowedDuringWatchdog } from '../brain/department_certification_gate.mjs';\n"
if cert_import not in text:
    if import_line not in text:
        raise SystemExit('STEP8_CERT_IMPORT_ANCHOR_MISSING')
    text = text.replace(import_line, import_line + cert_import, 1)

# Anchor only on the stable Founder-intent boundary. The watchdog invocation
# evolved after the original Step-8 repair was prepared; preserve the explicit
# current local evaluator availability/health context rather than downgrading it.
start = "    const v2Intent = classifyV2FounderIntent(text);\n"
end = "    const emergencyCommand = parseEmergencyCommand(text);\n"

replacement = r'''    const v2Intent = classifyV2FounderIntent(text);
    const v2Watchdog = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 0 });
    const departmentCertification = parseDepartmentCertificationCommand(text);

    if (departmentCertification) {
      if (!certificationAllowedDuringWatchdog(v2Watchdog)) {
        await sendTelegramMessage(env, chatId, 'Department certification evidence path SAFE_HOLD me unavailable hai; no dispatch attempted.', message.message_id);
        return json({ ok: true, mode: 'V2_SAFE_HOLD', dispatch: 'BLOCKED', watchdog: v2Watchdog.triggers, certification_scope: departmentCertification.scope });
      }

      const target = departmentCertification.target;
      const preflight = buildV2DispatchPreflight(target, `cert:${message.message_id || 'none'}:${target}`);
      if (!preflight.allowed) {
        return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: preflight.reason, certification_scope: departmentCertification.scope, secrets_exposed: false }, 200);
      }

      const pause = await isExecutionPaused(env, target);
      if (pause.paused) {
        return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: 'EMERGENCY_PAUSE_ACTIVE', certification_scope: departmentCertification.scope, secrets_exposed: false }, 200);
      }

      let dispatch;
      try {
        if (target === 'tony_stark') {
          if (!tonyBridgeConfigured(env)) return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: 'TONY_BRIDGE_NOT_CONFIGURED' }, 200);
          dispatch = await dispatchTonyTask(env, departmentCertification.prompt, { messageId: message.message_id, actionContract: preflight.contract });
          ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        } else if (target === 'aura3') {
          if (!aura3BridgeConfigured(env)) return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: 'AURA3_BRIDGE_NOT_CONFIGURED' }, 200);
          dispatch = await dispatchAura3Task(env, departmentCertification.prompt, { messageId: message.message_id, actionContract: preflight.contract });
          ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        } else if (target === 'rio') {
          if (!rioBridgeConfigured(env)) return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: 'RIO_BRIDGE_NOT_CONFIGURED' }, 200);
          dispatch = await dispatchRioTask(env, departmentCertification.prompt, { messageId: message.message_id, actionContract: preflight.contract });
          ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        } else {
          return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: 'CERTIFICATION_TARGET_UNSUPPORTED' }, 200);
        }
      } catch (error) {
        console.error(JSON.stringify({ event: 'ENDGAME_DEPARTMENT_CERTIFICATION_DISPATCH_FAILED', target, reason: safeErrorMessage(error), secrets_exposed: false }));
        return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target, reason: 'CERTIFICATION_DISPATCH_FAILED', certification_scope: departmentCertification.scope, secrets_exposed: false }, 200);
      }

      await sendTelegramMessage(env, chatId, `${departmentCertification.department} evidence-only certification probe dispatched. Fresh verified result follow karega.`, message.message_id);
      return json({
        ok: true,
        mode: 'ENDGAME_DEPARTMENT_CERTIFICATION',
        target,
        task_id: dispatch.taskId,
        task_type: dispatch.taskType,
        certification_scope: departmentCertification.scope,
        watchdog_decision: v2Watchdog.decision,
        watchdog_new_execution_allowed: v2Watchdog.allow_new_execution,
        watchdog_evidence_collection_allowed: v2Watchdog.allow_evidence_collection,
        production_autonomy_enabled: false,
        secrets_exposed: false,
      }, 200);
    }

    if (v2Watchdog.decision === 'SAFE_HOLD') {
      await sendTelegramMessage(env, chatId, 'Victor V2 watchdog SAFE_HOLD active hai; new execution dispatch blocked hai.', message.message_id);
      return json({ ok: true, mode: 'V2_SAFE_HOLD', dispatch: 'BLOCKED', watchdog: v2Watchdog.triggers });
    }

    const traceId = buildTraceId(update?.update_id, message.message_id);
    console.log(JSON.stringify({
      event: 'VICTOR_TELEGRAM_MESSAGE_ACCEPTED',
      trace_id: traceId,
      message_id: message.message_id,
      chat_authorized: true,
      secrets_exposed: false,
    }));
    if (/^\s*ENDGAME RUNTIME ACCEPTANCE\s*$/i.test(text)) {
      const acceptance = await runEndgameRuntimeAcceptance(env, {
        traceId,
        query: 'Falcon validation code',
      });
      const reply = [
        `END GAME Package 2: ${acceptance.status}`,
        `Verified procedure/degraded mode: ${acceptance.procedure_registry_live ? 'VERIFIED' : 'BLOCKED'}`,
        `Truthful telemetry: ${acceptance.truthful_telemetry_live ? 'VERIFIED' : 'BLOCKED'}`,
        `Experience ledger round-trip: ${acceptance.experience_ledger_readback_verified ? 'VERIFIED' : 'BLOCKED'}`,
        `Experience advisory reuse: ${acceptance.experience_advisory_reuse_verified ? 'VERIFIED' : 'BLOCKED'}`,
        `Cognee semantic round-trip: ${acceptance.cognee_semantic_roundtrip_verified ? 'VERIFIED' : 'BLOCKED'}`,
        `Blockers: ${acceptance.blockers.length ? acceptance.blockers.join(', ') : 'none'}`,
        'Production autonomy: OFF',
        'Secrets exposed: no',
      ].join('\n');
      await sendTelegramMessage(env, chatId, reply, message.message_id);
      return json({ ok: acceptance.status === 'PASS', mode: 'ENDGAME_RUNTIME_ACCEPTANCE', ...acceptance }, 200);
    }

'''

if "const departmentCertification = parseDepartmentCertificationCommand(text);" not in text:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit('STEP8_CERT_START_ANCHOR_MISSING')
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit('STEP8_CERT_END_ANCHOR_MISSING')
    text = text[:start_index] + replacement + text[end_index:]

if text == original:
    print('NO_CHANGES_ALREADY_APPLIED:STEP8_CERTIFICATION_SAFEHOLD')
else:
    path.write_text(text, encoding='utf-8')
    print('STEP8_CERTIFICATION_SAFEHOLD_APPLIED')
