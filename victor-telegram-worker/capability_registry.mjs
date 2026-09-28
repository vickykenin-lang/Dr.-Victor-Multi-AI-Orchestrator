export const CAPABILITY_REGISTRY_VERSION = 'VICTOR_CAPABILITY_REGISTRY_V2';

const CAPABILITIES = Object.freeze([
  { id: 'conversation', kind: 'native', mode: 'read', risk: 'GREEN', available: true, runtime_execute: true, description: 'Natural Founder conversation and general reasoning without external tools.' },
  { id: 'current_time', kind: 'native', mode: 'read', risk: 'GREEN', available: true, runtime_execute: true, description: 'Current runtime date/time supplied to the LLM as trusted context.' },
  { id: 'department.rio.read', kind: 'department', department: 'rio', mode: 'read', risk: 'GREEN', available: true, runtime_execute: true, description: 'Read verified RIO state/evidence.' },
  { id: 'department.rio.execute', kind: 'department', department: 'rio', mode: 'write', risk: 'AMBER', available: true, runtime_execute: true, description: 'Governed RIO task execution.' },
  { id: 'department.aura3.read', kind: 'department', department: 'aura3', mode: 'read', risk: 'GREEN', available: true, runtime_execute: true, description: 'Read verified AURA3 state/evidence.' },
  { id: 'department.aura3.execute', kind: 'department', department: 'aura3', mode: 'write', risk: 'AMBER', available: true, runtime_execute: true, description: 'Governed AURA3 task execution.' },
  { id: 'department.tony.read', kind: 'department', department: 'tony_stark', mode: 'read', risk: 'GREEN', available: true, runtime_execute: true, description: 'Read Tony Stark diagnostic state/evidence.' },
  { id: 'department.tony.execute', kind: 'department', department: 'tony_stark', mode: 'write', risk: 'AMBER', available: true, runtime_execute: true, description: 'Governed Tony Stark diagnostic/corrective execution.' },
  { id: 'department.hulk.read', kind: 'department', department: 'hulk', mode: 'read', risk: 'GREEN', available: false, runtime_execute: false, description: 'Read HULK state when a verified bridge is available.' },
  { id: 'github', kind: 'tool', mode: 'read-write', risk: 'AMBER', available: false, runtime_execute: false, control_plane_available: true, description: 'GitHub is available to Victor operators/control-plane, but the production Worker needs a governed adapter before autonomous runtime execution.' },
  { id: 'cloudflare', kind: 'tool', mode: 'read-write', risk: 'AMBER', available: false, runtime_execute: false, control_plane_available: true, description: 'Cloudflare is available to Victor operators/control-plane, but the production Worker needs a governed adapter before runtime execution.' },
  { id: 'memory.cognee', kind: 'memory', mode: 'read-write', risk: 'GREEN', available: true, runtime_execute: true, description: 'Optional semantic memory; advisory context only.' },
  { id: 'experience_ledger', kind: 'memory', mode: 'read-write', risk: 'GREEN', available: true, runtime_execute: true, description: 'Experience recording and reuse suggestions; cannot self-authorize runtime changes.' },
  { id: 'sandbox', kind: 'platform', mode: 'execute', risk: 'GREEN', available: true, runtime_execute: true, description: 'Isolated bounded experimentation with no production authority.' },
  { id: 'research.web', kind: 'tool', mode: 'read', risk: 'GREEN', available: false, runtime_execute: false, description: 'Fresh external web research through a verified Victor adapter.' },
  { id: 'image_generation', kind: 'media', mode: 'execute', risk: 'GREEN', available: false, runtime_execute: false, description: 'Generate or edit images through a verified image adapter.' },
  { id: 'video_generation', kind: 'media', mode: 'execute', risk: 'GREEN', available: false, runtime_execute: false, description: 'Generate reels/movie shots through a verified video adapter.' },
  { id: 'audio_generation', kind: 'media', mode: 'execute', risk: 'GREEN', available: false, runtime_execute: false, description: 'Voice/music/audio generation through a verified audio adapter.' },
  { id: 'browser_automation', kind: 'tool', mode: 'execute', risk: 'AMBER', available: false, runtime_execute: false, description: 'External website/browser workflow through a verified adapter.' },
]);

export function listCapabilities() { return CAPABILITIES.map(c => ({ ...c })); }
export function getCapability(id) { return CAPABILITIES.find(c => c.id === id) || null; }
export function findAvailableCapability(predicate) { return CAPABILITIES.find(c => c.available && c.runtime_execute !== false && predicate(c)) || null; }
export function capabilitySummary() { return CAPABILITIES.map(({ id, kind, mode, risk, available, runtime_execute, control_plane_available, department, description }) => ({ id, kind, mode, risk, available, runtime_execute: runtime_execute !== false, control_plane_available: control_plane_available === true, department: department || null, description })); }
export function registryHealth() { return { version: CAPABILITY_REGISTRY_VERSION, total: CAPABILITIES.length, available: CAPABILITIES.filter(c => c.available && c.runtime_execute !== false).length, unavailable: CAPABILITIES.filter(c => !c.available || c.runtime_execute === false).length, authority_model: 'CAPABILITY_DOES_NOT_SELF_GRANT_EXTERNAL_AUTHORITY' }; }
