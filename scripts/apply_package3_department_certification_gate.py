from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text()
anchor = "    const emergencyCommand = parseEmergencyCommand(text);\n"
if text.count(anchor) != 1:
    raise SystemExit(f'expected one emergency-command anchor, found {text.count(anchor)}')
block = r'''    const package3Match = text.match(/^\s*ENDGAME DEPARTMENT CERTIFY\s+(AURA3|RIO)\s*$/i);
    if (package3Match) {
      const department = package3Match[1].toUpperCase();
      let dispatch;
      if (department === 'AURA3') {
        if (!aura3BridgeConfigured(env)) return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target: 'aura3', reason: 'AURA3_BRIDGE_NOT_CONFIGURED' }, 200);
        dispatch = await dispatchAura3Task(env, 'PACKAGE3 strict supervision certification probe. Return fresh evidence. No public, production, paid, destructive or credential action.', { messageId: message.message_id });
        ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        await sendTelegramMessage(env, chatId, 'Package 3 AURA3 certification probe dispatched. Fresh verified revert follow karega.', message.message_id);
        return json({ ok: true, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target: 'aura3', task_id: dispatch.taskId, task_type: dispatch.taskType, production_autonomy_enabled: false, secrets_exposed: false }, 200);
      }
      if (!rioBridgeConfigured(env)) return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target: 'rio', reason: 'RIO_BRIDGE_NOT_CONFIGURED' }, 200);
      dispatch = await dispatchRioTask(env, 'PACKAGE3 strict supervision certification probe. Return fresh evidence. No public, production, paid, destructive or credential action.', { messageId: message.message_id });
      ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
      await sendTelegramMessage(env, chatId, 'Package 3 RIO certification probe dispatched. Fresh verified revert follow karega.', message.message_id);
      return json({ ok: true, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target: 'rio', task_id: dispatch.taskId, task_type: dispatch.taskType, production_autonomy_enabled: false, secrets_exposed: false }, 200);
    }

'''
if 'ENDGAME_DEPARTMENT_CERTIFICATION' in text:
    print('PACKAGE3_CERTIFICATION_GATE_ALREADY_PRESENT')
else:
    text = text.replace(anchor, block + anchor, 1)
    path.write_text(text)
    print('PACKAGE3_CERTIFICATION_GATE_APPLIED')
