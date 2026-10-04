import { HERMES_RISK_CLASS, classifyHermesAction } from './hermes_command_plane.mjs';
import { hermesStoreCapability, putCommandState, putReceipt } from './hermes_command_store.mjs';
import { gulaboBridgeSnapshot, postGulaboCallback } from './gulabo_bridge.mjs';

export const HERMES_ROUTER_VERSION = 'HERMES_COMMAND_ROUTER_V1';

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function configured(value) {
  return Boolean(clean(String(value ?? '')));
}

function baseEvidence() {
  return {
    credential_available: false,
    endpoint_config_present: false,
    source_implemented: true,
    test_passed: false,
    production_deployed: false,
    live_request_verified: false,
    real_output_verified: false,
    real_business_outcome_verified: false,
  };
}

export function hermesRuntimeSnapshot(env = {}) {
  const store = hermesStoreCapability(env);
  return {
    service: 'hermes-command-control-plane',
    router_version: HERMES_ROUTER_VERSION,
    command_store: store,
    command_token_configured: configured(env.HERMES_COMMAND_TOKEN),
    webhook_secret_configured: configured(env.HERMES_WEBHOOK_SECRET),
    telegram_secret_configured: configured(env.TELEGRAM_WEBHOOK_SECRET),
    founder_chat_configured: configured(env.VICTOR_FOUNDER_CHAT_ID),
    github_orchestration_token_configured: configured(env.GITHUB_ORCHESTRATION_TOKEN),
    gulabo: gulaboBridgeSnapshot(env),
    evidence: baseEvidence(),
  };
}

export function rioRuntimeSnapshot(env = {}) {
  const bridgeCredential = configured(env.GITHUB_ORCHESTRATION_TOKEN);
  return {
    service: 'rio',
    bridge_credential_configured: bridgeCredential,
    exact_flyer_transport_implemented: false,
    exact_flyer_transport_reason: 'RIO_EXACT_FLYER_TRANSPORT_NOT_IMPLEMENTED',
    image_policy: {
      monthly_final_limit: Number(env.RIO_IMAGE_MONTHLY_FINAL_LIMIT || 30),
      max_attempts_per_product: Number(env.RIO_IMAGE_MAX_ATTEMPTS || 2),
      monthly_spend_limit_usd: Number(env.RIO_IMAGE_MONTHLY_SPEND_LIMIT_USD || 1),
      enforcement_runtime: 'NOT_YET_WIRED',
    },
    evidence: {
      ...baseEvidence(),
      credential_available: bridgeCredential,
    },
  };
}

function requireApproval(command, classification) {
  return classification?.risk === HERMES_RISK_CLASS.APPROVAL_REQUIRED
    && command?.execution_mode !== 'approval_required';
}

async function persistResult(env, command, result) {
  const status = result.status || 'COMPLETED';
  const execution = result.execution || 'COMPLETED';
  const receiptId = `rcpt_${command.command_id}`;
  const receipt = {
    receipt_id: receiptId,
    command_id: command.command_id,
    source: command.source,
    actor: command.actor,
    target: command.target,
    action: command.action,
    status,
    validation: 'PASS',
    execution,
    result: result.result ?? null,
    error_code: result.error_code ?? null,
    live_request_verified: result.live_request_verified === true,
    real_output_verified: result.real_output_verified === true,
    business_outcome_verified: result.business_outcome_verified === true,
    router_version: HERMES_ROUTER_VERSION,
  };
  await putReceipt(env, receipt);
  await putCommandState(env, command, {
    status,
    validation: 'PASS',
    execution,
    error_code: receipt.error_code,
    result: receipt.result,
    receipt_id: receiptId,
  });
  return receipt;
}

