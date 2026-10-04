export const HERMES_COMMAND_API_VERSION = 'HERMES_COMMAND_API_V1';

export const HERMES_RISK_CLASS = Object.freeze({
  READ_ONLY: 'READ_ONLY',
  SAFE_EXECUTION: 'SAFE_EXECUTION',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  SAFE_STOP: 'SAFE_STOP',
});

export const HERMES_ACTIONS = Object.freeze({
  'hermes.status': { target: 'hermes', risk: HERMES_RISK_CLASS.READ_ONLY },
  'hermes.audit': { target: 'hermes', risk: HERMES_RISK_CLASS.READ_ONLY },
  'hermes.context': { target: 'hermes', risk: HERMES_RISK_CLASS.READ_ONLY },
  'hermes.gulabo_review_ready': { target: 'hermes', risk: HERMES_RISK_CLASS.READ_ONLY },
  'gulabo.status': { target: 'gulabo', risk: HERMES_RISK_CLASS.READ_ONLY },
  'gulabo.request_revision': { target: 'gulabo', risk: HERMES_RISK_CLASS.SAFE_EXECUTION },
  'gulabo.good_to_go': { target: 'gulabo', risk: HERMES_RISK_CLASS.APPROVAL_REQUIRED },
  'rio.status': { target: 'rio', risk: HERMES_RISK_CLASS.READ_ONLY },
  'rio.image_usage': { target: 'rio', risk: HERMES_RISK_CLASS.READ_ONLY },
  'rio.image_budget': { target: 'rio', risk: HERMES_RISK_CLASS.READ_ONLY },
  'rio.flyer_result': { target: 'rio', risk: HERMES_RISK_CLASS.READ_ONLY },
  'rio.flyer_preflight': { target: 'rio', risk: HERMES_RISK_CLASS.SAFE_EXECUTION },
  'rio.generate_product_flyer': { target: 'rio', risk: HERMES_RISK_CLASS.SAFE_EXECUTION },
  'victor.status': { target: 'victor', risk: HERMES_RISK_CLASS.READ_ONLY },
});

const SOURCE_SET = new Set(['telegram', 'chatgpt', 'dashboard', 'internal']);
const ACTOR_SET = new Set(['founder', 'founder_authorized_assistant', 'system']);
const EXECUTION_MODE_SET = new Set(['manual', 'approval_required']);

