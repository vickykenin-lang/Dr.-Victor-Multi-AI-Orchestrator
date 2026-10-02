const GITHUB_API = 'https://api.github.com';
const RIO_REPO = 'vickykenin-lang/rio-affiliate-engine';
const RIO_FLYER_WORKFLOW = 'hermes-rio-flyer-transport.yml';

export const HERMES_RIO_FLYER_BRIDGE_VERSION = 'HERMES_RIO_FLYER_BRIDGE_V1';

function clean(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function rioFlyerBridgeCapability(env = {}) {
  const token = Boolean(clean(env.GITHUB_ORCHESTRATION_TOKEN));
  const enabled = String(env.RIO_FLYER_TRANSPORT_ENABLED || '').toLowerCase() === 'true';
  return {
    bridge_version: HERMES_RIO_FLYER_BRIDGE_VERSION,
    repository: RIO_REPO,
    workflow: RIO_FLYER_WORKFLOW,
    github_orchestration_token_configured: token,
    transport_feature_flag_enabled: enabled,
    ready_for_dispatch: token && enabled,
  };
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'Hermes-RIO-Flyer-Bridge/1.0',
  };
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

  const taskId = `hermes-rio-flyer-${Date.now()}-${clean(command.command_id, 80) || 'cmd'}`;
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
    };
  }

  return {
    status: 'DISPATCHED',
    error_code: null,
    task_id: taskId,
    product_reference: validation.product_reference,
    workflow: RIO_FLYER_WORKFLOW,
    repository: RIO_REPO,
    capability,
    live_request_verified: true,
    real_output_verified: false,
    business_outcome_verified: false,
  };
}
