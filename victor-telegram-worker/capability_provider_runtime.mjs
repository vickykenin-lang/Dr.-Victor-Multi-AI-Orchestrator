export const PROVIDER_RUNTIME_VERSION = 'VICTOR_PROVIDER_RUNTIME_V2';

const PROVIDERS = Object.freeze({
  github: { endpoint_env: 'VICTOR_GITHUB_ADAPTER_URL', token_env: 'VICTOR_GITHUB_ADAPTER_TOKEN', risk: 'AMBER' },
  cloudflare: { endpoint_env: 'VICTOR_CLOUDFLARE_ADAPTER_URL', token_env: 'VICTOR_CLOUDFLARE_ADAPTER_TOKEN', risk: 'AMBER' },
  'research.web': { endpoint_env: 'VICTOR_RESEARCH_ADAPTER_URL', token_env: 'VICTOR_RESEARCH_ADAPTER_TOKEN', risk: 'GREEN' },
  image_generation: { endpoint_env: 'VICTOR_IMAGE_ADAPTER_URL', token_env: 'VICTOR_IMAGE_ADAPTER_TOKEN', risk: 'GREEN' },
  video_generation: { endpoint_env: 'VICTOR_VIDEO_ADAPTER_URL', token_env: 'VICTOR_VIDEO_ADAPTER_TOKEN', risk: 'GREEN' },
  audio_generation: { endpoint_env: 'VICTOR_AUDIO_ADAPTER_URL', token_env: 'VICTOR_AUDIO_ADAPTER_TOKEN', risk: 'GREEN' },
  browser_automation: { endpoint_env: 'VICTOR_BROWSER_ADAPTER_URL', token_env: 'VICTOR_BROWSER_ADAPTER_TOKEN', risk: 'AMBER' },
});

function config(env, capabilityId) {
  const p = PROVIDERS[capabilityId]; if (!p) return null;
  const endpoint = String(env?.[p.endpoint_env] || '').trim();
  const token = String(env?.[p.token_env] || '').trim();
  return { ...p, capability_id: capabilityId, endpoint, token, token_configured: Boolean(token) };
}
function validEndpoint(url) { try { const u = new URL(url); return u.protocol === 'https:'; } catch { return false; } }
export function providerStatus(env, capabilityId) {
  const c = config(env, capabilityId);
  if (!c) return { capability_id: capabilityId, registered: false, configured: false, state: 'NO_PROVIDER_CONTRACT' };
  if (!validEndpoint(c.endpoint)) return { capability_id: capabilityId, registered: true, configured: false, state: 'NEEDS_ADAPTER_ENDPOINT', endpoint_env: c.endpoint_env, token_env: c.token_env, risk: c.risk };
  return { capability_id: capabilityId, registered: true, configured: true, state: 'STAGED', endpoint_env: c.endpoint_env, token_env: c.token_env, token_configured: c.token_configured, risk: c.risk };
}
async function callAdapter(env, capabilityId, operation, payload = {}) {
  const c = config(env, capabilityId); if (!c || !validEndpoint(c.endpoint)) throw new Error('CAPABILITY_ADAPTER_NOT_CONFIGURED');
  const headers = { 'content-type': 'application/json', 'user-agent': 'Victor-Capability-Adapter/2.0' }; if (c.token) headers.authorization = `Bearer ${c.token}`;
  const response = await fetch(c.endpoint, { method: 'POST', headers, body: JSON.stringify({ contract: 'VICTOR_CAPABILITY_ADAPTER_V1', capability_id: capabilityId, operation, payload }) });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 1000) }; }
  if (!response.ok) throw new Error(`CAPABILITY_ADAPTER_HTTP_${response.status}`); return body;
}
export async function verifyProvider(env, capabilityId) {
  const status = providerStatus(env, capabilityId); if (!status.configured) return { ...status, verified: false };
  try { const result = await callAdapter(env, capabilityId, 'health', {}); const verified = result?.ok === true && (result?.capability_id == null || result.capability_id === capabilityId); return { ...status, state: verified ? 'VERIFIED' : 'HEALTH_FAILED', verified, evidence: { adapter_contract: result?.contract || null, provider: result?.provider || null } }; }
  catch (error) { return { ...status, state: 'HEALTH_FAILED', verified: false, error: error?.message || 'Error' }; }
}
export async function executeProviderCapability(env, capabilityId, payload = {}) {
  const health = await verifyProvider(env, capabilityId); if (!health.verified) return { ok: false, verified: false, state: health.state, health };
  const result = await callAdapter(env, capabilityId, 'execute', payload); const verified = result?.ok === true && result?.verified === true;
  return { ok: result?.ok === true, verified, state: verified ? 'RESULT_RECEIVED' : 'UNVERIFIED_RESULT', result, health };
}
export function providerCatalog() { return Object.entries(PROVIDERS).map(([id, p]) => ({ capability_id: id, endpoint_env: p.endpoint_env, token_env: p.token_env, risk: p.risk, contract: 'VICTOR_CAPABILITY_ADAPTER_V1' })); }
