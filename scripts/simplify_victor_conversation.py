from pathlib import Path

p = Path('victor-telegram-worker/worker.js')
s = p.read_text(encoding='utf-8')

old = "  const intent = classifyFounderMessage(userMessage);\n  const entity = resolveFounderEntityQuery(userMessage);"
new = """  const intent = classifyFounderMessage(userMessage);

  // Conversation-first: casual talk and explanations behave like a normal AI.
  // Operational/status/action requests continue through the governed evidence path.
  if (isNaturalConversationIntent(intent, userMessage)) {
    return callVictorNatural(env, userMessage, core.sourceRecords);
  }

  const entity = resolveFounderEntityQuery(userMessage);"""
if new not in s:
    if old not in s:
        raise SystemExit('NATURAL_ROUTE_ANCHOR_NOT_FOUND')
    s = s.replace(old, new, 1)

anchor = 'async function askModel(env, system, userMessage) {'
addition = r'''function isNaturalConversationIntent(intent, text) {
  const value = String(text || '').trim();
  if (intent === 'GENERAL_CONVERSATION' || intent === 'IDENTITY_QUERY') return true;

  const explanatory = /\b(kya\s+karta|kya\s+karti|kaun\s+kya|role|roles|kaam\s+kya|kya\s+kaam|about|bare\s+me\s+batao|baare\s+me\s+batao|samjhao|explain)\b/i.test(value);
  const operational = /\b(status|current|latest|fresh|live|health|healthy|check|verify|evidence|issue|problem|blocker|fix|repair|recover|thik|theek|execute|run|deploy|publish|start|stop|pause|resume|revenue|progress)\b/i.test(value);
  return String(intent || '').startsWith('SYSTEM_QUERY') && explanatory && !operational;
}

async function callVictorNatural(env, userMessage, sourceRecords = []) {
  const registry = sourceRecords.find(record => record?.name === 'DEPARTMENT_REGISTRY' && record?.ok)?.text || '';
  const system = `
You are Dr. Victor, Vicky's personal AI assistant and executive orchestrator.
Talk naturally like a capable general AI assistant.

- Answer the actual request directly.
- Casual requests are allowed: stories, explanations, brainstorming, general knowledge and ordinary conversation.
- Never turn casual conversation into a governance lecture, runtime report, health check or status template.
- If asked what Victor or departments do, explain their roles simply from the registry below.
- Do not invent live/current execution facts. Operational status and actions use the governed execution path.
- Match the user's language; Hinglish is fine.
- Be concise unless detail is requested.
- Never expose credentials, secrets or tokens.

DEPARTMENT REGISTRY (role/context only):
${registry.slice(0, 14000)}
`;
  return askModel(env, system, userMessage);
}

'''
if addition not in s:
    if anchor not in s:
        raise SystemExit('ASK_MODEL_ANCHOR_NOT_FOUND')
    s = s.replace(anchor, addition + anchor, 1)

s = s.replace(
    "You are Dr. Victor, Founder Vicky's governed executive AI and orchestration intelligence.\nYou are NOT a generic Telegram chatbot. Telegram is only the Founder communication transport.",
    "You are Dr. Victor, Founder Vicky's AI assistant and executive orchestration intelligence. Telegram is the Founder communication transport. Speak naturally while preserving evidence and authority boundaries.",
    1,
)

p.write_text(s, encoding='utf-8')
print('VICTOR_CONVERSATION_SIMPLIFIED')
