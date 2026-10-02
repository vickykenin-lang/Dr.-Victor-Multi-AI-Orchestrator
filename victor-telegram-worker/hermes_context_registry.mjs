export const HERMES_CONTEXT_REGISTRY_VERSION = 'HERMES_CONTEXT_REGISTRY_V1';
const ACTIVE_CONTEXT_KEY = 'context:hermes:active';

export const DEFAULT_HERMES_CONTEXT = Object.freeze({
  context_version: '2026-10-02-v3',
  purpose: 'Persistent bootstrap context for Founder-authorized Hermes operations and development.',
  founder_command_policy: 'manual_governed',
  architecture: {
    control_plane: 'Hermes Command Control Plane V1',
    primary_runtime: 'Victor LLM-first runtime wrapped by Hermes governed entrypoint',
    command_store: 'HERMES_COMMAND_STORE durable KV',
    chatgpt_bridge: 'Founder-authored GitHub issue -> signed /v1/commands request',
    telegram_bridge: 'Existing /telegram webhook -> governed Hermes slash commands; other messages pass through to Victor',
    rio_image_provider: 'Hermes central Cloudflare Workers AI binding; RIO requests generation through Hermes and does not receive Cloudflare provider credentials',
  },
  repositories: {
    victor: 'vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator',
    rio: 'vickykenin-lang/rio-affiliate-engine',
  },
  agents: ['hermes', 'victor', 'rio'],
  evidence_contract: [
    'credential_available',
    'endpoint_config_present',
    'source_implemented',
    'test_passed',
    'production_deployed',
    'live_request_verified',
    'real_output_verified',
    'real_business_outcome_verified',
  ],
  safety: {
    fail_closed_unknown_actions: true,
    idempotency_required: true,
    replay_protection_required: true,
    receipts_required: true,
    irreversible_or_high_risk_actions_require_separate_approval_boundary: true,
    never_treat_memory_as_runtime_proof: true,
  },
  rio_image_policy: {
    provider_mode: 'HERMES_CENTRAL_WORKERS_AI',
    model: '@cf/black-forest-labs/flux-2-klein-9b',
    provider_credential_transfer_to_rio: false,
    exact_product_reference_required: true,
    exact_https_product_image_required: true,
    reference_image_max_dimension_px: 511,
    monthly_provider_call_limit: 30,
    quota_counter_atomic: false,
    quota_counter_note: 'Current counter uses Workers KV and is auditable but not a concurrency-safe hard cap; upgrade to Durable Object or D1 before autonomous concurrent generation.',
    max_attempts_per_product: 2,
    generated_output_requires_semantic_qa_before_final: true,
  },
});

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export async function loadHermesContext(env = {}) {
  const store = env.HERMES_COMMAND_STORE;
  if (store && typeof store.get === 'function') {
    try {
      const persisted = await store.get(ACTIVE_CONTEXT_KEY, { type: 'json' });
      if (isObject(persisted)) {
        return {
          registry_version: HERMES_CONTEXT_REGISTRY_VERSION,
          source: 'DURABLE_KV',
          persisted: true,
          context: persisted,
        };
      }
    } catch {
      // Fail safely to the source-controlled bootstrap context. Runtime evidence remains separate.
    }
  }
  return {
    registry_version: HERMES_CONTEXT_REGISTRY_VERSION,
    source: 'SOURCE_BOOTSTRAP',
    persisted: false,
    context: DEFAULT_HERMES_CONTEXT,
  };
}
