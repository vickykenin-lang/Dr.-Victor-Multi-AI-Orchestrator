from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

# Import the reply-integrity guard.
router_import = "import { callVictorModel, callCogneeInference } from './model_router.mjs';\n"
guard_import = "import { assessReplyNaturalness, buildNaturalReplyDirective } from './reply_integrity.mjs';\n"
if guard_import not in text:
    if router_import not in text:
        raise SystemExit('reply integrity import anchor missing')
    text = text.replace(router_import, router_import + guard_import, 1)

# Expose safe runtime metadata only.
health_anchor = "        response_integrity: 'INDEPENDENT_EVIDENCE_LOCK_V1',\n"
health_line = "        reply_style_guard: 'NATURAL_DIRECT_V1',\n"
if "reply_style_guard: 'NATURAL_DIRECT_V1'" not in text:
    if health_anchor not in text:
        raise SystemExit('reply style health anchor missing')
    text = text.replace(health_anchor, health_anchor + health_line, 1)

# Replace askModel so scripted/template drafts are rejected and regenerated from the same evidence context.
start_marker = "async function askModel(env, system, userMessage) {\n"
end_marker = "\nfunction codedError(code, message) {"
start = text.find(start_marker)
end = text.find(end_marker, start if start >= 0 else 0)
if start < 0 or end < 0:
    raise SystemExit('askModel replacement anchors missing')

new_ask = """async function askModel(env, system, userMessage) {
  const integritySystem = `${system}\n\nINDEPENDENT RESPONSE INTEGRITY LOCK — MANDATORY:\n- Report evidence exactly as observed; never change, soften, amplify, or reframe evidence to make an outcome look better or worse.\n- Never turn an assumption, absence of an error, configured credential, empty target list, cached state, historical record, or model-generated statement into PASS/SUCCESS/ACTIVE/VERIFIED.\n- If a requested fact was not independently observed, say UNVERIFIED / NOT OBSERVED / UNKNOWN.\n- Keep raw evidence and interpretation separate. If they conflict, raw fresh evidence wins.\n- Never invent a selected model, response, 2xx status, timestamp, target, receipt, heartbeat, deployment state, or business outcome.\n- A self-report by Victor, a department, memory, or another model is not independent proof of external runtime state.\n- If something is wrong, state what is wrong; do not cosmetically rewrite the result. Fixing happens as a separate action, never by manipulating the report.\n- Never expose credentials or secrets.\n\n${buildNaturalReplyDirective()}`;

  const verifyEvidenceIntegrity = content => {
    const claimsSuccess = /\\b(pass|passed|success|successful|verified|active|healthy|live)\\b/i.test(content);
    const assumptionEvidence = /\\b(assum(?:e|ed|ing)|assume kiya|no error|error nahi|error not seen|error nahi dikh)\\b/i.test(content);
    const nullEvidence = /\\b(?:selected model|model|result|inference result)\\s*:\\s*(?:null|unknown|not specified|none)\\b/i.test(content);
    if (claimsSuccess && (assumptionEvidence || nullEvidence)) {
      throw Object.assign(new Error('Success claim is not independently supported by observed evidence'), {
        code: 'INDEPENDENT_EVIDENCE_REQUIRED',
      });
    }
  };

  try {
    let result = await callVictorModel(env, integritySystem, userMessage);
    let content = String(result.content || '').trim();
    verifyEvidenceIntegrity(content);

    let style = assessReplyNaturalness(content, userMessage);
    let styleRetry = false;
    if (!style.ok) {
      styleRetry = true;
      const retrySystem = `${integritySystem}\n\nThe previous draft was rejected for scripted/template style only. Generate a fresh answer from the same evidence and the Founder message. Do not copy the rejected structure. No Note:, Summary:, Current state:, Next step:, generic CTA, follow-up offer, checklist, or status-dump wrapper unless explicitly requested. Preserve factual evidence exactly.`;
      result = await callVictorModel(env, retrySystem, userMessage, {
        task: result.task,
        temperature: 0.05,
      });
      content = String(result.content || '').trim();
      verifyEvidenceIntegrity(content);
      style = assessReplyNaturalness(content, userMessage);
      if (!style.ok) {
        const error = new Error(`Scripted reply style remained after regeneration: ${style.violations.join(',')}`);
        error.code = 'SCRIPTED_REPLY_BLOCKED';
        error.replyStyleViolations = style.violations;
        throw error;
      }
    }

    console.log(JSON.stringify({
      event: 'VICTOR_MODEL_ROUTE',
      task: result.task,
      model: result.model,
      discovery_status: result.discovery_status,
      fallback_attempts: result.failures?.length || 0,
      response_integrity: 'INDEPENDENT_EVIDENCE_LOCK_V1',
      reply_style_guard: 'NATURAL_DIRECT_V1',
      style_retry: styleRetry,
      secrets_exposed: false,
    }));
    return content;
  } catch (error) {
    if (error?.code === 'AI_CREDENTIAL_MISSING') throw codedError('AI_CREDENTIAL_MISSING', 'API_VICTOR is not configured');
    if (error?.code === 'INDEPENDENT_EVIDENCE_REQUIRED') {
      throw codedError('INDEPENDENT_EVIDENCE_REQUIRED', 'Victor draft blocked because the claimed outcome was not independently supported by observed evidence');
    }
    if (error?.code === 'SCRIPTED_REPLY_BLOCKED') {
      const blocked = codedError('SCRIPTED_REPLY_BLOCKED', 'Victor draft blocked because it remained scripted/template-style after one clean regeneration');
      blocked.replyStyleViolations = error.replyStyleViolations || [];
      throw blocked;
    }
    const routed = codedError(error?.code || 'AI_MODEL_ROUTER_EXHAUSTED', 'Victor specialist model router could not obtain a verified response');
    if (Array.isArray(error?.modelFailures)) routed.modelFailures = error.modelFailures;
    throw routed;
  }
}
"""
text = text[:start] + new_ask + text[end:]

# Add a user-facing error category if the style guard blocks both drafts.
msg_anchor = "    INDEPENDENT_EVIDENCE_REQUIRED: 'Victor ka draft block hua kyunki claimed result independent fresh evidence se prove nahi tha.',\n"
msg_line = "    SCRIPTED_REPLY_BLOCKED: 'Victor ka reply scripted/template-style raha, isliye delivery block kar di gayi.',\n"
if "SCRIPTED_REPLY_BLOCKED:" not in text:
    if msg_anchor not in text:
        raise SystemExit('scripted reply error anchor missing')
    text = text.replace(msg_anchor, msg_anchor + msg_line, 1)

worker.write_text(text, encoding='utf-8')
print('NATURAL_REPLY_GUARD_APPLIED')