function gulaboCallbackResult(callback) {
  if (!callback.ok) {
    return {
      status: 'SAFE_STOP',
      execution: callback.live_request_verified ? 'FAILED' : 'BLOCKED',
      error_code: callback.error_code || 'GULABO_CALLBACK_FAILED',
      result: callback.body ?? null,
      live_request_verified: callback.live_request_verified === true,
      real_output_verified: false,
    };
  }
  return {
    status: 'COMPLETED',
    execution: 'COMPLETED',
    result: callback.body,
    live_request_verified: callback.live_request_verified === true,
    real_output_verified: Boolean(callback.body),
  };
}

export async function routeHermesCommand(env, command, options = {}) {
  const classification = classifyHermesAction(command?.action);
  if (!classification.known) {
    const result = {
      status: 'SAFE_STOP',
      execution: 'BLOCKED',
      error_code: 'ACTION_NOT_REGISTERED',
      result: null,
    };
    if (options.persist !== false) await persistResult(env, command, result);
    return result;
  }

  if (requireApproval(command, classification)) {
    const result = {
      status: 'AWAITING_APPROVAL',
      execution: 'NOT_STARTED',
      error_code: 'APPROVAL_REQUIRED',
      result: null,
    };
    if (options.persist !== false) await persistResult(env, command, result);
    return result;
  }

  let result;
  switch (command.action) {
    case 'hermes.status':
      result = {
        status: 'COMPLETED',
        execution: 'COMPLETED',
        result: hermesRuntimeSnapshot(env),
      };
      break;
    case 'hermes.audit':
      result = {
        status: 'COMPLETED',
        execution: 'COMPLETED',
        result: {
          hermes: hermesRuntimeSnapshot(env),
          rio: rioRuntimeSnapshot(env),
          note: 'Fresh runtime/deployment evidence must override source-level assumptions.',
        },
      };
      break;
    case 'hermes.gulabo_review_ready': {
      const imageId = clean(command?.payload?.image_id, 160);
      const revision = Number(command?.payload?.revision || 0);
      const assetUri = clean(command?.payload?.asset_uri, 1000);
      if (!imageId || !Number.isInteger(revision) || revision < 1 || !assetUri) {
        result = {
          status: 'SAFE_STOP',
          execution: 'BLOCKED',
          error_code: 'GULABO_REVIEW_PACKET_INVALID',
          result: null,
        };
        break;
      }
      result = {
        status: 'AWAITING_FOUNDER_REVIEW',
        execution: 'COMPLETED',
        result: {
          review_type: 'GULABO_IMAGE',
          image_id: imageId,
          revision,
          requester: clean(command?.payload?.requester, 64) || null,
          requester_ref: clean(command?.payload?.requester_ref, 160) || null,
          asset_uri: assetUri,
          rating: command?.payload?.rating ?? null,
          qa_defects: Array.isArray(command?.payload?.qa_defects) ? command.payload.qa_defects.slice(0, 20) : [],
          founder_actions: ['REVISE', 'GOOD_TO_GO'],
        },
        real_output_verified: Boolean(command?.payload?.rating?.evidence_verified),
      };
      break;
    }
    case 'gulabo.status':
      result = {
        status: 'COMPLETED',
        execution: 'COMPLETED',
        result: gulaboBridgeSnapshot(env),
      };
      break;
    case 'gulabo.request_revision': {
      const imageId = clean(command?.payload?.image_id, 160);
      const fromRevision = Number(command?.payload?.from_revision || 0);
      const founderFeedback = clean(command?.payload?.founder_feedback, 4000);
      const changes = Array.isArray(command?.payload?.change)
        ? command.payload.change.map((x) => clean(x, 500)).filter(Boolean).slice(0, 20)
        : [];
      if (!imageId || !Number.isInteger(fromRevision) || fromRevision < 1 || !founderFeedback || !changes.length) {
        result = {
          status: 'SAFE_STOP',
          execution: 'BLOCKED',
          error_code: 'GULABO_CORRECTION_PACKET_INVALID',
          result: null,
        };
        break;
      }
      const callback = await postGulaboCallback(
        env,
        '/v1/hermes/correction',
        {
          image_id: imageId,
          from_revision: fromRevision,
          preserve: Array.isArray(command?.payload?.preserve)
            ? command.payload.preserve.map((x) => clean(x, 500)).filter(Boolean).slice(0, 20)
            : [],
          change: changes,
          founder_feedback: founderFeedback,
          regenerate_from_scratch: command?.payload?.regenerate_from_scratch === true,
        },
        { fetchImpl: options.fetchImpl, nowMs: options.nowMs },
      );
      result = gulaboCallbackResult(callback);
      break;
    }
    case 'gulabo.good_to_go': {
      const imageId = clean(command?.payload?.image_id, 160);
      const revision = Number(command?.payload?.revision || 0);
      if (!imageId || !Number.isInteger(revision) || revision < 1) {
        result = {
          status: 'SAFE_STOP',
          execution: 'BLOCKED',
          error_code: 'GULABO_FOUNDER_DECISION_INVALID',
          result: null,
        };
        break;
      }
      const callback = await postGulaboCallback(
        env,
        '/v1/hermes/founder-decision',
        {
          image_id: imageId,
          revision,
          decision: 'GOOD_TO_GO',
          note: clean(command?.payload?.note, 2000) || null,
        },
        { fetchImpl: options.fetchImpl, nowMs: options.nowMs },
      );
      result = gulaboCallbackResult(callback);
      break;
    }
    case 'rio.status':
      result = {
        status: 'COMPLETED',
        execution: 'COMPLETED',
        result: rioRuntimeSnapshot(env),
      };
      break;
    case 'rio.image_usage':
      result = {
        status: 'COMPLETED_WITH_LIMITATION',
        execution: 'COMPLETED',
        error_code: 'RIO_IMAGE_USAGE_COUNTER_NOT_WIRED',
        result: {
          monthly_final_limit: Number(env.RIO_IMAGE_MONTHLY_FINAL_LIMIT || 30),
          actual_monthly_final_count: null,
          counter_verified: false,
        },
      };
      break;
    case 'rio.image_budget':
      result = {
        status: 'COMPLETED_WITH_LIMITATION',
        execution: 'COMPLETED',
        error_code: 'RIO_IMAGE_BUDGET_TELEMETRY_NOT_WIRED',
        result: {
          monthly_spend_limit_usd: Number(env.RIO_IMAGE_MONTHLY_SPEND_LIMIT_USD || 1),
          actual_monthly_spend_usd: null,
          provider_budget_verified: false,
        },
      };
      break;
    case 'victor.status':
      result = {
        status: 'COMPLETED',
        execution: 'COMPLETED',
        result: {
          service: 'victor',
          deployment_git_sha: env.VICTOR_DEPLOY_GIT_SHA || null,
          deployment_build_uuid: env.VICTOR_BUILD_UUID || null,
          github_orchestration_token_configured: configured(env.GITHUB_ORCHESTRATION_TOKEN),
          production_identity_verified: false,
        },
      };
      break;
    case 'rio.generate_product_flyer': {
      const productReference = clean(command?.payload?.product_reference, 300);
      if (!productReference) {
        result = {
          status: 'SAFE_STOP',
          execution: 'BLOCKED',
          error_code: 'PRODUCT_REFERENCE_REQUIRED',
          result: null,
        };
        break;
      }

      result = {
        status: 'SAFE_STOP',
        execution: 'BLOCKED',
        error_code: 'RIO_EXACT_FLYER_TRANSPORT_NOT_IMPLEMENTED',
        result: {
          product_reference: productReference,
          next_required_step: 'IMPLEMENT_AND_VERIFY_EXACT_RIO_FLYER_TRANSPORT',
          generic_rio_bridge_reused: false,
        },
      };
      break;
    }
    default:
      result = {
        status: 'SAFE_STOP',
        execution: 'BLOCKED',
        error_code: 'ACTION_ROUTE_NOT_IMPLEMENTED',
        result: null,
      };
  }

  if (options.persist !== false) await persistResult(env, command, result);
  return result;
}