function cleanString(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function classifyHermesAction(action) {
  const spec = HERMES_ACTIONS[action];
  if (!spec) return { known: false, risk: HERMES_RISK_CLASS.SAFE_STOP, target: null };
  return { known: true, risk: spec.risk, target: spec.target };
}

export function validateHermesCommandEnvelope(input = {}) {
  const errors = [];
  const command = {
    command_id: cleanString(input.command_id, 128),
    source: cleanString(input.source, 32).toLowerCase(),
    actor: cleanString(input.actor, 64).toLowerCase(),
    target: cleanString(input.target, 64).toLowerCase(),
    action: cleanString(input.action, 128),
    execution_mode: cleanString(input.execution_mode || 'manual', 32).toLowerCase(),
    idempotency_key: cleanString(input.idempotency_key, 160),
    payload: input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : {},
  };

  if (!command.command_id) errors.push('COMMAND_ID_REQUIRED');
  if (!SOURCE_SET.has(command.source)) errors.push('SOURCE_INVALID');
  if (!ACTOR_SET.has(command.actor)) errors.push('ACTOR_INVALID');
  if (!command.target) errors.push('TARGET_REQUIRED');
  if (!command.action) errors.push('ACTION_REQUIRED');
  if (!EXECUTION_MODE_SET.has(command.execution_mode)) errors.push('EXECUTION_MODE_INVALID');
  if (!command.idempotency_key) errors.push('IDEMPOTENCY_KEY_REQUIRED');

  const classification = classifyHermesAction(command.action);
  if (!classification.known) {
    errors.push('ACTION_NOT_REGISTERED');
  } else if (classification.target !== command.target) {
    errors.push('TARGET_ACTION_MISMATCH');
  }

  if (classification.risk === HERMES_RISK_CLASS.APPROVAL_REQUIRED && command.execution_mode !== 'approval_required') {
    errors.push('APPROVAL_MODE_REQUIRED');
  }

  return {
    ok: errors.length === 0,
    errors,
    command,
    classification,
    policy_version: HERMES_COMMAND_API_VERSION,
  };
}

export function buildHermesReceipt({ command, status = 'RECEIVED', validation = 'PENDING', execution = 'NOT_STARTED', receiptId, now = new Date().toISOString() }) {
  return {
    receipt_id: receiptId || `rcpt_${command.command_id || 'unknown'}`,
    command_id: command.command_id || null,
    received_at: now,
    source: command.source || null,
    actor: command.actor || null,
    target: command.target || null,
    action: command.action || null,
    status,
    validation,
    execution,
    live_request_verified: false,
    real_output_verified: false,
    business_outcome_verified: false,
    policy_version: HERMES_COMMAND_API_VERSION,
  };
}

function parseRioProductCommand(action, args) {
  const finalArg = args.at(-1) || '';
  const hasImageUrl = /^https:\/\//i.test(finalArg) && args.length >= 2;
  const productReference = hasImageUrl ? args.slice(0, -1).join(' ') : args.join(' ');
  return {
    target: 'rio',
    action,
    payload: {
      product_reference: productReference,
      ...(hasImageUrl ? { product_image_url: finalArg } : {}),
    },
  };
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function parseHermesTelegramCommand(text = '') {
  const raw = cleanString(text, 4000);
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  const cmd = parts[0].toLowerCase();
  if (cmd === '/hermes' && parts[1]?.toLowerCase() === 'status') return { target: 'hermes', action: 'hermes.status', payload: {} };
  if (cmd === '/hermes' && parts[1]?.toLowerCase() === 'audit') return { target: 'hermes', action: 'hermes.audit', payload: {} };
  if (cmd === '/hermes' && parts[1]?.toLowerCase() === 'context') return { target: 'hermes', action: 'hermes.context', payload: {} };

  if (cmd === '/gulabo' && parts[1]?.toLowerCase() === 'status') return { target: 'gulabo', action: 'gulabo.status', payload: {} };
  if (cmd === '/gulabo' && parts[1]?.toLowerCase() === 'revise' && parts[2] && positiveInteger(parts[3])) {
    const feedback = parts.slice(4).join(' ').trim();
    if (!feedback) return null;
    return {
      target: 'gulabo',
      action: 'gulabo.request_revision',
      payload: {
        image_id: parts[2],
        from_revision: positiveInteger(parts[3]),
        preserve: ['all approved elements not explicitly changed'],
        change: [feedback],
        regenerate_from_scratch: false,
        founder_feedback: feedback,
      },
    };
  }
  if (cmd === '/gulabo' && parts[1]?.toLowerCase() === 'approve' && parts[2] && positiveInteger(parts[3])) {
    return {
      target: 'gulabo',
      action: 'gulabo.good_to_go',
      execution_mode: 'approval_required',
      payload: {
        image_id: parts[2],
        revision: positiveInteger(parts[3]),
        note: parts.slice(4).join(' ').trim() || null,
      },
    };
  }

  if (cmd === '/rio' && parts[1]?.toLowerCase() === 'status') return { target: 'rio', action: 'rio.status', payload: {} };
  if (cmd === '/rio' && parts[1]?.toLowerCase() === 'usage') return { target: 'rio', action: 'rio.image_usage', payload: {} };
  if (cmd === '/rio' && parts[1]?.toLowerCase() === 'budget') return { target: 'rio', action: 'rio.image_budget', payload: {} };
  if (cmd === '/rio' && parts[1]?.toLowerCase() === 'result' && parts[2]) return { target: 'rio', action: 'rio.flyer_result', payload: { task_id: parts[2] } };
  if (cmd === '/rio' && parts[1]?.toLowerCase() === 'preflight' && parts[2]) return parseRioProductCommand('rio.flyer_preflight', parts.slice(2));
  if (cmd === '/rio' && parts[1]?.toLowerCase() === 'flyer' && parts[2]) return parseRioProductCommand('rio.generate_product_flyer', parts.slice(2));
  if (cmd === '/victor' && parts[1]?.toLowerCase() === 'status') return { target: 'victor', action: 'victor.status', payload: {} };
  return null;
}
