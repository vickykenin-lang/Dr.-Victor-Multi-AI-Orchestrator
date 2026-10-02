const GITHUB_API = 'https://api.github.com';
const RIO_REPO = 'vickykenin-lang/rio-affiliate-engine';
const RIO_FLYER_WORKFLOW = 'hermes-rio-flyer-transport.yml';
const RIO_RESULT_PREFIX = 'integration/results/flyer_tasks';

export const HERMES_RIO_FLYER_BRIDGE_VERSION = 'HERMES_RIO_FLYER_BRIDGE_V1';

function clean(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeTaskId(value) {
  const taskId = clean(value, 180);
  return /^[A-Za-z0-9._-]+$/.test(taskId) ? taskId : '';
}

function decodeBase64Utf8(value = '') {
  const raw = atob(String(value).replace(/\s+/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function rioFlyerBridgeCapability(env = {}) {
  const token = Boolean(clean(env.GITHUB_ORCHESTRATION_TOKEN));
  const enabled = String(env.RIO_FLYER_TRANSPORT_ENABLED || '').toLowerCase() === 'true';
  return {
    bridge_version: HERMES_RIO_FLYER_BRIDGE_VERSION,
    repository: RIO_REPO,
    workflow: RIO_FLYER_WORKFLOW,
    result_prefix: RIO_RESULT_PREFIX,
    github_orchestration_token_configured: token,
    transport_feature_flag_enabled: enabled,
    ready_for_dispatch: token && enabled,
    result_readback_implemented: true,
  };
}

function githubHeaders(env, { json = true } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Hermes-RIO-Flyer-Bridge/1.0',
  };
  if (clean(env?.GITHUB_ORCHESTRATION_TOKEN)) {
    headers.Authorization = `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`;
  }
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export function validateRioFlyerPayload(command = {}) {
  const productReference = clean(command?.payload?.product_reference, 300);
  const productImageUrl = clean(command?.payload?.product_image_url, 1500);
  const reasons = [];
  if (!productReference) reasons.push('PRODUCT_REFERENCE_REQUIRED');
  if (!/^https:\/\//i.test(productImageUrl)) reasons.push('VERIFIED_PRODUCT_IMAGE_URL_REQUIRED');
  return {
    ok: reasons.length === 0,
    reasons,
    product_reference: productReference,
    product_image_url: productImageUrl,
  };
}

export async function readRioFlyerResult(env, taskIdInput) {
  const taskId = safeTaskId(taskIdInput);
  if (!taskId) {
    return {
      status: 'SAFE_STOP',
      error_code: 'RIO_FLYER_TASK_ID_INVALID',
      task_id: null,
      result: null,
    };
  }

  const path = `${RIO_RESULT_PREFIX}/${taskId}.json`;
  const url = `${GITHUB_API}/repos/${RIO_REPO}/contents/${path}?ref=main`;
  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: githubHeaders(env, { json: false }) });
  } catch (error) {
    return {
      status: 'SAFE_STOP',
      error_code: 'RIO_RESULT_READ_FAILED',
      task_id: taskId,
      detail: clean(error?.message || error, 240),
      result: null,
    };
  }

  if (response.status === 404) {
    return {
      status: 'NOT_FOUND',
      error_code: 'RIO_RESULT_NOT_FOUND',
      task_id: taskId,
      result_path: path,
      result: null,
      live_request_verified: true,
    };
  }

  if (!response.ok) {
    return {
      status: 'SAFE_STOP',
      error_code: 'RIO_RESULT_GITHUB_HTTP_ERROR',
      task_id: taskId,
      github_http_status: response.status,
      result: null,
      live_request_verified: true,
    };
  }

  try {
    const body = await response.json();
    const decoded = decodeBase64Utf8(body?.content || '');
    const result = JSON.parse(decoded);
    if (result?.task_id !== taskId) {
      return {
        status: 'SAFE_STOP',
        error_code: 'RIO_RESULT_TASK_ID_MISMATCH',
        task_id: taskId,
        result_path: path,
        result: null,
        live_request_verified: true,
      };
    }
    return {
      status: 'FOUND',
      error_code: null,
      task_id: taskId,
      result_path: path,
      blob_sha: body?.sha || null,
      result,
      live_request_verified: true,
      real_output_verified: result?.real_output_verified === true,
      business_outcome_verified: result?.business_outcome_verified === true,
    };
  } catch (error) {
    return {
      status: 'SAFE_STOP',
      error_code: 'RIO_RESULT_PARSE_FAILED',
      task_id: taskId,
      result_path: path,
      detail: clean(error?.message || error, 240),
      result: null,
      live_request_verified: true,
    };
  }
}

export async function dispatchRioFlyerTask(env, command = {}) {
  const capability = rioFlyerBridgeCapability(env);
  if (!capability.ready_for_dispatch) {
    return {
      status: 'SAFE_STOP',
      error_code: !capability.github_orchestration_token_configured
        ? 'GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED'
        : 'RIO_FLYER_TRANSPORT_NOT_ENABLED',
      capability,
    };
  }

  const validation = validateRioFlyerPayload(command);
  if (!validation.ok) {
    return {
      status: 'SAFE_STOP',
      error_code: validation.reasons[0],
      reasons: validation.reasons,
      capability,
    };
  }

  const preflightOnly = command?.action === 'rio.flyer_preflight' || command?.payload?.preflight_only === true;
  const taskPrefix = preflightOnly ? 'hermes-rio-preflight' : 'hermes-rio-flyer';
  const taskId = `${taskPrefix}-${Date.now()}-${clean(command.command_id, 80) || 'cmd'}`;
  const payload = {
    product_image_url: validation.product_image_url,
    title: clean(command?.payload?.title, 180),
    category: clean(command?.payload?.category, 100),
    target_audience: clean(command?.payload?.target_audience, 160),
    creative_angle: clean(command?.payload?.creative_angle, 240),
    price: command?.payload?.price ?? null,
    currency: clean(command?.payload?.currency, 16),
    affiliate_url: clean(command?.payload?.affiliate_url, 1500),
    source_url: clean(command?.payload?.source_url, 1500),
    requested_by: command?.actor || null,
    hermes_command_id: command?.command_id || null,
    preflight_only: preflightOnly,
  };

  const url = `${GITHUB_API}/repos/${RIO_REPO}/actions/workflows/${RIO_FLYER_WORKFLOW}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        task_id: taskId,
        product_reference: validation.product_reference,
        payload: JSON.stringify(payload),
        preflight_only: preflightOnly ? 'true' : 'false',
      },
    }),
  });

  if (response.status !== 204) {
    let detail = '';
    try { detail = (await response.text()).slice(0, 400); } catch {}
    return {
      status: 'SAFE_STOP',
      error_code: 'RIO_FLYER_DISPATCH_FAILED',
      github_http_status: response.status,
      detail,
      capability,
      preflight_only: preflightOnly,
    };
  }

  return {
    status: 'DISPATCHED',
    error_code: null,
    task_id: taskId,
    product_reference: validation.product_reference,
    workflow: RIO_FLYER_WORKFLOW,
    repository: RIO_REPO,
    preflight_only: preflightOnly,
    result_path: `${RIO_RESULT_PREFIX}/${taskId}.json`,
    capability,
    live_request_verified: true,
    real_output_verified: false,
    business_outcome_verified: false,
  };
}
