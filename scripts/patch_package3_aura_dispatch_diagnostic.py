from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text()
old = """        dispatch = await dispatchAura3Task(env, 'PACKAGE3 strict supervision certification probe. Return fresh evidence. No public, production, paid, destructive or credential action.', { messageId: message.message_id });
        ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
"""
new = """        try {
          dispatch = await dispatchAura3Task(env, 'PACKAGE3 strict supervision certification probe. Return fresh evidence. No public, production, paid, destructive or credential action.', { messageId: message.message_id });
        } catch (error) {
          const messageText = String(error?.message || 'AURA3 dispatch failed');
          const httpMatch = messageText.match(/AURA3 dispatch HTTP\\s+(\\d{3})/i);
          const reason = httpMatch ? `AURA3_DISPATCH_HTTP_${httpMatch[1]}` : 'AURA3_DISPATCH_FAILED';
          console.error(JSON.stringify({ event: 'PACKAGE3_AURA3_DISPATCH_FAILED', reason, secrets_exposed: false }));
          return json({ ok: false, mode: 'ENDGAME_DEPARTMENT_CERTIFICATION', target: 'aura3', reason, secrets_exposed: false }, 200);
        }
        ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
"""
if old not in text:
    raise SystemExit('expected AURA3 Package 3 dispatch block not found')
text = text.replace(old, new, 1)
path.write_text(text)
print('PACKAGE3_AURA3_SAFE_DIAGNOSTIC_PATCH_APPLIED')
