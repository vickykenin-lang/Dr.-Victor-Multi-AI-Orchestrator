export const CAPABILITY_REGISTRY_VERSION = 'VICTOR_CAPABILITY_REGISTRY_V1';

const CAPABILITIES = Object.freeze([
  { id: 'conversation', kind: 'native', mode: 'read', risk: 'GREEN', available: true, description: 'Natural Founder conversation and general reasoning without external tools.' },
  { id: 'current_time', kind: 'native', mode: 'read', risk: 'GREEN', available: true, description: 'Current runtime date/time supplied to the LLM as trusted context.' },
  { id: 'department.rio.read', kind: 'department', department: 'rio', mode: 'read', risk: 'GREEN', available: true, description: 'Read verified RIO state/evidence.' },
  { id: 'department.rio.execute', kind: 'department', department: 'rio', mode: 'write', risk: 'AMBER', available: true, description: 'Governed RIO task execution.' },
  { id: 'department.aura3.read', kind: 'department', department: 'aura3', mode: 'read', risk: 'GREEN', available: true, description: 'Read verified AURA3 state/evidence.' },
  { id: 'department.aura3.execute', kind: 'department', department: 'aura3', mode: 'write', risk: 'AMBER', available: true, description: 'Governed AURA3 task execution.' },
  { id: 'department.tony.read', kind: 'department', department: 'tony_stark', mode: 'read', risk: 'GREEN', available: true, description: 'Read Tony Stark diagnostic state/evidence.' },
  { id: 'department.tony.execute', kind: 'department', department: 'tony_stark', mode: 'write', risk: 'AMBER', available: true, description: 'Governed Tony Stark diagnostic/corrective execution.' },
  { id: 'department.hulk.read', kind: 'department', department: 'hulk', mode: 'read', risk: 'GREEN', available: false, description: 'Read HULK state when a verified bridge is available.' },
  { id: 'github', kind: 'tool', mode: 'read-write', risk: 'AMBER', available: true, description: 'Repository inspection and governed repository changes.' },
  { id: 'cloudflare', kind: 'tool', mode: 'read-write', risk: 'AMBER', available: true, description: 'Cloudflare Worker/Queue/runtime inspection and governed deployment operations.' },
  { id: 'memory.cognee', kind: 'memory', mode: 'read-write', risk: 'GREEN', available: true, description: 'Optional semantic memory; advisory context only.' },
  { id: 'experience_ledger', kind: 'memory', mode: 'read-write', risk: 'GREEN', available: true, description: 'Experience recording and reuse suggestions; cannot self-authorize runtime changes.' },
  { id: 'sandbox', kind: 'platform', mode: 'execute', risk: 'GREEN', available: true, description: 'Isolated bounded experimentation with no production authority.' },
  { id: 'research.web', kind: 'tool', mode: 'read', risk: 'GREEN', available: false, description: 'Fresh external web research capability; requires an attached provider/adapter in Victor runtime.' },
  { id: 'image_generation', kind: 'media', mode: 'execute', risk: 'GREEN', available: false, description: 'Generate or edit images through a connected image provider.' },
  { id: 'video_generation', kind: 'media', mode: 'execute', risk: 'GREEN', available: false, description: 'Generate video/reels/movie shots through a connected video provider.' },
  { id: 'audio_generation', kind: 'media', mode: 'execute', risk: 'GREEN', available: false, description: 'Voice/music/audio generation through a connected provider.' },
  { id: 'browser_automation', kind: 'tool', mode: 'execute', risk: 'AMBER', available: false, description: 'External website/browser workflow capability.' },
]);

export function listCapabilities() {
  return CAPABILITIES.map(c => ({ ...c }));
}

export function getCapability(id) {
  return CAPABILITIES.find(c => c.id === id) || null;
}

export function findAvailableCapability(predicate) {
  return CAPABILITIES.find(c => c.available && predicate(c)) || null;
}

export function capabilitySummary() {
  return CAPABILITIES.map(({ id, kind, mode, risk, available, department, description }) => ({ id, kind, mode, risk, available, department: department || null, description }));
}

export function registryHealth() {
  return {
    version: CAPABILITY_REGISTRY_VERSION,
    total: CAPABILITIES.length,
    available: CAPABILITIES.filter(c => c.available).length,
    unavailable: CAPABILITIES.filter(c => !c.available).length,
    authority_model: 'CAPABILITY_DOES_NOT_SELF_GRANT_EXTERNAL_AUTHORITY',
  };
}
