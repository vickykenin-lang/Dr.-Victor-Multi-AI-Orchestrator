var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// victor-telegram-worker/core_rules.mjs
var PRECEDENCE_VERSION = "DOMAIN_PRECEDENCE_V6";
var RESOLVED_RUNTIME_RULES = Object.freeze({
  architecture_runtime_standard: "For architecture/runtime behavior, the canonical Architecture Lock Index controls over stale legacy descriptions in lower-level implementation/context documents. Conflicts are surfaced, never silently blended.",
  authority_governance: "Latest active explicit Founder decisions plus constitutional hard gates remain supreme for approvals, security, secrets, cost, destructive actions and authority boundaries.",
  operational_truth: "Fresh verified runtime evidence controls observed live facts. Active Founder decisions and reconciled canonical state control intended/current governed state. Historical plans never override a newer active Founder decision.",
  heartbeat: "Current locked standard: production supervision defaults to 15 minutes, minimum recovery cadence is 2 minutes, and the only ladder is 15\u219210\u21925\u21923\u21922. Founder/authorized Victor command is immediate event wake but does not bypass gates. Department-internal heartbeats remain independently contracted.",
  department_connectivity: "Repository presence, registry presence or historical status does not prove fresh Victor\u2194department connectivity, capability LIVE state or communication certification.",
  telegram_role: "Telegram is Founder/management communication transport, not the internal department bus and not Victor identity itself.",
  execution_scope: "The Telegram Worker cannot claim a consequential department/external action executed unless a separately hosted governed executor path actually ran and evidence verified it.",
  founder_entity_resolution: "Bare AURA resolves to AURA3; AURA2 is selected only when Founder explicitly says AURA2 or AURA 2.",
  memory_truth_split: "Memory is decision/history evidence. Canonical state is current operational truth. A permanent Founder decision must influence effective current state even when an older business-plan document still contains stale wording.",
  executive_reply_style: "Founder replies are BRIEF by default: answer first, 1-3 short sentences, no status dump, no examples or follow-up prompt. DETAIL mode is allowed only when Founder explicitly asks for detail/full explanation."
});
var ACTION_WORDS = [
  "pause",
  "resume",
  "publish",
  "send",
  "delete",
  "remove",
  "create",
  "change",
  "update",
  "deploy",
  "execute",
  "run",
  "assign",
  "approve",
  "reject",
  "stop",
  "start",
  "buy",
  "pay",
  "spend",
  "transfer"
];
var SYSTEM_WORDS = [
  "status",
  "live",
  "healthy",
  "connected",
  "connection",
  "department",
  "rio",
  "aura",
  "aura2",
  "vision",
  "oracle",
  "bubblebee",
  "hulk",
  "batman",
  "tony",
  "pa victor",
  "system",
  "runtime",
  "heartbeat",
  "objective",
  "authority",
  "rules",
  "rule",
  "soul",
  "state",
  "evidence",
  "certification",
  "memory",
  "credential",
  "vault"
];
var DETAIL_PATTERNS = [
  /\b(detail|details|detailed|deep|full|complete|comprehensive|explain|explanation|breakdown)\b/i,
  /\b(vistar|vistaar|detail\s+me|details\s+me|puri\s+detail|poori\s+detail|samjhao\s+detail)\b/i
];
function isDetailRequest(text3) {
  const value = String(text3 || "").trim();
  return Boolean(value) && DETAIL_PATTERNS.some((rx) => rx.test(value));
}
__name(isDetailRequest, "isDetailRequest");
function classifyFounderMessage(text3) {
  const normalized = String(text3 || "").toLowerCase().trim();
  if (!normalized) return "EMPTY";
  let base = "GENERAL_CONVERSATION";
  if (ACTION_WORDS.some((word) => normalized.includes(word))) base = "ACTION_REQUEST";
  else if (SYSTEM_WORDS.some((word) => normalized.includes(word))) base = "SYSTEM_QUERY";
  else if (/\b(who are you|tum kaun ho|kaun ho|who is victor|victor kaun)\b/.test(normalized)) base = "IDENTITY_QUERY";
  return isDetailRequest(text3) ? `${base}_DETAIL` : base;
}
__name(classifyFounderMessage, "classifyFounderMessage");
function parseJsonSource(sourceRecord) {
  if (!sourceRecord?.ok || typeof sourceRecord.text !== "string") return null;
  try {
    return JSON.parse(sourceRecord.text);
  } catch {
    return null;
  }
}
__name(parseJsonSource, "parseJsonSource");
function parseDecisionSource(sourceRecord) {
  if (!sourceRecord?.ok || typeof sourceRecord.text !== "string") return [];
  const out = [];
  for (const line of sourceRecord.text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const decision = JSON.parse(line);
      if (String(decision?.status || "active").toLowerCase() === "active") out.push(decision);
    } catch (_) {
    }
  }
  return out;
}
__name(parseDecisionSource, "parseDecisionSource");
function decisionText(decision) {
  return String(decision?.summary || decision?.text || "").toLowerCase();
}
__name(decisionText, "decisionText");
function effectiveDecisionFlags(decisions = []) {
  const text3 = decisions.map(decisionText).join("\n");
  return {
    aura2_hold: /aura\s*2.{0,80}\bhold\b|\bhold\b.{0,80}aura\s*2/i.test(text3),
    bare_aura_aura3: /bare aura.{0,80}aura3|aura without a version.{0,80}aura3/i.test(text3),
    rio_parked: /rio.{0,80}\bparked\b|\bparked\b.{0,80}rio/i.test(text3),
    rio_active_governed: /rio.{0,120}\bactive_governed\b|\bactive_governed\b.{0,120}rio/i.test(text3),
    strict_supervision: /strict.{0,80}supervision|supervise every department in strict mode/i.test(text3),
    victor_credential_authority: /victor.{0,100}authority.{0,100}credential|credential use authority/i.test(text3),
    hulk_business_rnd: /hulk.{0,120}(business r&d|opportunity-discovery|online business)/i.test(text3)
  };
}
__name(effectiveDecisionFlags, "effectiveDecisionFlags");
function decisionMatchesDepartment(decision, departmentId) {
  if (!departmentId) return false;
  const text3 = decisionText(decision);
  const aliases = {
    aura2: ["aura2", "aura 2"],
    aura3: ["aura3", "aura 3", "bare aura"],
    rio: ["rio"],
    hulk: ["hulk"],
    vision: ["vision"],
    tony_stark: ["tony", "tony stark"],
    oracle: ["oracle"],
    bubblebee: ["bubblebee"],
    pa_victor: ["pa victor"],
    batman_bruce: ["batman", "bruce"]
  };
  return (aliases[departmentId] || [departmentId]).some((alias) => text3.includes(alias));
}
__name(decisionMatchesDepartment, "decisionMatchesDepartment");
function buildTruthSnapshot(sourceRecords = [], requestFacts = {}) {
  const byName = Object.fromEntries(sourceRecords.map((record) => [record.name, record]));
  const systemState = parseJsonSource(byName.SYSTEM_STATE) || {};
  const registry = parseJsonSource(byName.DEPARTMENT_REGISTRY) || {};
  const aiRuntime = parseJsonSource(byName.AI_RUNTIME_STATUS) || {};
  const telegramRuntime = parseJsonSource(byName.TELEGRAM_RUNTIME_STATUS) || {};
  const activeFounderDecisions2 = parseDecisionSource(byName.DECISIONS);
  const flags = effectiveDecisionFlags(activeFounderDecisions2);
  const departments = Array.isArray(registry.departments) ? registry.departments.map((dept) => {
    const item = {
      id: dept.id,
      name: dept.name,
      registry_status: dept.status || "UNKNOWN",
      enabled: dept.enabled ?? null,
      victor_connection: dept.victor_connection || "NOT_VERIFIED",
      live_certification: dept.live_certification || "NOT_VERIFIED",
      business_execution: dept.business_execution || "UNKNOWN"
    };
    if (item.id === "aura2" && flags.aura2_hold) {
      item.registry_status = "HOLD";
      item.enabled = false;
      item.effective_state_source = "ACTIVE_FOUNDER_DECISION";
    }
    if (item.id === "rio" && flags.rio_parked) {
      item.registry_status = "PARKED";
      item.business_execution = "BLOCKED_PENDING_FOUNDER_ACTIVATION";
      item.effective_state_source = "ACTIVE_FOUNDER_DECISION";
    }
    if (item.id === "rio" && flags.rio_active_governed) {
      item.registry_status = "ACTIVE_GOVERNED";
      item.enabled = true;
      item.business_execution = "GOVERNED_AUTONOMOUS_ENABLED";
      item.effective_state_source = "ACTIVE_FOUNDER_DECISION";
    }
    return item;
  }) : [];
  const conflicts = Array.isArray(systemState.conflicts) ? systemState.conflicts : [];
  const resolvedDepartmentId = requestFacts.resolvedDepartmentId || null;
  const resolvedDepartment = resolvedDepartmentId ? departments.find((d) => d.id === resolvedDepartmentId) || null : null;
  const resolvedDepartmentDecisions = resolvedDepartmentId ? activeFounderDecisions2.filter((decision) => decisionMatchesDepartment(decision, resolvedDepartmentId)) : [];
  return {
    generated_at_utc: (/* @__PURE__ */ new Date()).toISOString(),
    request_facts: {
      telegram_webhook_authenticated: Boolean(requestFacts.telegramWebhookAuthenticated),
      telegram_message_received_now: Boolean(requestFacts.telegramMessageReceivedNow),
      consequential_executor_available: Boolean(requestFacts.consequentialExecutorAvailable),
      diagnostic_department_bridge_available: Boolean(requestFacts.diagnosticDepartmentBridgeAvailable),
      resolved_department_id: resolvedDepartmentId,
      resolved_department_name: requestFacts.resolvedDepartmentName || null,
      founder_entity_resolution_reason: requestFacts.entityResolutionReason || null
    },
    canonical_state: {
      available: Boolean(byName.SYSTEM_STATE?.ok),
      overall_state: systemState.overall_state || "UNKNOWN",
      decision_rule: systemState.decision_rule || null,
      conflict_count: conflicts.length,
      conflicts
    },
    active_founder_decisions: activeFounderDecisions2,
    resolved_department_decisions: resolvedDepartmentDecisions,
    effective_decision_flags: flags,
    victor: {
      ai_ready_claim: systemState?.victor?.ai_ready ?? null,
      provider_claim: systemState?.victor?.provider || aiRuntime?.provider || null,
      model_claim: systemState?.victor?.model || aiRuntime?.model || null
    },
    telegram: {
      canonical_configured_claim: systemState?.communications?.telegram?.configured ?? null,
      runtime_state_claim: telegramRuntime?.state || systemState?.communications?.telegram?.state || "UNKNOWN",
      runtime_checked_at_utc: telegramRuntime?.checked_at_utc || null,
      current_request_authenticated: Boolean(requestFacts.telegramWebhookAuthenticated)
    },
    resolved_department: resolvedDepartment,
    departments,
    rules: {
      department_connectivity_default: "NOT_VERIFIED",
      live_default: "NOT_VERIFIED",
      task_success_default: "UNKNOWN",
      business_outcome_default: "UNKNOWN",
      current_operational_claim_requires_fresh_evidence: true,
      historical_plan_cannot_override_active_founder_decision: true,
      bare_aura_means: "aura3",
      aura2_requires_explicit_version: true
    }
  };
}
__name(buildTruthSnapshot, "buildTruthSnapshot");
function buildPrecedenceDirective() {
  return `
DETERMINISTIC PRECEDENCE \u2014 ${PRECEDENCE_VERSION}
Resolve conflicts by domain, never by prose similarity:

A) LATEST EXPLICIT FOUNDER DECISIONS
- Active Founder decisions govern current policy, naming, hold/park/approval state and executive direction.
- Historical BUSINESS_PLAN or old source text cannot override a newer active Founder decision.

B) FRESH RUNTIME EVIDENCE
- Fresh verified evidence governs observed live/connected/executed/business-outcome claims.
- Capability/path availability and fresh verification are separate states.

C) CANONICAL CURRENT STATE / REGISTRY
- Use reconciled SYSTEM_STATE and current registry after applying active Founder decisions.

D) ARCHITECTURE / RUNTIME STANDARD
- ARCHITECTURE_LOCK controls architecture behavior.

E) IDENTITY / CONSTITUTIONAL HARD GATES
- SOUL + MASTER_RULE_BOOK + EXECUTIVE_CHARTER define Victor identity and hard authority boundaries.

F) HISTORICAL BUSINESS/PLAN DOCUMENTS
- Use for strategy/history only. Never let stale current-state wording override A-E.

G) UNRESOLVED SAME-RANK CONFLICT
- State CONFLICTED/UNKNOWN; never silently blend.

RESOLVED CURRENT RULES:
${Object.entries(RESOLVED_RUNTIME_RULES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
`;
}
__name(buildPrecedenceDirective, "buildPrecedenceDirective");
function isDetailIntent(intent) {
  return String(intent || "").endsWith("_DETAIL");
}
__name(isDetailIntent, "isDetailIntent");
function buildExecutiveReplyDirective(intent, truthSnapshot) {
  const target = truthSnapshot?.resolved_department?.name || truthSnapshot?.request_facts?.resolved_department_name || null;
  const detail = isDetailIntent(intent);
  return `
EXECUTIVE REPLY LAYER
- Speak naturally to Founder in concise Hinglish. Sound like an executive assistant, not a status-report template.
- Answer the exact question in the first sentence.
- RESPONSE MODE: ${detail ? "DETAIL" : "BRIEF"}.
${detail ? `- Founder explicitly requested detail. Give a structured explanation, but stay relevant and avoid repetition.` : `- Hard default: 1-3 short sentences, normally under 60 words.
- No bullets, headings, status snapshots, department lists, examples, "Next:" section, or follow-up question/offer unless the Founder explicitly asked for them.
- Do not volunteer model names, loaded rule books, conflicts, other departments, process background, or examples unless they directly answer the question.
- If one sentence answers the question, stop there.`}
- Distinguish mandate/planned state from actual execution and fresh verified evidence when that distinction changes the answer.
- If a task/result is not present in current evidence, say that briefly instead of filling the gap with the mandate.
- Never manufacture a latest task, result, error, revenue, timestamp, or evidence reference.
${target ? `- Current resolved target is ${target}; keep the reply focused on this target.` : ""}
- Intent for this message: ${intent}.
`;
}
__name(buildExecutiveReplyDirective, "buildExecutiveReplyDirective");
function buildTruthContract(intent, truthSnapshot) {
  return `
TRUTH CONTRACT FOR THIS MESSAGE
Intent: ${intent}

Hard response rules:
- Never call Victor the "single source of truth".
- Never say all departments are connected/live/healthy/certified unless explicitly verified.
- Never convert historical evidence into a current-live claim.
- Latest active Founder decisions override stale BUSINESS_PLAN/current-state prose.
- If current truth is unavailable, use UNKNOWN / NOT VERIFIED / LAST KNOWN rather than guessing.
- Do not equate NOT_VERIFIED with technical impossibility; distinguish configured capability/path from fresh verification.
- If request_facts.resolved_department_id is present, answer for that department only unless Founder explicitly asks for comparison.
- If resolved_department_id is aura3 because Founder said bare AURA, do not discuss AURA2.

${buildExecutiveReplyDirective(intent, truthSnapshot)}

Machine truth snapshot:
${JSON.stringify(truthSnapshot)}
`;
}
__name(buildTruthContract, "buildTruthContract");
function wordCount(text3) {
  return String(text3 || "").trim().split(/\s+/).filter(Boolean).length;
}
__name(wordCount, "wordCount");
function nonEmptyLines(text3) {
  return String(text3 || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}
__name(nonEmptyLines, "nonEmptyLines");
function validateVictorReply(reply, intent, truthSnapshot = {}) {
  const text3 = String(reply || "");
  const lower = text3.toLowerCase();
  const violations = [];
  if (lower.includes("single source of truth")) violations.push("VICTOR_SELF_TRUTH_SOURCE_CLAIM");
  if (/\b5[- ]?minute heartbeat\b|\bheartbeat.{0,18}5[- ]?minute\b/i.test(text3)) violations.push("STALE_FIXED_5_MIN_HEARTBEAT");
  if (!isDetailIntent(intent)) {
    const lines = nonEmptyLines(text3);
    if (wordCount(text3) > 70) violations.push("BRIEF_MODE_TOO_LONG");
    if (lines.length > 3) violations.push("BRIEF_MODE_TOO_MANY_LINES");
    if (/^\s*[-•*]\s+/m.test(text3)) violations.push("BRIEF_MODE_BULLETS");
    if (/^\s*(brief|summary|current state|active status|department snapshot|next)\s*:/im.test(text3)) violations.push("BRIEF_MODE_TEMPLATE_SECTION");
    if (/\b(detail chahiye|bolo.*detail|kya pata chahiye|kis department|jaise:|want more|need more)\b/i.test(text3)) violations.push("BRIEF_MODE_UNSOLICITED_FOLLOWUP");
  }
  const deptConnectivityVerified = Array.isArray(truthSnapshot.departments) && truthSnapshot.departments.length > 0 && truthSnapshot.departments.every((d) => d.victor_connection === "VERIFIED");
  if (!deptConnectivityVerified && /(all|har)\s+(departments?|department).{0,45}\b(connected|live|healthy|supervis)/i.test(text3)) {
    violations.push("UNVERIFIED_ALL_DEPARTMENT_CONNECTIVITY");
  }
  if (String(intent || "").startsWith("ACTION_REQUEST") && !truthSnapshot?.request_facts?.consequential_executor_available && /\b(done|completed|executed|deployed|published|sent|deleted|paused|resumed|updated successfully|successfully updated)\b/i.test(text3)) {
    violations.push("UNVERIFIED_EXECUTION_CLAIM");
  }
  const currentStateClaim = text3.match(/\b(rio|aura2?|aura 3|vision|oracle|bubblebee|hulk|batman|tony|pa victor)\b.{0,30}\b(?:is|hai|are)\s+(live|connected|healthy|certified)\b/i);
  if (currentStateClaim) {
    const alias = currentStateClaim[1].toLowerCase().replace(/\s+/g, "");
    const claimedState = currentStateClaim[2].toLowerCase();
    const id = alias === "aura" || alias === "aura3" ? "aura3" : alias === "aura2" ? "aura2" : alias === "tony" ? "tony_stark" : alias === "batman" ? "batman_bruce" : alias === "pavictor" ? "pa_victor" : alias;
    const department = Array.isArray(truthSnapshot.departments) ? truthSnapshot.departments.find((item) => item.id === id) : null;
    const connectionVerified = ["VERIFIED", "CONNECTED_VERIFIED"].includes(String(department?.victor_connection || "").toUpperCase());
    const liveVerified = ["VERIFIED", "RUNTIME_VERIFIED"].includes(String(department?.live_certification || "").toUpperCase()) || String(department?.registry_status || "").toUpperCase() === "LIVE_CERTIFIED";
    const claimVerified = claimedState === "connected" ? connectionVerified : ["live", "certified"].includes(claimedState) ? liveVerified : false;
    if (!claimVerified) violations.push("DEPARTMENT_CURRENT_STATE_WITHOUT_VERIFIED_EVIDENCE");
  }
  if (truthSnapshot?.request_facts?.resolved_department_id === "aura3" && /\baura\s*2\b/i.test(text3)) {
    violations.push("WRONG_AURA_ALIAS_TARGET");
  }
  if (truthSnapshot?.effective_decision_flags?.aura2_hold && /aura\s*2.{0,45}\b(active|live|running|primary|production)\b/i.test(text3)) {
    violations.push("AURA2_HOLD_VIOLATION");
  }
  if (truthSnapshot?.effective_decision_flags?.rio_parked && /\brio\b.{0,45}\b(active|live|running|production)\b/i.test(text3)) {
    violations.push("RIO_PARKED_VIOLATION");
  }
  return { ok: violations.length === 0, violations };
}
__name(validateVictorReply, "validateVictorReply");
function buildCorrectionPrompt(violations, intent, truthSnapshot) {
  const mode = isDetailIntent(intent) ? "DETAIL" : "BRIEF";
  return `
Your previous draft violated Victor's deterministic truth/response contract.
Violations: ${violations.join(", ")}
Intent: ${intent}
Response mode: ${mode}
Rewrite from scratch using only supported claims. Latest active Founder decisions override stale business-plan text. Distinguish capability/path availability from fresh verification.${mode === "BRIEF" ? " HARD LIMIT: 1-3 short sentences, no bullets/headings/examples/follow-up question, normally under 60 words." : " Founder explicitly requested detail; structured explanation is allowed."}
Truth snapshot:
${JSON.stringify(truthSnapshot)}
`;
}
__name(buildCorrectionPrompt, "buildCorrectionPrompt");

// victor-telegram-worker/memory_runtime.mjs
var MEMORY_STOP = /* @__PURE__ */ new Set(["the", "a", "an", "is", "are", "to", "of", "and", "or", "in", "on", "for", "me", "my", "ka", "ki", "ke", "ko", "hai", "he", "kya", "aur", "se", "ye", "vo", "main", "mujhe", "this", "that", "it"]);
var LOCK_PATTERNS = [
  /\b(remember|save|store)\s+(this|it|this\s+decision|this\s+rule|this\s+instruction)\b/i,
  /\b(yaad\s+rakh(?:o)?|save\s+kar(?:o)?|store\s+kar(?:o)?|lock\s+kar(?:o)?|record\s+kar(?:o)?)\b/i,
  /\b(lock|record)\s+(this|it|this\s+decision|this\s+rule|this\s+instruction)\b/i
];
function memoryTokens(text3) {
  return new Set(String(text3 || "").toLowerCase().match(/[a-z0-9_]+/g)?.filter((x) => x.length > 1 && !MEMORY_STOP.has(x)) || []);
}
__name(memoryTokens, "memoryTokens");
function isExplicitMemoryDirective(text3) {
  const value = String(text3 || "").trim();
  return Boolean(value) && LOCK_PATTERNS.some((rx) => rx.test(value));
}
__name(isExplicitMemoryDirective, "isExplicitMemoryDirective");
function resolveFounderEntityQuery(text3) {
  const normalized = String(text3 || "").toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\brio\b/.test(normalized)) return { matched: true, entity_id: "rio", canonical_name: "RIO", reason: "EXPLICIT_RIO" };
  if (/\baura\s*2\b/.test(normalized)) return { matched: true, entity_id: "aura2", canonical_name: "AURA2", reason: "EXPLICIT_AURA2" };
  if (/\baura\s*3\b/.test(normalized) || /\baura\b/.test(normalized)) return { matched: true, entity_id: "aura3", canonical_name: "AURA3", reason: "FOUNDER_BARE_AURA_ALIAS" };
  if (/\btony(?:\s+stark)?\b/.test(normalized)) return { matched: true, entity_id: "tony_stark", canonical_name: "Tony Stark", reason: "EXPLICIT_TONY_STARK" };
  if (/\bhulk\b/.test(normalized)) return { matched: true, entity_id: "hulk", canonical_name: "HULK", reason: "EXPLICIT_HULK" };
  if (/\bvision\b/.test(normalized)) return { matched: true, entity_id: "vision", canonical_name: "Vision", reason: "EXPLICIT_VISION" };
  return { matched: false, entity_id: null, canonical_name: null, reason: null };
}
__name(resolveFounderEntityQuery, "resolveFounderEntityQuery");
function parseMemorySources(sourceRecords = []) {
  const records = [];
  for (const source of sourceRecords) {
    if (!source?.ok || typeof source.text !== "string") continue;
    if (source.name === "FOUNDER_MEMORY") {
      try {
        const data = JSON.parse(source.text);
        records.push({ class: "founder", priority: 100, data, text: JSON.stringify(data) });
      } catch (_) {
      }
    }
    if (source.name === "DECISIONS" || source.name === "OPERATIONAL_MEMORY") {
      const cls = source.name === "DECISIONS" ? "decision" : "operational";
      const priority = cls === "decision" ? 90 : 70;
      for (const line of source.text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          records.push({ class: cls, priority, data, text: JSON.stringify(data) });
        } catch (_) {
        }
      }
    }
    const layered = {
      LONG_TERM_MEMORY: ["long_term", 88],
      ACTIVE_PROJECTS_MEMORY: ["active_projects", 84],
      WORKING_MEMORY: ["working", 80],
      LEARNINGS_MEMORY: ["learning", 76],
      ACTIVITY_MEMORY: ["activity", 60],
      MEMORY_INDEX_MD: ["index", 50]
    };
    if (layered[source.name]) {
      const [cls, priority] = layered[source.name];
      records.push({
        class: cls,
        priority,
        data: { type: cls, source: source.name, content: source.text },
        text: source.text
      });
    }
  }
  return records;
}
__name(parseMemorySources, "parseMemorySources");
function activeFounderDecisions(sourceRecords = []) {
  return parseMemorySources(sourceRecords).filter((record) => record.class === "decision" && String(record.data?.status || "active").toLowerCase() === "active").map((record) => record.data);
}
__name(activeFounderDecisions, "activeFounderDecisions");
function recallMemory(query, sourceRecords = [], limit = 5) {
  const q = memoryTokens(query);
  const scored = [];
  for (const record of parseMemorySources(sourceRecords)) {
    const t = memoryTokens(record.text);
    let overlap = 0;
    for (const token of q) if (t.has(token)) overlap += 1;
    if (!overlap) continue;
    const criticalBoost = String(record.data?.priority || "").toLowerCase() === "critical" ? 5 : 0;
    const activeBoost = String(record.data?.status || "active").toLowerCase() === "active" ? 2 : -10;
    scored.push({ score: overlap * 10 + record.priority / 100 + criticalBoost + activeBoost, record });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map((x) => x.record.data);
}
__name(recallMemory, "recallMemory");
function buildMemoryContext(query, sourceRecords = [], limit = 5) {
  const memories = recallMemory(query, sourceRecords, limit);
  const active = activeFounderDecisions(sourceRecords);
  return {
    memories,
    activeFounderDecisions: active,
    prompt: memories.length ? `RELEVANT VICTOR MEMORY (use only when relevant; active newer explicit Founder decisions override older conflicting memory):
${JSON.stringify(memories)}
ACTIVE FOUNDER DECISIONS:
${JSON.stringify(active)}` : `RELEVANT VICTOR MEMORY: none retrieved for this message.
ACTIVE FOUNDER DECISIONS still govern current truth:
${JSON.stringify(active)}`
  };
}
__name(buildMemoryContext, "buildMemoryContext");
function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
__name(encodeBase64Utf8, "encodeBase64Utf8");
function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
__name(decodeBase64Utf8, "decodeBase64Utf8");
function memoryHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_MEMORY_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Dr-Victor-Memory-Runtime/2.0"
  };
}
__name(memoryHeaders, "memoryHeaders");
async function readCurrentMemory(api, headers3) {
  const current = await fetch(api, { headers: headers3, cache: "no-store" });
  if (!current.ok) return { ok: false, status: current.status, reason: `MEMORY_READ_HTTP_${current.status}` };
  const payload = await current.json();
  return { ok: true, payload };
}
__name(readCurrentMemory, "readCurrentMemory");
function recordMatches(line, normalized, messageId) {
  if (!line.trim()) return false;
  try {
    const item = JSON.parse(line);
    if (messageId != null && item?.message_id === messageId) return true;
    return String(item?.text || item?.summary || "").trim().toLowerCase() === normalized.toLowerCase();
  } catch {
    return false;
  }
}
__name(recordMatches, "recordMatches");
async function persistExplicitFounderMemory(env, text3, metadata = {}) {
  if (!isExplicitMemoryDirective(text3)) return { status: "NOT_REQUESTED" };
  if (!env.GITHUB_MEMORY_TOKEN) return { status: "PENDING_CONFIGURATION", stage: "CONFIG", reason: "GITHUB_MEMORY_TOKEN_NOT_CONFIGURED" };
  const owner = env.GITHUB_MEMORY_OWNER || "vickykenin-lang";
  const repo = env.GITHUB_MEMORY_REPO || "Dr.-Victor-Multi-AI-Orchestrator";
  const branch = env.GITHUB_MEMORY_BRANCH || "main";
  const path = "memory/decisions.jsonl";
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const headers3 = memoryHeaders(env);
  const normalized = String(text3).trim();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const current = await readCurrentMemory(api, headers3);
    if (!current.ok) return { status: "FAILED", stage: "READ", http_status: current.status, reason: current.reason };
    const payload = current.payload;
    const existing = decodeBase64Utf8(payload.content || "");
    if (existing.split(/\r?\n/).some((line) => recordMatches(line, normalized, metadata.messageId ?? null))) {
      return { status: "ALREADY_PRESENT", verified: true };
    }
    const record = {
      schema_version: 2,
      type: "founder_directive",
      authority: "FOUNDER",
      priority: "critical",
      status: "active",
      source: "telegram",
      observed_at: (/* @__PURE__ */ new Date()).toISOString(),
      text: normalized,
      chat_id: metadata.chatId ? String(metadata.chatId) : null,
      message_id: metadata.messageId ?? null
    };
    const next = `${existing.trimEnd()}${existing.trim() ? "\n" : ""}${JSON.stringify(record)}
`;
    const write = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: { ...headers3, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Persist explicit Founder memory from Victor Telegram", content: encodeBase64Utf8(next), sha: payload.sha, branch })
    });
    if (write.ok) {
      const verify = await readCurrentMemory(api, headers3);
      if (!verify.ok) return { status: "FAILED", stage: "VERIFY_READ", http_status: verify.status, reason: verify.reason, attempt };
      const verifiedText = decodeBase64Utf8(verify.payload.content || "");
      const found = verifiedText.split(/\r?\n/).some((line) => recordMatches(line, normalized, metadata.messageId ?? null));
      if (!found) return { status: "FAILED", stage: "READ_BACK_VERIFY", reason: "MEMORY_RECORD_NOT_FOUND_AFTER_WRITE", attempt };
      return { status: "PERSISTED", stage: "READ_BACK_VERIFY", verified: true, attempt };
    }
    if ((write.status === 409 || write.status === 422) && attempt < 3) continue;
    return {
      status: write.status === 409 || write.status === 422 ? "CONFLICT_RETRY_REQUIRED" : "FAILED",
      stage: "WRITE",
      http_status: write.status,
      reason: `MEMORY_WRITE_HTTP_${write.status}`,
      attempt
    };
  }
  return { status: "CONFLICT_RETRY_REQUIRED", stage: "WRITE", reason: "MEMORY_WRITE_CONFLICT_RETRY_EXHAUSTED" };
}
__name(persistExplicitFounderMemory, "persistExplicitFounderMemory");

// victor-telegram-worker/department_bridge.mjs
var GITHUB_API = "https://api.github.com";
var AURA3_REPO = "vickykenin-lang/aura-3.0";
var AURA3_WORKFLOW = "victor-aura3-transport.yml";
var AURA3_RAW = "https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main";
function aura3BridgeConfigured(env) {
  return Boolean(env.GITHUB_ORCHESTRATION_TOKEN);
}
__name(aura3BridgeConfigured, "aura3BridgeConfigured");
function selectAura3TaskType(text3) {
  const value = String(text3 || "").toLowerCase();
  if (/recover|recovery|thik|fix|repair|production.?ready|system.*(thik|fix)/.test(value)) return "RECOVERY_EXECUTE";
  if (/certif|bridge|connect|communication|strict|supervision/.test(value)) return "STRICT_SUPERVISION_PROBE";
  if (/govern|authority|soul|rule/.test(value)) return "GOVERNANCE_CHECK";
  if (/capabilit|kya kar sak|features|scope/.test(value)) return "CAPABILITY_CATALOG";
  return "STATUS_CHECK";
}
__name(selectAura3TaskType, "selectAura3TaskType");
async function dispatchAura3Task(env, text3, metadata = {}) {
  if (!aura3BridgeConfigured(env)) {
    return { status: "PENDING_CONFIGURATION", reason: "GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED" };
  }
  const actionContract = metadata.actionContract || null;
  const taskType = actionContract?.phase === "CORRECTIVE_EXECUTE" ? "RECOVERY_EXECUTE" : selectAura3TaskType(text3);
  const taskId = `victor-aura3-${Date.now()}-${metadata.messageId || "msg"}`;
  const response = await fetch(`${GITHUB_API}/repos/${AURA3_REPO}/actions/workflows/${AURA3_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref: "main",
      inputs: {
        task_id: taskId,
        task_type: taskType,
        payload: JSON.stringify({
          founder_message: String(text3 || "").slice(0, 1e3),
          requested_by: "victor",
          supervision_mode: "STRICT",
          action_contract: actionContract
        })
      }
    })
  });
  if (response.status !== 204) {
    const detail = await safeText(response);
    throw new Error(`AURA3 dispatch HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return { status: "DISPATCHED", taskId, taskType, actionContract };
}
__name(dispatchAura3Task, "dispatchAura3Task");
async function waitForAura3Result(taskId, options = {}) {
  const attempts = options.attempts || 18;
  const delayMs = options.delayMs || 4e3;
  const safeTaskId = String(taskId).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const url = `${AURA3_RAW}/integration/results/tasks/${encodeURIComponent(safeTaskId)}.json`;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    const response = await fetch(`${url}?t=${Date.now()}`, {
      headers: { "User-Agent": "Dr-Victor-AURA3-Bridge/1.0", "Cache-Control": "no-cache" }
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`AURA3 result HTTP ${response.status}`);
    const result = await response.json();
    if (result?.task_id !== taskId) continue;
    return { status: "RESULT_RECEIVED", result };
  }
  return { status: "TIMEOUT", taskId };
}
__name(waitForAura3Result, "waitForAura3Result");
function verifyAura3Result(result, expectedTaskId) {
  const strict = result?.strict_supervision || {};
  const checks = {
    task_id: result?.task_id === expectedTaskId,
    sender: result?.sender === "aura3",
    recipient: result?.recipient === "victor",
    message_type: result?.message_type === "TASK_RESULT",
    no_public_action: result?.public_action_performed === false,
    revert_to_victor: strict?.revert_to_victor === true,
    objective_alignment: Boolean(strict?.objective_alignment),
    status: Boolean(strict?.status),
    solution: Boolean(strict?.solution),
    next_action: Boolean(strict?.next_action),
    evidence: Array.isArray(strict?.evidence) && strict.evidence.length > 0
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
__name(verifyAura3Result, "verifyAura3Result");
function formatAura3ResultForFounder(result) {
  const strict = result?.strict_supervision || {};
  const blockers = strict.error_or_blocker ?? result?.blockers ?? null;
  const parts = [
    `AURA3 se fresh revert aa gaya.`,
    `Status: ${strict.status || result?.execution_status || "UNKNOWN"}`,
    `Objective alignment: ${strict.objective_alignment || "UNKNOWN"}`
  ];
  if (blockers && (!Array.isArray(blockers) || blockers.length)) {
    parts.push(`Error/Blocker: ${Array.isArray(blockers) ? blockers.join(", ") : String(blockers)}`);
  } else {
    parts.push("Error/Blocker: none reported");
  }
  if (strict.root_cause) parts.push(`Root cause: ${strict.root_cause}`);
  parts.push(`Solution: ${strict.solution || "NOT_PROVIDED"}`);
  parts.push(`Next action: ${strict.next_action || result?.next_valid_action || "NOT_PROVIDED"}`);
  parts.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(", ") : "NOT_PROVIDED"}`);
  return parts.join("\n");
}
__name(formatAura3ResultForFounder, "formatAura3ResultForFounder");
function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "Dr-Victor-Orchestrator/1.0"
  };
}
__name(githubHeaders, "githubHeaders");
async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
__name(safeText, "safeText");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
var RIO_REPO = "vickykenin-lang/rio-affiliate-engine";
var RIO_WORKFLOW = "victor-rio-transport.yml";
var RIO_RAW = "https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main";
function rioBridgeConfigured(env) {
  return Boolean(env.GITHUB_ORCHESTRATION_TOKEN);
}
__name(rioBridgeConfigured, "rioBridgeConfigured");
function selectRioTaskType(text3) {
  const value = String(text3 || "").toLowerCase();
  if (/victor goal contract|victor owned problem recovery|goal id:|org-revenue-001|replan_execute/.test(value)) return "GOAL_EXECUTE";
  if (/activat|start|resume|kaam par|self.?mode/.test(value)) return "PRIORITY_CHECK";
  if (/certif|bridge|connect|communication|strict|supervision|round.?trip/.test(value)) return "STRICT_SUPERVISION_PROBE";
  if (/govern|authority|objective|soul|rule/.test(value)) return "GOVERNANCE_CHECK";
  if (/priority|next|plan|agenda|progress/.test(value)) return "PRIORITY_CHECK";
  return "STATUS_CHECK";
}
__name(selectRioTaskType, "selectRioTaskType");
async function dispatchRioTask(env, text3, metadata = {}) {
  if (!rioBridgeConfigured(env)) return { status: "PENDING_CONFIGURATION", reason: "GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED" };
  const actionContract = metadata.actionContract || null;
  const taskType = actionContract?.phase === "COMMERCIAL_EXECUTE" ? "GOAL_EXECUTE" : selectRioTaskType(text3);
  const taskId = `victor-rio-${Date.now()}-${metadata.messageId || "msg"}`;
  const externalActionAuthorized = actionContract ? actionContract.public_action_allowed === true : taskType === "GOAL_EXECUTE";
  const response = await fetch(`${GITHUB_API}/repos/${RIO_REPO}/actions/workflows/${RIO_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref: "main",
      inputs: {
        task_id: taskId,
        task_type: taskType,
        payload: JSON.stringify({
          founder_message: String(text3 || "").slice(0, 1e3),
          requested_by: "victor",
          supervision_mode: "STRICT",
          external_action_authorized: externalActionAuthorized,
          action_contract: actionContract
        })
      }
    })
  });
  if (response.status !== 204) {
    const detail = await safeText(response);
    throw new Error(`RIO dispatch HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return { status: "DISPATCHED", taskId, taskType, actionContract };
}
__name(dispatchRioTask, "dispatchRioTask");
async function waitForRioResult(taskId, options = {}) {
  const attempts = options.attempts || 18;
  const delayMs = options.delayMs || 4e3;
  const safeTaskId = String(taskId).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const url = `${RIO_RAW}/integration/results/victor_tasks/${encodeURIComponent(safeTaskId)}.json`;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    const response = await fetch(`${url}?t=${Date.now()}`, { headers: { "User-Agent": "Dr-Victor-RIO-Bridge/1.0", "Cache-Control": "no-cache" } });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`RIO result HTTP ${response.status}`);
    const result = await response.json();
    if (result?.task_id === taskId) return { status: "RESULT_RECEIVED", result };
  }
  return { status: "TIMEOUT", taskId };
}
__name(waitForRioResult, "waitForRioResult");
function verifyRioResult(result, expectedTaskId) {
  const strict = result?.strict_supervision || {};
  const checks = {
    task_id: result?.task_id === expectedTaskId,
    sender: result?.sender === "rio",
    recipient: result?.recipient === "victor",
    message_type: result?.message_type === "TASK_RESULT",
    public_action_authorized: result?.public_action_performed === false || result?.task_type === "GOAL_EXECUTE" && result?.governed_business_cycle_performed === true && result?.external_action_authorized === true,
    no_objective_change: result?.objective_changed === false,
    no_credential_transfer: result?.credential_transfer_performed === false,
    revert_to_victor: strict?.revert_to_victor === true,
    objective_alignment: Boolean(strict?.objective_alignment),
    status: Boolean(strict?.status),
    solution: Boolean(strict?.solution),
    next_action: Boolean(strict?.next_action),
    evidence: Array.isArray(strict?.evidence) && strict.evidence.length > 0,
    follow_up_explicit: typeof strict?.requires_follow_up === "boolean"
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
__name(verifyRioResult, "verifyRioResult");
function formatRioResultForFounder(result) {
  const strict = result?.strict_supervision || {};
  const content = strict?.outcome_progress?.content || result?.snapshot?.content || null;
  const lines = [
    "RIO se fresh verified revert aa gaya.",
    `Status: ${strict.status || result?.execution_status || "UNKNOWN"}`,
    `Objective alignment: ${strict.objective_alignment || "UNKNOWN"}`
  ];
  if (content) {
    lines.push(`Ready-to-post promos: ${Number(content.ready_to_post_count) || 0}${Array.isArray(content.ready_to_post_ids) && content.ready_to_post_ids.length ? ` (${content.ready_to_post_ids.join(", ")})` : ""}`);
    lines.push(`Actually published posts: ${Number(content.actually_published_count) || 0}`);
    if (content.new_design_started_verified === true) lines.push("New-design creative: verified started");
    else if (content.new_design_started_verified === false) lines.push("New-design creative: verified not started");
    else lines.push("New-design creative: fresh verified evidence unavailable; no absolute claim.");
  }
  lines.push(`Error/Blocker: ${strict.error_or_blocker || "none reported"}`);
  lines.push(`Solution: ${strict.solution || "NOT_PROVIDED"}`);
  lines.push(`Next action: ${strict.next_action || "NOT_PROVIDED"}`);
  lines.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(", ") : "NOT_PROVIDED"}`);
  return lines.join("\n");
}
__name(formatRioResultForFounder, "formatRioResultForFounder");
var TONY_REPO = "vickykenin-lang/tony-stark-engineering";
var TONY_WORKFLOW = "victor_tony_transport.yml";
function tonyBridgeConfigured(env) {
  return Boolean(env.GITHUB_ORCHESTRATION_TOKEN);
}
__name(tonyBridgeConfigured, "tonyBridgeConfigured");
function selectTonyTaskType(text3) {
  const value = String(text3 || "").toLowerCase();
  if (/\b(task|implement|build|create|modify|upgrade|audit|inspect|solve|kaam)\b/.test(value)) return "TASK_REQUEST";
  if (/repair plan|solution|fix plan/.test(value)) return "REPAIR_PLAN";
  if (/post.?repair|verify repair|recovery verify/.test(value)) return "POST_REPAIR_VERIFY";
  if (/diagnos|error|problem|issue|root cause|blocker/.test(value)) return "DIAGNOSTIC";
  if (/health|heartbeat|runtime/.test(value)) return "HEALTH_CHECK";
  return "STATUS_CHECK";
}
__name(selectTonyTaskType, "selectTonyTaskType");
function buildTonyTaskPayload(text3, actionContract = null) {
  const founderMessage = String(text3 || "").trim().slice(0, 3e3);
  const explicitRepo = (founderMessage.match(/vickykenin-lang\/[A-Za-z0-9._-]+/i)?.[0] || "").replace(/[.,;:!?]+$/, "") || null;
  const lower = founderMessage.toLowerCase();
  const targetRepository = explicitRepo || (/\brio\b/.test(lower) ? "vickykenin-lang/rio-affiliate-engine" : null) || (/\b(memory|victor)\b/.test(lower) ? "vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator" : null);
  const fallbackActions = ["READ_REPOSITORY", "ANALYZE", "RETURN_EVIDENCE"];
  if (/\b(implement|build|create|modify|upgrade|fix|repair|solve)\b/.test(lower)) {
    fallbackActions.push("PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY");
  }
  const requestedActions = actionContract?.requested_actions?.length ? [...actionContract.requested_actions] : fallbackActions;
  const requestedLevel = founderMessage.match(/\bL([012])\b/i)?.[1];
  const contractLevel = /^L[012]$/.test(String(actionContract?.authority_level || "")) ? actionContract.authority_level : null;
  const maximumLevel = contractLevel || (requestedLevel ? `L${requestedLevel}` : "L2");
  const productionAuthorized = actionContract ? actionContract.production_allowed === true : false;
  return {
    schema_version: 1,
    objective: founderMessage,
    target_repository: targetRepository,
    requested_actions: requestedActions,
    authority: {
      requested_by: "founder_via_victor",
      supervision_mode: "STRICT",
      maximum_level: maximumLevel,
      production_activation_authorized: productionAuthorized
    },
    prohibited_actions: [
      "EXPOSE_OR_ROTATE_SECRETS",
      "PAID_ACTION",
      "DESTRUCTIVE_ACTION",
      ...productionAuthorized ? [] : ["PRODUCTION_DEPLOYMENT"],
      "LOCKED_OBJECTIVE_OR_AUTHORITY_CHANGE"
    ],
    evidence_requirements: ["TASK_RESULT_ENVELOPE", "CHANGED_FILES_OR_PLAN", "TEST_RESULTS", "BLOCKERS"],
    founder_message: founderMessage,
    action_contract: actionContract
  };
}
__name(buildTonyTaskPayload, "buildTonyTaskPayload");
async function dispatchTonyTask(env, text3, metadata = {}) {
  if (!tonyBridgeConfigured(env)) {
    return { status: "PENDING_CONFIGURATION", reason: "GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED" };
  }
  const actionContract = metadata.actionContract || null;
  const taskType = actionContract ? "TASK_REQUEST" : selectTonyTaskType(text3);
  const payload = taskType === "TASK_REQUEST" ? buildTonyTaskPayload(text3, actionContract) : {
    founder_message: String(text3 || "").slice(0, 1e3),
    requested_by: "victor",
    supervision_mode: "STRICT",
    action_contract: actionContract
  };
  const taskId = `victor-tony-${Date.now()}-${metadata.messageId || "msg"}`;
  const response = await fetch(`${GITHUB_API}/repos/${TONY_REPO}/actions/workflows/${TONY_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref: "main",
      inputs: {
        task_id: taskId,
        task_type: taskType,
        payload: JSON.stringify(payload)
      }
    })
  });
  if (response.status !== 204) {
    const detail = await safeText(response);
    throw new Error(`TONY dispatch HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return { status: "DISPATCHED", taskId, taskType, actionContract };
}
__name(dispatchTonyTask, "dispatchTonyTask");
async function waitForTonyResult(taskId, env, options = {}) {
  const attempts = options.attempts || 18;
  const delayMs = options.delayMs || 4e3;
  const safeTaskId = String(taskId).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const path = `integration/results/tasks/${safeTaskId}.json`;
  const url = `${GITHUB_API}/repos/${TONY_REPO}/contents/${path}?ref=main`;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    const response = await fetch(`${url}&t=${Date.now()}`, {
      headers: { ...githubHeaders(env), "Cache-Control": "no-cache" }
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`TONY result HTTP ${response.status}`);
    const payload = await response.json();
    const binary = atob(String(payload.content || "").replace(/\\n/g, ""));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (result?.task_id !== taskId) continue;
    return { status: "RESULT_RECEIVED", result };
  }
  return { status: "TIMEOUT", taskId };
}
__name(waitForTonyResult, "waitForTonyResult");
function verifyTonyResult(result, expectedTaskId) {
  const strict = result?.strict_supervision || {};
  const checks = {
    task_id: result?.task_id === expectedTaskId,
    sender: result?.sender === "tony_stark",
    recipient: result?.recipient === "victor",
    message_type: result?.message_type === "TASK_RESULT",
    no_destructive_action: result?.destructive_action_performed === false,
    no_paid_action: result?.paid_action_performed === false,
    no_production_action: result?.production_action_performed === false,
    revert_to_victor: strict?.revert_to_victor === true,
    objective_alignment: Boolean(strict?.objective_alignment),
    status: Boolean(strict?.status),
    solution: Boolean(strict?.solution),
    next_action: Boolean(strict?.next_action),
    evidence: Array.isArray(strict?.evidence) && strict.evidence.length > 0,
    follow_up_explicit: typeof strict?.requires_follow_up === "boolean"
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
__name(verifyTonyResult, "verifyTonyResult");
function formatTonyResultForFounder(result) {
  const strict = result?.strict_supervision || {};
  const parts = [
    "Tony Stark se fresh revert aa gaya.",
    `Status: ${strict.status || result?.execution_status || "UNKNOWN"}`,
    `Objective alignment: ${strict.objective_alignment || "UNKNOWN"}`,
    `Error/Blocker: ${strict.error_or_blocker || "none reported"}`
  ];
  if (strict.root_cause) parts.push(`Root cause: ${strict.root_cause}`);
  parts.push(`Solution: ${strict.solution || "NOT_PROVIDED"}`);
  parts.push(`Next action: ${strict.next_action || "NOT_PROVIDED"}`);
  parts.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(", ") : "NOT_PROVIDED"}`);
  return parts.join("\n");
}
__name(formatTonyResultForFounder, "formatTonyResultForFounder");

// victor-telegram-worker/emergency_pause_runtime.mjs
var VICTOR_REPO = "vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator";
var RIO_REPO2 = "vickykenin-lang/rio-affiliate-engine";
var VICTOR_PATH = "data/emergency_pause_state.json";
var RIO_PATH = "data/emergency_pause_state.json";
function headers(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "Victor-Emergency-Pause/1.1" };
}
__name(headers, "headers");
function enc(text3) {
  const bytes = new TextEncoder().encode(text3);
  let b = "";
  for (const x of bytes) b += String.fromCharCode(x);
  return btoa(b);
}
__name(enc, "enc");
function dec(text3) {
  const b = atob(String(text3 || "").replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}
__name(dec, "dec");
async function readJson(env, repo, path, fallback = {}) {
  const token = env.GITHUB_ORCHESTRATION_TOKEN || env.GITHUB_MEMORY_TOKEN;
  if (!token) return fallback;
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=main&t=${Date.now()}`, { headers: headers(token), cache: "no-store" });
  if (!r.ok) return fallback;
  const p = await r.json();
  try {
    return JSON.parse(dec(p.content || ""));
  } catch {
    return fallback;
  }
}
__name(readJson, "readJson");
async function writeJson(env, repo, path, next, message) {
  const token = env.GITHUB_ORCHESTRATION_TOKEN;
  if (!token) throw new Error("ORCHESTRATION_TOKEN_REQUIRED");
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const h = headers(token);
  let last = "UNKNOWN";
  for (let i = 1; i <= 4; i += 1) {
    const r = await fetch(`${api}?ref=main&t=${Date.now()}`, { headers: h, cache: "no-store" });
    if (!r.ok) {
      last = `READ_${r.status}`;
      if ([401, 403].includes(r.status)) break;
      continue;
    }
    const p = await r.json();
    const u = await fetch(api, { method: "PUT", headers: h, body: JSON.stringify({ message, content: enc(JSON.stringify(next, null, 2) + "\n"), sha: p.sha, branch: "main" }) });
    if (u.ok) return true;
    last = `WRITE_${u.status}`;
    if ([409, 422].includes(u.status)) continue;
    break;
  }
  throw new Error(`PAUSE_STATE_WRITE_FAILED_${repo}_${last}`);
}
__name(writeJson, "writeJson");
function parseEmergencyCommand(text3) {
  const t = String(text3 || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (t === "SYSTEM PAUSE") return { scope: "system", action: "pause", department: null };
  if (t === "SYSTEM RESUME") return { scope: "system", action: "resume", department: null };
  const m = t.match(/^(PAUSE|RESUME)\s+(RIO|TONY|TONY STARK|AURA3|AURA 3)$/);
  if (!m) return null;
  const map = { "RIO": "rio", "TONY": "tony_stark", "TONY STARK": "tony_stark", "AURA3": "aura3", "AURA 3": "aura3" };
  return { scope: "department", action: m[1] === "PAUSE" ? "pause" : "resume", department: map[m[2]] };
}
__name(parseEmergencyCommand, "parseEmergencyCommand");
async function getPauseState(env) {
  return readJson(env, VICTOR_REPO, VICTOR_PATH, { global_pause_active: false, system_state: "RUNNING", departments: {} });
}
__name(getPauseState, "getPauseState");
async function isExecutionPaused(env, department = null) {
  const s = await getPauseState(env);
  const ds = department ? s.departments?.[department] : null;
  const global = s.global_pause_active === true || String(s.system_state || "").toUpperCase() === "PAUSED";
  return { paused: global || ds?.pause_active === true, global_pause_active: global, department_pause_active: ds?.pause_active === true, department };
}
__name(isExecutionPaused, "isExecutionPaused");
async function applyEmergencyCommand(env, command, metadata = {}) {
  if (!command) throw new Error("INVALID_PAUSE_COMMAND");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let s = await getPauseState(env);
  s = { ...s, schema_version: 1, canonical: true, authority: "FOUNDER_VIA_VICTOR", departments: { ...s.departments || {} }, last_command: command.scope === "system" ? `SYSTEM ${command.action.toUpperCase()}` : `${command.action.toUpperCase()} ${command.department}`, last_command_at_utc: now, last_command_source: "FOUNDER_TELEGRAM" };
  if (command.scope === "system") {
    const paused = command.action === "pause";
    s.global_pause_active = paused;
    s.system_state = paused ? "PAUSED" : "RUNNING";
    s.pause_reason = paused ? metadata.reason || "FOUNDER_SYSTEM_PAUSE" : null;
  } else {
    s.global_pause_active = s.global_pause_active === true;
    s.system_state = s.global_pause_active ? "PAUSED" : "RUNNING";
    s.pause_reason = s.global_pause_active ? s.pause_reason || "FOUNDER_SYSTEM_PAUSE" : null;
    s.departments[command.department] = { ...s.departments[command.department] || {}, pause_active: command.action === "pause", state: command.action === "pause" ? "PAUSED" : "RUNNING", updated_at_utc: now, authority: "FOUNDER_VIA_VICTOR" };
  }
  await writeJson(env, VICTOR_REPO, VICTOR_PATH, s, `safety: ${s.last_command}`);
  let rioMirror = "NOT_APPLICABLE";
  if (command.scope === "system" || command.department === "rio") {
    const rs = await readJson(env, RIO_REPO2, RIO_PATH, { schema_version: 1 });
    const global = command.scope === "system" ? command.action === "pause" : Boolean(s.global_pause_active);
    const dept = command.scope === "department" ? command.action === "pause" : Boolean(rs.department_pause_active);
    const next = { ...rs, schema_version: 1, system_state: global ? "PAUSED" : "RUNNING", global_pause_active: global, department_pause_active: dept, authority: "FOUNDER_VIA_VICTOR", last_command: s.last_command, last_command_at_utc: now };
    try {
      await writeJson(env, RIO_REPO2, RIO_PATH, next, `safety: mirror ${s.last_command}`);
      rioMirror = "ACKNOWLEDGED";
    } catch (e) {
      rioMirror = "PAUSE_UNCONFIRMED";
      if (command.action === "pause") return { status: "PAUSE_UNCONFIRMED", state: s, rio_mirror: rioMirror, error: String(e.message || e) };
    }
  }
  return { status: command.action === "pause" ? "PAUSED" : "RESUMED", state: s, rio_mirror: rioMirror };
}
__name(applyEmergencyCommand, "applyEmergencyCommand");

// brain/runtime.mjs
function normalize(value) {
  return String(value || "").trim().toUpperCase();
}
__name(normalize, "normalize");
function shouldRunFiveWhys({
  rootCauseKnown = false,
  repeatedFailureCount = 0,
  sameRecommendationCount = 0,
  hasNewEvidence = true,
  departmentExplainsFailure = true,
  confidence = "MEDIUM"
} = {}) {
  if (!rootCauseKnown && normalize(confidence) === "LOW") return true;
  if (Number(repeatedFailureCount) >= 2) return true;
  if (Number(sameRecommendationCount) >= 2) return true;
  if (departmentExplainsFailure === false) return true;
  return false;
}
__name(shouldRunFiveWhys, "shouldRunFiveWhys");
function reviewOutcome({ expected, actual, previousAction = null, sameActionCount = 0, hasNewEvidence = true } = {}) {
  const matched = JSON.stringify(expected ?? null) === JSON.stringify(actual ?? null);
  const semanticRepeat = Number(sameActionCount) >= 2 && matched;
  const repeatLoop = semanticRepeat || Number(sameActionCount) >= 2 && hasNewEvidence === false;
  return {
    expected,
    actual,
    matched,
    previous_action: previousAction,
    repeat_loop_detected: repeatLoop,
    learning_candidate: repeatLoop ? "REPEATED_MEANING_FAILURE_PATTERN" : matched ? "SUCCESS_PATTERN_CANDIDATE" : "MISMATCH_OR_FAILURE_PATTERN_CANDIDATE",
    required_next_mode: repeatLoop ? "FIVE_WHYS_BEFORE_NEXT_DISPATCH" : "NORMAL_REPLAN"
  };
}
__name(reviewOutcome, "reviewOutcome");
function departmentCapabilityFit(department, taskText) {
  const dept = normalize(department);
  const text3 = normalize(taskText);
  const patterns = {
    TONY_STARK: /TECHNICAL|ENGINEERING|DEBUG|ROOT CAUSE|WORKFLOW|CODE|CONFIG|DEPLOY|ARCHITECTURE|WEBSITE/,
    RIO: /AFFILIATE|REVENUE|OFFER|TRAFFIC|CONVERSION|COMMISSION|COMMERCIAL/,
    HULK: /RESEARCH|MARKET|EVIDENCE|INVESTIGATE|EXTERNAL INFORMATION/,
    AURA3: /CREATIVE|CONTENT|DESIGN|SOCIAL|ASSET/
  };
  const pattern = patterns[dept];
  return pattern ? pattern.test(text3) : false;
}
__name(departmentCapabilityFit, "departmentCapabilityFit");

// brain/action_contract.mjs
var PHASES = /* @__PURE__ */ new Set([
  "DIAGNOSE",
  "PLAN",
  "CORRECTIVE_EXECUTE",
  "COMMERCIAL_EXECUTE",
  "VERIFY",
  "MONITOR"
]);
var TARGETS = /* @__PURE__ */ new Set(["tony_stark", "rio", "aura3", "hulk", "internal"]);
var DEFAULT_FOUNDER_GATES = [
  "CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION",
  "SPEND_ABOVE_EXPLICIT_CONFIGURED_BUDGET_CEILING",
  "IRREVERSIBLE_HIGH_IMPACT_EXTERNAL_COMMITMENT",
  "UNRESOLVED_LEGAL_OR_SECURITY_JUDGMENT",
  "FOUNDER_PAUSE_OR_OBJECTIVE_CHANGE",
  "VERIFIED_OBJECTIVE_IMPOSSIBILITY_REQUIRING_FOUNDER_DECISION"
];
var PHASE_ACTIONS = {
  DIAGNOSE: ["READ_REPOSITORY", "ANALYZE", "RETURN_EVIDENCE"],
  PLAN: ["READ_REPOSITORY", "ANALYZE", "PROPOSE_PLAN", "RETURN_EVIDENCE"],
  CORRECTIVE_EXECUTE: [
    "READ_REPOSITORY",
    "ANALYZE",
    "PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY",
    "RUN_TESTS",
    "RETURN_EVIDENCE"
  ],
  COMMERCIAL_EXECUTE: [
    "READ_REPOSITORY",
    "ANALYZE",
    "EXECUTE_GOVERNED_BUSINESS_ACTION",
    "COLLECT_EVIDENCE",
    "RETURN_EVIDENCE"
  ],
  VERIFY: ["VERIFY_RESULT", "COLLECT_EVIDENCE", "RETURN_EVIDENCE"],
  MONITOR: ["COLLECT_EVIDENCE", "RETURN_EVIDENCE"]
};
var EXPECTED_PROGRESS = {
  DIAGNOSE: ["ROOT_CAUSE_ADVANCED", "HYPOTHESIS_CONFIRMED_OR_REJECTED", "MATERIAL_NEW_EVIDENCE"],
  PLAN: ["EXECUTABLE_PLAN_CREATED", "BLOCKER_REMOVAL_PATH_IDENTIFIED"],
  CORRECTIVE_EXECUTE: ["CORRECTIVE_CHANGE_APPLIED", "TEST_RESULT_CHANGED", "BLOCKER_REMOVED"],
  COMMERCIAL_EXECUTE: ["COMMERCIAL_ACTION_COMPLETED", "FUNNEL_STATE_ADVANCED", "EXTERNAL_OUTCOME_OBSERVED"],
  VERIFY: ["VERIFIED_STATE_TRANSITION", "OUTCOME_VERIFIED"],
  MONITOR: ["MATERIAL_NEW_EVIDENCE"]
};
var EXIT_CRITERIA = {
  DIAGNOSE: ["ROOT_CAUSE_OR_BOUNDED_HYPOTHESES_RETURNED", "FRESH_EVIDENCE_RETURNED"],
  PLAN: ["EXECUTABLE_NEXT_ACTION_IDENTIFIED", "AUTHORITY_AND_EVIDENCE_REQUIREMENTS_EXPLICIT"],
  CORRECTIVE_EXECUTE: ["AUTHORIZED_CORRECTIVE_ACTION_ATTEMPTED", "TEST_OR_VERIFICATION_EVIDENCE_RETURNED"],
  COMMERCIAL_EXECUTE: ["POLICY_VALID_COMMERCIAL_ACTION_ATTEMPTED", "EXTERNAL_OR_FUNNEL_EVIDENCE_RETURNED"],
  VERIFY: ["EXPECTED_RESULT_CHECKED", "VERIFICATION_EVIDENCE_RETURNED"],
  MONITOR: ["FRESH_OBSERVATION_RETURNED"]
};
function norm(value) {
  return String(value || "").trim();
}
__name(norm, "norm");
function upper(value) {
  return norm(value).toUpperCase();
}
__name(upper, "upper");
function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}
__name(unique, "unique");
function resolveActionPhase({ target, runtimePhase = "EXECUTE", runtimeGoal = {} } = {}) {
  const resolvedTarget = norm(target).toLowerCase();
  const requested = upper(runtimePhase);
  const priorStatus = upper(runtimeGoal?.last_status);
  const priorMode = upper(runtimeGoal?.brain_required_mode);
  const priorRequiredNextMode = upper(runtimeGoal?.brain_review?.required_next_mode);
  if (PHASES.has(requested)) return requested;
  if (requested === "FIVE_WHYS_DIAGNOSIS" || priorMode === "FIVE_WHYS_BEFORE_NEXT_DISPATCH") {
    return "DIAGNOSE";
  }
  if (resolvedTarget === "tony_stark") {
    const correctiveContinuation = requested === "REPLAN_EXECUTE" || priorStatus === "FIVE_WHYS_DIAGNOSIS_COMPLETED" || priorRequiredNextMode === "NORMAL_REPLAN";
    return correctiveContinuation ? "CORRECTIVE_EXECUTE" : "PLAN";
  }
  if (resolvedTarget === "rio") return "COMMERCIAL_EXECUTE";
  if (resolvedTarget === "aura3") return requested === "REPLAN_EXECUTE" ? "CORRECTIVE_EXECUTE" : "PLAN";
  if (resolvedTarget === "hulk") return "DIAGNOSE";
  return "PLAN";
}
__name(resolveActionPhase, "resolveActionPhase");
function buildActionContract({ goal = {}, target, runtimePhase = "EXECUTE", runtimeGoal = {}, actionId = null } = {}) {
  const phase = resolveActionPhase({ target, runtimePhase, runtimeGoal });
  const resolvedTarget = norm(target).toLowerCase() || "internal";
  const mutationAllowed = phase === "CORRECTIVE_EXECUTE";
  const governedCommercial = phase === "COMMERCIAL_EXECUTE" && resolvedTarget === "rio";
  const authorityLevel = mutationAllowed ? "L2" : governedCommercial ? "GOVERNED_PRODUCTION" : "L1";
  return {
    contract_version: 1,
    objective_id: goal?.goal_id || null,
    action_id: actionId || `${goal?.goal_id || "objective"}:${resolvedTarget}:${phase}`,
    phase,
    target: resolvedTarget,
    requested_actions: [...PHASE_ACTIONS[phase] || []],
    authority_level: authorityLevel,
    mutation_allowed: mutationAllowed,
    production_allowed: governedCommercial,
    public_action_allowed: governedCommercial,
    spend_allowed: false,
    expected_progress_delta: [...EXPECTED_PROGRESS[phase] || []],
    exit_criteria: [...EXIT_CRITERIA[phase] || []],
    founder_gate_if: unique([
      ...Array.isArray(goal?.founder_gate) ? goal.founder_gate : [],
      ...DEFAULT_FOUNDER_GATES
    ]),
    hard_boundaries: unique(Array.isArray(goal?.hard_boundaries) ? goal.hard_boundaries : []),
    source_runtime_phase: upper(runtimePhase) || "EXECUTE"
  };
}
__name(buildActionContract, "buildActionContract");
function validateActionContract(contract = {}, goal = {}) {
  const errors = [];
  const phase = upper(contract.phase);
  const target = norm(contract.target).toLowerCase();
  const actions = Array.isArray(contract.requested_actions) ? contract.requested_actions : [];
  const allowedDepartments = Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : [];
  if (Number(contract.contract_version) !== 1) errors.push("CONTRACT_VERSION_UNSUPPORTED");
  if (!contract.objective_id) errors.push("OBJECTIVE_ID_REQUIRED");
  if (!PHASES.has(phase)) errors.push("PHASE_INVALID");
  if (!TARGETS.has(target)) errors.push("TARGET_INVALID");
  if (goal?.goal_id && contract.objective_id !== goal.goal_id) errors.push("OBJECTIVE_ID_MISMATCH");
  if (allowedDepartments.length && !allowedDepartments.includes(target)) errors.push("TARGET_NOT_ALLOWED_BY_GOAL");
  if (!actions.length) errors.push("REQUESTED_ACTIONS_REQUIRED");
  if (!Array.isArray(contract.expected_progress_delta) || !contract.expected_progress_delta.length) errors.push("EXPECTED_PROGRESS_DELTA_REQUIRED");
  if (!Array.isArray(contract.exit_criteria) || !contract.exit_criteria.length) errors.push("EXIT_CRITERIA_REQUIRED");
  if (!Array.isArray(contract.founder_gate_if) || !contract.founder_gate_if.length) errors.push("FOUNDER_GATE_REQUIRED");
  const canonicalActions = PHASE_ACTIONS[phase] || [];
  for (const action of actions) {
    if (!canonicalActions.includes(action)) errors.push(`ACTION_NOT_ALLOWED_FOR_PHASE:${action}`);
  }
  if (phase === "CORRECTIVE_EXECUTE") {
    if (!["tony_stark", "aura3"].includes(target)) errors.push("CORRECTIVE_EXECUTE_TARGET_INVALID");
    if (contract.mutation_allowed !== true) errors.push("CORRECTIVE_EXECUTE_REQUIRES_MUTATION_ALLOWED");
    if (!actions.includes("PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY")) errors.push("CORRECTIVE_EXECUTE_REQUIRES_CHANGE_ACTION");
    if (!actions.includes("RUN_TESTS")) errors.push("CORRECTIVE_EXECUTE_REQUIRES_TESTS");
    if (contract.production_allowed === true) errors.push("CORRECTIVE_EXECUTE_PRODUCTION_MUST_BE_FALSE");
    if (contract.public_action_allowed === true) errors.push("CORRECTIVE_EXECUTE_PUBLIC_ACTION_MUST_BE_FALSE");
    if (contract.spend_allowed === true) errors.push("CORRECTIVE_EXECUTE_SPEND_MUST_BE_FALSE");
  } else if (contract.mutation_allowed === true) {
    errors.push("MUTATION_NOT_ALLOWED_FOR_PHASE");
  }
  if (phase === "COMMERCIAL_EXECUTE") {
    if (target !== "rio") errors.push("COMMERCIAL_EXECUTE_TARGET_MUST_BE_RIO");
    if (contract.spend_allowed === true) errors.push("UNLOCKED_SPEND_PROHIBITED");
  } else {
    if (contract.production_allowed === true) errors.push("PRODUCTION_NOT_ALLOWED_FOR_PHASE");
    if (contract.public_action_allowed === true) errors.push("PUBLIC_ACTION_NOT_ALLOWED_FOR_PHASE");
  }
  if (phase === "DIAGNOSE" && !["tony_stark", "hulk"].includes(target)) {
    errors.push("DIAGNOSE_TARGET_INVALID");
  }
  if (actions.some((action) => /CREDENTIAL|SECRET|ROTATE|REVOKE|DELETE_ACCOUNT/i.test(String(action)))) {
    errors.push("CREDENTIAL_OR_IDENTITY_ACTION_PROHIBITED");
  }
  return {
    ok: errors.length === 0,
    errors,
    contract
  };
}
__name(validateActionContract, "validateActionContract");
function summarizeActionContract(contract = {}) {
  return [
    `Action Contract V${contract.contract_version || "?"}`,
    `Phase: ${contract.phase || "UNKNOWN"}`,
    `Target: ${contract.target || "UNKNOWN"}`,
    `Authority: ${contract.authority_level || "UNKNOWN"}`,
    `Mutation: ${contract.mutation_allowed === true ? "YES" : "NO"}`,
    `Production: ${contract.production_allowed === true ? "YES" : "NO"}`,
    `Public action: ${contract.public_action_allowed === true ? "YES" : "NO"}`,
    `Spend: ${contract.spend_allowed === true ? "YES" : "NO"}`,
    `Requested actions: ${(contract.requested_actions || []).join(", ") || "NONE"}`,
    `Expected progress: ${(contract.expected_progress_delta || []).join(", ") || "NONE"}`
  ].join("\n");
}
__name(summarizeActionContract, "summarizeActionContract");

// brain/progress_contract.mjs
function norm2(value) {
  return String(value || "").trim();
}
__name(norm2, "norm");
function upper2(value) {
  return norm2(value).toUpperCase();
}
__name(upper2, "upper");
function stableList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => upper2(v)).filter(Boolean))].sort();
}
__name(stableList, "stableList");
function buildStrategyFingerprint(actionContract = {}) {
  return [
    norm2(actionContract.target).toLowerCase(),
    upper2(actionContract.phase),
    upper2(actionContract.authority_level),
    actionContract.mutation_allowed === true ? "M1" : "M0",
    actionContract.production_allowed === true ? "P1" : "P0",
    stableList(actionContract.requested_actions).join(",")
  ].join("|");
}
__name(buildStrategyFingerprint, "buildStrategyFingerprint");
function explicitProgressDelta(result = {}, strict = {}) {
  const candidate = strict.progress_delta || result.progress_delta || null;
  if (!candidate || typeof candidate !== "object") return null;
  const rawTypes = Array.isArray(candidate.types) ? candidate.types : candidate.type ? [candidate.type] : [];
  const types = stableList(rawTypes);
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.filter(Boolean) : [];
  return {
    material: candidate.material === true && types.length > 0,
    types,
    evidence,
    source: "EXPLICIT_DEPARTMENT_DELTA",
    detail: candidate.detail || null
  };
}
__name(explicitProgressDelta, "explicitProgressDelta");
function resultSignals(result = {}, assessment = {}) {
  const strict = result?.strict_supervision || {};
  const status = upper2(assessment.status || strict.status || result.execution_status);
  const nextAction = upper2(assessment.nextAction || strict.next_action);
  const rootCause = norm2(assessment.rootCause || strict.root_cause || result.root_cause);
  const finalOutcome = assessment.finalOutcome || strict.final_outcome || result.final_outcome || null;
  const outcomeProgress = assessment.outcomeProgress || strict.outcome_progress || result.outcome_progress || null;
  return { strict, status, nextAction, rootCause, finalOutcome, outcomeProgress };
}
__name(resultSignals, "resultSignals");
function materiallyDifferentText(current, previous) {
  const now = upper2(current);
  const before = upper2(previous);
  return Boolean(now) && now !== before;
}
__name(materiallyDifferentText, "materiallyDifferentText");
function evaluateProgressDelta({ previousGoal = {}, actionContract = {}, outcome = {}, rawResult = {} } = {}) {
  const assessment = outcome.assessment || {};
  const { strict, status, nextAction, rootCause, finalOutcome, outcomeProgress } = resultSignals(rawResult, assessment);
  const phase = upper2(actionContract.phase || outcome.actionContract?.phase);
  const evidence = Array.isArray(assessment.evidence) ? assessment.evidence.filter(Boolean) : [];
  if (outcome.verified !== true) {
    return {
      material: false,
      types: ["EXECUTION_UNVERIFIED"],
      evidence: [],
      source: "VERIFIER",
      reason: "DEPARTMENT_RESULT_NOT_VERIFIED"
    };
  }
  if (assessment.goalAchieved === true) {
    return {
      material: true,
      types: ["OUTCOME_VERIFIED"],
      evidence,
      source: "GOAL_VERIFIER",
      reason: "GOAL_SUCCESS_CONDITIONS_VERIFIED"
    };
  }
  const explicit = explicitProgressDelta(rawResult, strict);
  if (explicit) {
    if (explicit.material && explicit.evidence.length === 0 && evidence.length === 0) {
      return { ...explicit, material: false, reason: "EXPLICIT_DELTA_WITHOUT_EVIDENCE" };
    }
    return explicit;
  }
  const types = [];
  const source = "DETERMINISTIC_INFERENCE";
  let reason = null;
  if (assessment.founderGate === true) {
    const changedGate = previousGoal.state !== "FOUNDER_ONLY_BLOCKER" || materiallyDifferentText(nextAction, previousGoal.last_next_action);
    if (changedGate) types.push("FOUNDER_BOUNDARY_VERIFIED");
  }
  if (assessment.hasBlocker === true) {
    const blockerChanged = previousGoal.state !== "BLOCKED_RETRYABLE" || rootCause && materiallyDifferentText(rootCause, previousGoal.last_root_cause) || materiallyDifferentText(nextAction, previousGoal.last_next_action);
    if (blockerChanged) types.push("BLOCKER_IDENTIFIED");
  }
  if (phase === "DIAGNOSE") {
    if (rootCause && materiallyDifferentText(rootCause, previousGoal.last_root_cause)) {
      types.push("ROOT_CAUSE_ADVANCED");
    }
    const whyChain = strict.why_chain || rawResult.why_chain;
    if (Array.isArray(whyChain) && whyChain.some((item) => upper2(item?.status) === "VERIFIED")) {
      types.push("HYPOTHESIS_CONFIRMED_OR_REJECTED");
    }
    if (!types.length) reason = "DIAGNOSIS_RETURNED_NO_NEW_CAUSAL_STATE";
  } else if (phase === "PLAN") {
    if (materiallyDifferentText(nextAction, previousGoal.last_next_action) && !/REVIEW|AUDIT|PLAN|AUTHORIZE/.test(nextAction)) {
      types.push("BLOCKER_REMOVAL_PATH_IDENTIFIED");
    }
    if (!types.length) reason = "PLAN_DID_NOT_CREATE_MATERIALLY_DIFFERENT_EXECUTABLE_PATH";
  } else if (phase === "CORRECTIVE_EXECUTE") {
    const repairExecuted = rawResult.repair_executed === true || strict.repair_executed === true || rawResult.code_change_applied === true || strict.code_change_applied === true;
    const changedFiles = strict.changed_files || rawResult.changed_files || rawResult.files_changed || [];
    const tests = strict.test_results || rawResult.test_results || null;
    const readOnly = /READ[_ -]?ONLY|AUDIT_COMPLETED|DIAGNOSIS_COMPLETED|PLAN_READY/.test(status);
    if (repairExecuted || Array.isArray(changedFiles) && changedFiles.length > 0) types.push("CORRECTIVE_CHANGE_APPLIED");
    if (tests && !/NOT_RUN|UNVERIFIED|UNKNOWN/.test(upper2(typeof tests === "string" ? tests : JSON.stringify(tests)))) {
      types.push("TEST_RESULT_CHANGED");
    }
    if (/BLOCKER_REMOVED|RECOVERY_VERIFIED|REPAIRED|FIXED|IMPLEMENTED/.test(status) && !readOnly) {
      types.push("BLOCKER_REMOVED");
    }
    if (readOnly) {
      reason = "CORRECTIVE_EXECUTE_DEGRADED_TO_READ_ONLY_ACTIVITY";
      types.length = 0;
    } else if (!types.length) {
      reason = "CORRECTIVE_EXECUTE_RETURNED_NO_PROOF_OF_CHANGE_OR_RECOVERY";
    }
  } else if (phase === "COMMERCIAL_EXECUTE") {
    const governedCycle = rawResult.governed_business_cycle_performed === true;
    const publicAction = rawResult.public_action_performed === true;
    const commercialStatus = /PUBLISHED|POSTED|CLICK|LEAD|CONVERSION|COMMISSION|PAYMENT|COMMERCIAL_ACTION/.test(status);
    const structuredProgress = outcomeProgress && typeof outcomeProgress === "object" ? JSON.stringify(outcomeProgress) : norm2(outcomeProgress);
    if (governedCycle || publicAction || commercialStatus) types.push("COMMERCIAL_ACTION_COMPLETED");
    if (structuredProgress && materiallyDifferentText(structuredProgress, previousGoal.last_outcome_progress_fingerprint)) {
      types.push("FUNNEL_STATE_ADVANCED");
    }
    if (finalOutcome?.verified === true && Array.isArray(finalOutcome.evidence) && finalOutcome.evidence.length > 0) {
      types.push("EXTERNAL_OUTCOME_OBSERVED");
    }
    if (!types.length) reason = "COMMERCIAL_EXECUTE_RETURNED_NO_MATERIAL_FUNNEL_OR_EXTERNAL_DELTA";
  } else if (phase === "VERIFY") {
    if (/VERIFIED|PASS|RECOVERY|HEALTHY/.test(status) && !/NOT_VERIFIED|FAILED|BLOCKED/.test(status)) {
      types.push("VERIFIED_STATE_TRANSITION");
    }
    if (finalOutcome?.verified === true) types.push("OUTCOME_VERIFIED");
    if (!types.length) reason = "VERIFY_RETURNED_NO_VERIFIED_STATE_TRANSITION";
  } else if (phase === "MONITOR") {
    if (strict.material_observation === true || rawResult.material_observation === true) {
      types.push("MATERIAL_NEW_EVIDENCE");
    }
    if (!types.length) reason = "MONITOR_RETURNED_NO_MATERIAL_OBSERVATION";
  }
  return {
    material: types.length > 0,
    types: stableList(types),
    evidence: types.length ? evidence : [],
    source,
    reason: types.length ? null : reason || "NO_MATERIAL_PROGRESS_PREDICATE_MET"
  };
}
__name(evaluateProgressDelta, "evaluateProgressDelta");
function nextConvergenceState({ previousGoal = {}, progressDelta = {}, strategyFingerprint = "", actionContract = {} } = {}) {
  const wasNoProgress = Number(previousGoal.no_progress_count || 0);
  const previousStalled = norm2(previousGoal.stalled_strategy_fingerprint);
  const phase = upper2(actionContract.phase);
  if (progressDelta.material === true) {
    const diagnosticRecovery = phase === "DIAGNOSE" && Boolean(previousStalled);
    return {
      no_progress_count: 0,
      stalled_strategy_fingerprint: diagnosticRecovery ? previousStalled : null,
      recovery_generation: diagnosticRecovery ? Number(previousGoal.recovery_generation || 0) + 1 : Number(previousGoal.recovery_generation || 0),
      must_change_strategy: diagnosticRecovery
    };
  }
  const nextNoProgress = wasNoProgress + 1;
  return {
    no_progress_count: nextNoProgress,
    stalled_strategy_fingerprint: previousStalled || strategyFingerprint || null,
    recovery_generation: Number(previousGoal.recovery_generation || 0),
    must_change_strategy: nextNoProgress >= 2 || Boolean(previousGoal.must_change_strategy)
  };
}
__name(nextConvergenceState, "nextConvergenceState");
function validateStrategyChange({ previousGoal = {}, actionContract = {} } = {}) {
  const currentFingerprint = buildStrategyFingerprint(actionContract);
  const stalled = norm2(previousGoal.stalled_strategy_fingerprint);
  const mustChange = previousGoal.must_change_strategy === true;
  if (mustChange && stalled && currentFingerprint === stalled) {
    return {
      ok: false,
      code: "STALLED_STRATEGY_REUSE_BLOCKED",
      current_fingerprint: currentFingerprint,
      stalled_fingerprint: stalled
    };
  }
  return {
    ok: true,
    code: null,
    current_fingerprint: currentFingerprint,
    stalled_fingerprint: stalled || null
  };
}
__name(validateStrategyChange, "validateStrategyChange");

// brain/executive_reasoning.mjs
var ALLOWED_PHASES = /* @__PURE__ */ new Set([
  "DIAGNOSE",
  "PLAN",
  "CORRECTIVE_EXECUTE",
  "COMMERCIAL_EXECUTE",
  "VERIFY",
  "MONITOR"
]);
var PHASE_TARGET_CONTRACT = Object.freeze({
  DIAGNOSE: ["tony_stark", "hulk"],
  CORRECTIVE_EXECUTE: ["tony_stark", "aura3"],
  COMMERCIAL_EXECUTE: ["rio"],
  PLAN: ["rio", "tony_stark", "aura3", "hulk"],
  VERIFY: ["rio", "tony_stark", "aura3", "hulk"],
  MONITOR: ["rio", "tony_stark", "aura3", "hulk"]
});
var AUTHORITY_KEYS = /* @__PURE__ */ new Set([
  "requested_actions",
  "authority_level",
  "mutation_allowed",
  "production_allowed",
  "public_action_allowed",
  "spend_allowed",
  "founder_gate_if",
  "credentials",
  "credential",
  "secret",
  "secrets",
  "budget_override",
  "pause_override"
]);
function norm3(value) {
  return String(value || "").trim();
}
__name(norm3, "norm");
function upper3(value) {
  return norm3(value).toUpperCase();
}
__name(upper3, "upper");
function unique2(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => norm3(value)).filter(Boolean))];
}
__name(unique2, "unique");
function finiteConfidence(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}
__name(finiteConfidence, "finiteConfidence");
function supportedPlanVersion(value) {
  return value === 1 || typeof value === "string" && value.trim() === "1";
}
__name(supportedPlanVersion, "supportedPlanVersion");
function repairableValidationErrors(errors = []) {
  return errors.length > 0 && !errors.some((error) => String(error).startsWith("AUTHORITY_FIELDS_PROHIBITED:"));
}
__name(repairableValidationErrors, "repairableValidationErrors");
function extractJsonText(content) {
  const raw = norm3(content);
  if (!raw) throw Object.assign(new Error("Executive reasoner returned empty output"), { code: "EXECUTIVE_PLAN_EMPTY" });
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  throw Object.assign(new Error("Executive reasoner output did not contain a JSON object"), { code: "EXECUTIVE_PLAN_NOT_JSON" });
}
__name(extractJsonText, "extractJsonText");
function findAuthorityKeys(value, path = "$", found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findAuthorityKeys(item, `${path}[${index}]`, found));
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (AUTHORITY_KEYS.has(String(key).toLowerCase())) found.push(`${path}.${key}`);
    findAuthorityKeys(child, `${path}.${key}`, found);
  }
  return found;
}
__name(findAuthorityKeys, "findAuthorityKeys");
function shouldInvokeExecutiveReasoner(runtimeGoal = {}, options = {}) {
  if (options.force === true) return true;
  const state = upper3(runtimeGoal.state);
  if (runtimeGoal.must_change_strategy === true) return true;
  if (state === "NO_PROGRESS") return true;
  if (Number(runtimeGoal.no_progress_count || 0) >= 2) return true;
  if (upper3(runtimeGoal.brain_required_mode) === "EXECUTIVE_REASONER_REQUIRED") return true;
  return false;
}
__name(shouldInvokeExecutiveReasoner, "shouldInvokeExecutiveReasoner");
function buildExecutiveReasoningPrompt({ goal = {}, runtimeGoal = {}, availableDepartments: availableDepartments2 = [], trigger = "NO_PROGRESS_REPLAN" } = {}) {
  const system = [
    "You are Victor Executive Reasoner. Return ONLY one JSON object matching the requested planning schema.",
    "You are a bounded planner/advisor, not an authority engine.",
    "Do not grant permissions, credentials, spend, production, public-action, pause, or security authority.",
    "Do not claim success. Current evidence and deterministic policy gates remain authoritative.",
    "Choose only from the supplied available departments and allowed phases.",
    "Respect the supplied phase_target_contract exactly; a phase and target must be compatible.",
    "Prefer a materially different strategy when the current strategy is stalled.",
    "If evidence is insufficient, identify exact unknowns and evidence needed. Do not fabricate facts."
  ].join("\n");
  const user = JSON.stringify({
    request: "PROPOSE_NEXT_EXECUTIVE_STRATEGY",
    output_schema: {
      plan_version: 1,
      strategy_summary: "string",
      target: "available department id",
      phase: "DIAGNOSE|PLAN|CORRECTIVE_EXECUTE|COMMERCIAL_EXECUTE|VERIFY|MONITOR",
      hypotheses: ["string"],
      unknowns: ["string"],
      evidence_needed: ["string"],
      expected_progress_delta: ["string"],
      confidence: 0,
      needs_founder_guidance: false,
      founder_question: null
    },
    trigger,
    objective: {
      goal_id: goal.goal_id || null,
      title: goal.title || null,
      objective: goal.objective || null,
      success_conditions: Array.isArray(goal.success_conditions) ? goal.success_conditions : [],
      required_evidence_level: goal.required_evidence_level || null,
      allowed_departments: Array.isArray(goal.allowed_departments) ? goal.allowed_departments : [],
      primary_department: goal.primary_department || null,
      hard_boundaries: Array.isArray(goal.hard_boundaries) ? goal.hard_boundaries : [],
      founder_gate: Array.isArray(goal.founder_gate) ? goal.founder_gate : []
    },
    current_runtime: {
      state: runtimeGoal.state || null,
      attempts: Number(runtimeGoal.attempts || 0),
      last_target: runtimeGoal.last_target || null,
      recommended_department: runtimeGoal.recommended_department || null,
      last_status: runtimeGoal.last_status || null,
      last_next_action: runtimeGoal.last_next_action || null,
      last_root_cause: runtimeGoal.last_root_cause || null,
      no_progress_count: Number(runtimeGoal.no_progress_count || 0),
      stalled_strategy_fingerprint: runtimeGoal.stalled_strategy_fingerprint || null,
      recovery_generation: Number(runtimeGoal.recovery_generation || 0),
      last_progress_delta: runtimeGoal.last_progress_delta || null,
      evidence_refs: Array.isArray(runtimeGoal.evidence) ? runtimeGoal.evidence.slice(-12) : [],
      founder_guidance: runtimeGoal.founder_guidance || null
    },
    available_departments: unique2(availableDepartments2),
    phase_target_contract: PHASE_TARGET_CONTRACT,
    instruction: "Return a strategy proposal only. Deterministic code will validate it and separately build the Action Contract."
  });
  return { system, user };
}
__name(buildExecutiveReasoningPrompt, "buildExecutiveReasoningPrompt");
function parseExecutivePlan(content) {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch (error) {
    if (error?.code) throw error;
    throw Object.assign(new Error("Executive reasoner returned invalid JSON"), {
      code: "EXECUTIVE_PLAN_INVALID_JSON",
      causeName: error?.name || "SyntaxError"
    });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw Object.assign(new Error("Executive plan must be a JSON object"), { code: "EXECUTIVE_PLAN_INVALID_SHAPE" });
  }
  return parsed;
}
__name(parseExecutivePlan, "parseExecutivePlan");
function validateExecutivePlan(plan = {}, { goal = {}, availableDepartments: availableDepartments2 = [] } = {}) {
  const errors = [];
  const authorityKeys = findAuthorityKeys(plan);
  if (authorityKeys.length) errors.push(`AUTHORITY_FIELDS_PROHIBITED:${authorityKeys.join(",")}`);
  if (!supportedPlanVersion(plan.plan_version)) errors.push("PLAN_VERSION_UNSUPPORTED");
  if (!norm3(plan.strategy_summary)) errors.push("STRATEGY_SUMMARY_REQUIRED");
  const target = norm3(plan.target).toLowerCase();
  const phase = upper3(plan.phase);
  const goalAllowed = Array.isArray(goal.allowed_departments) ? goal.allowed_departments : [];
  const available = unique2(availableDepartments2).map((value) => value.toLowerCase());
  if (!target) errors.push("TARGET_REQUIRED");
  if (target && goalAllowed.length && !goalAllowed.includes(target)) errors.push("TARGET_NOT_ALLOWED_BY_GOAL");
  if (target && available.length && !available.includes(target)) errors.push("TARGET_NOT_CURRENTLY_AVAILABLE");
  if (!ALLOWED_PHASES.has(phase)) errors.push("PHASE_INVALID");
  if (phase === "COMMERCIAL_EXECUTE" && target !== "rio") errors.push("COMMERCIAL_EXECUTE_TARGET_MUST_BE_RIO");
  if (phase === "CORRECTIVE_EXECUTE" && !["tony_stark", "aura3"].includes(target)) errors.push("CORRECTIVE_EXECUTE_TARGET_INVALID");
  if (phase === "DIAGNOSE" && !["tony_stark", "hulk"].includes(target)) errors.push("DIAGNOSE_TARGET_INVALID");
  const confidence = finiteConfidence(plan.confidence);
  if (confidence === null) errors.push("CONFIDENCE_REQUIRED_0_TO_1");
  const expected = unique2(plan.expected_progress_delta);
  if (!expected.length) errors.push("EXPECTED_PROGRESS_DELTA_REQUIRED");
  if (plan.needs_founder_guidance === true && !norm3(plan.founder_question)) {
    errors.push("FOUNDER_QUESTION_REQUIRED_WHEN_GUIDANCE_NEEDED");
  }
  if (plan.needs_founder_guidance !== true && plan.founder_question != null && norm3(plan.founder_question)) {
    errors.push("FOUNDER_QUESTION_WITHOUT_GUIDANCE_FLAG");
  }
  return {
    ok: errors.length === 0,
    errors,
    plan: {
      plan_version: 1,
      strategy_summary: norm3(plan.strategy_summary),
      target,
      phase,
      hypotheses: unique2(plan.hypotheses),
      unknowns: unique2(plan.unknowns),
      evidence_needed: unique2(plan.evidence_needed),
      expected_progress_delta: expected,
      confidence: confidence ?? 0,
      needs_founder_guidance: plan.needs_founder_guidance === true,
      founder_question: plan.needs_founder_guidance === true ? norm3(plan.founder_question) : null
    }
  };
}
__name(validateExecutivePlan, "validateExecutivePlan");
async function requestExecutivePlan({
  env = {},
  goal = {},
  runtimeGoal = {},
  availableDepartments: availableDepartments2 = [],
  trigger = "NO_PROGRESS_REPLAN",
  callModel
} = {}) {
  if (typeof callModel !== "function") {
    throw Object.assign(new Error("Executive reasoner model call is not configured"), { code: "EXECUTIVE_REASONER_CALL_MISSING" });
  }
  if (env.ENABLE_AI_INFERENCE !== "true") {
    throw Object.assign(new Error("AI inference is disabled"), { code: "EXECUTIVE_REASONER_DISABLED" });
  }
  if (!env.API_VICTOR) {
    throw Object.assign(new Error("Victor AI credential is not configured"), { code: "EXECUTIVE_REASONER_CREDENTIAL_MISSING" });
  }
  const prompt = buildExecutiveReasoningPrompt({ goal, runtimeGoal, availableDepartments: availableDepartments2, trigger });
  const result = await callModel(env, prompt.system, prompt.user, {
    task: "executive",
    temperature: 0.05,
    maxTokens: 900
  });
  let parsed = parseExecutivePlan(result?.content || "");
  let validation = validateExecutivePlan(parsed, { goal, availableDepartments: availableDepartments2 });
  let finalResult = result;
  if (!validation.ok && repairableValidationErrors(validation.errors)) {
    const repairSystem = [
      "You are Victor Executive Reasoner repairing one rejected strategy proposal.",
      "Return ONLY one corrected JSON object matching the original planning schema.",
      "The plan_version field must be the JSON number 1.",
      "Do not add authority, credential, spend, production, public-action, pause, or security fields.",
      "Correct every deterministic validation error without weakening or bypassing any rule."
    ].join("\n");
    const repairUser = JSON.stringify({
      request: "REPAIR_REJECTED_EXECUTIVE_STRATEGY",
      rejected_plan: parsed,
      validation_errors: validation.errors,
      goal_allowed_departments: unique2(goal.allowed_departments),
      available_departments: unique2(availableDepartments2),
      phase_target_contract: PHASE_TARGET_CONTRACT,
      instruction: "Return one corrected strategy proposal only. Deterministic validation will run again and fail closed if any error remains."
    });
    finalResult = await callModel(env, repairSystem, repairUser, {
      task: "executive",
      temperature: 0,
      maxTokens: 900
    });
    parsed = parseExecutivePlan(finalResult?.content || "");
    validation = validateExecutivePlan(parsed, { goal, availableDepartments: availableDepartments2 });
  }
  if (!validation.ok) {
    const error = new Error(`Executive plan failed deterministic validation: ${validation.errors.join("; ")}`);
    error.code = "EXECUTIVE_PLAN_VALIDATION_FAILED";
    error.validationErrors = validation.errors;
    throw error;
  }
  return {
    status: validation.plan.needs_founder_guidance ? "FOUNDER_GUIDANCE_NEEDED" : "PLAN_VALIDATED",
    plan: validation.plan,
    model: finalResult?.model || result?.model || null,
    discovery_status: finalResult?.discovery_status || result?.discovery_status || null,
    model_failures: [
      ...Array.isArray(result?.failures) ? result.failures : [],
      ...finalResult !== result && Array.isArray(finalResult?.failures) ? finalResult.failures : []
    ]
  };
}
__name(requestExecutivePlan, "requestExecutivePlan");

// brain/founder_guidance.mjs
var ACTIVE_KEY = "victor:founder-guidance:active:v1";
var KEY_PREFIX = "victor:founder-guidance:v1:";
function norm4(value) {
  return String(value || "").trim();
}
__name(norm4, "norm");
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function binding(env = {}) {
  const store2 = env.VICTOR_CONVERSATION_STATE;
  return store2 && typeof store2.get === "function" && typeof store2.put === "function" ? store2 : null;
}
__name(binding, "binding");
function guidanceKey(goalId) {
  return `${KEY_PREFIX}${encodeURIComponent(norm4(goalId))}`;
}
__name(guidanceKey, "guidanceKey");
async function readJson2(store2, key) {
  if (!store2) return null;
  try {
    const raw = await store2.get(key, { type: "json" });
    if (raw && typeof raw === "object") return raw;
  } catch (_) {
  }
  try {
    const raw = await store2.get(key);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}
__name(readJson2, "readJson");
async function writeJson2(store2, key, value) {
  await store2.put(key, JSON.stringify(value));
  return value;
}
__name(writeJson2, "writeJson");
function buildFounderGuidanceRequest({ goal = {}, reasonedPlan = {}, runtimeGoal = {} } = {}) {
  const goalId = norm4(goal.goal_id);
  const question = norm4(reasonedPlan.founder_question);
  if (!goalId) throw Object.assign(new Error("Founder guidance goal_id required"), { code: "FOUNDER_GUIDANCE_GOAL_REQUIRED" });
  if (reasonedPlan.needs_founder_guidance !== true || !question) {
    throw Object.assign(new Error("Founder guidance requires an explicit precise question"), { code: "FOUNDER_GUIDANCE_QUESTION_REQUIRED" });
  }
  const checked = [];
  if (runtimeGoal.last_status) checked.push(`Last verified status: ${runtimeGoal.last_status}`);
  if (runtimeGoal.last_root_cause) checked.push(`Root cause/evidence: ${runtimeGoal.last_root_cause}`);
  if (runtimeGoal.last_progress_delta?.reason) checked.push(`No-progress reason: ${runtimeGoal.last_progress_delta.reason}`);
  if (Array.isArray(runtimeGoal.evidence) && runtimeGoal.evidence.length) {
    checked.push(`Evidence refs checked: ${runtimeGoal.evidence.slice(-5).join(", ")}`);
  }
  return {
    schema_version: 1,
    guidance_id: `${goalId}:${Number(runtimeGoal.recovery_generation || 0) + 1}`,
    goal_id: goalId,
    objective: norm4(goal.objective || goal.title),
    strategy_summary: norm4(reasonedPlan.strategy_summary),
    checked,
    unknowns: Array.isArray(reasonedPlan.unknowns) ? reasonedPlan.unknowns.map(norm4).filter(Boolean) : [],
    evidence_needed: Array.isArray(reasonedPlan.evidence_needed) ? reasonedPlan.evidence_needed.map(norm4).filter(Boolean) : [],
    exact_question: question,
    status: "PENDING",
    scope: "GOAL",
    provenance: "INFERRED_REQUEST",
    requested_at_utc: nowIso(),
    answered_at_utc: null,
    consumed_at_utc: null,
    answer: null,
    telegram_message_id: null,
    founder_answer_message_id: null,
    generation: Number(runtimeGoal.recovery_generation || 0) + 1
  };
}
__name(buildFounderGuidanceRequest, "buildFounderGuidanceRequest");
async function readFounderGuidance(env = {}, goalId) {
  const store2 = binding(env);
  if (!store2 || !norm4(goalId)) return null;
  return readJson2(store2, guidanceKey(goalId));
}
__name(readFounderGuidance, "readFounderGuidance");
async function readActiveFounderGuidance(env = {}) {
  const store2 = binding(env);
  if (!store2) return null;
  const pointer = await readJson2(store2, ACTIVE_KEY);
  if (!pointer?.goal_id) return null;
  return readJson2(store2, guidanceKey(pointer.goal_id));
}
__name(readActiveFounderGuidance, "readActiveFounderGuidance");
async function persistFounderGuidanceRequest(env = {}, request = {}) {
  const store2 = binding(env);
  if (!store2) {
    return { status: "PENDING_CONFIGURATION", reason: "DURABLE_GUIDANCE_STORE_UNAVAILABLE", record: null };
  }
  if (!request?.goal_id || request?.status !== "PENDING") {
    throw Object.assign(new Error("Invalid Founder guidance request"), { code: "FOUNDER_GUIDANCE_REQUEST_INVALID" });
  }
  const existing = await readJson2(store2, guidanceKey(request.goal_id));
  if (existing?.status === "PENDING" && existing?.exact_question === request.exact_question) {
    await writeJson2(store2, ACTIVE_KEY, { goal_id: request.goal_id, guidance_id: existing.guidance_id, updated_at_utc: nowIso() });
    return { status: "ALREADY_PENDING", record: existing };
  }
  const record = {
    ...request,
    prior_guidance_id: existing?.guidance_id || null,
    persisted_at_utc: nowIso()
  };
  await writeJson2(store2, guidanceKey(request.goal_id), record);
  await writeJson2(store2, ACTIVE_KEY, { goal_id: request.goal_id, guidance_id: record.guidance_id, updated_at_utc: nowIso() });
  return { status: "PERSISTED", record };
}
__name(persistFounderGuidanceRequest, "persistFounderGuidanceRequest");
async function attachFounderGuidanceMessage(env = {}, goalId, telegramMessageId) {
  const store2 = binding(env);
  if (!store2) return { status: "PENDING_CONFIGURATION", record: null };
  const current = await readJson2(store2, guidanceKey(goalId));
  if (!current) return { status: "NOT_FOUND", record: null };
  const next = {
    ...current,
    telegram_message_id: telegramMessageId == null ? current.telegram_message_id : Number(telegramMessageId),
    message_bound_at_utc: nowIso()
  };
  await writeJson2(store2, guidanceKey(goalId), next);
  return { status: "UPDATED", record: next };
}
__name(attachFounderGuidanceMessage, "attachFounderGuidanceMessage");
function shouldTreatAsFounderGuidanceAnswer(text3, message = {}, pending = null) {
  if (!pending || pending.status !== "PENDING") return false;
  const value = norm4(text3);
  if (!value) return false;
  if (/^(guidance|decision|answer)\s*:/i.test(value)) return true;
  const repliedTo = Number(message?.reply_to_message?.message_id || 0);
  const expected = Number(pending.telegram_message_id || 0);
  return Boolean(expected && repliedTo && expected === repliedTo);
}
__name(shouldTreatAsFounderGuidanceAnswer, "shouldTreatAsFounderGuidanceAnswer");
function normalizeFounderGuidanceAnswer(text3) {
  return norm4(text3).replace(/^(guidance|decision|answer)\s*:\s*/i, "").trim();
}
__name(normalizeFounderGuidanceAnswer, "normalizeFounderGuidanceAnswer");
async function recordFounderGuidanceAnswer(env = {}, pending = {}, answer, metadata = {}) {
  const store2 = binding(env);
  if (!store2) return { status: "PENDING_CONFIGURATION", record: null };
  const goalId = norm4(pending.goal_id);
  const value = normalizeFounderGuidanceAnswer(answer);
  if (!goalId || !value) throw Object.assign(new Error("Founder guidance answer required"), { code: "FOUNDER_GUIDANCE_ANSWER_REQUIRED" });
  const current = await readJson2(store2, guidanceKey(goalId));
  if (!current || current.status !== "PENDING") {
    return { status: "NO_PENDING_GUIDANCE", record: current || null };
  }
  const next = {
    ...current,
    status: "ANSWERED",
    answer: value,
    provenance: "FOUNDER_CONFIRMED",
    answer_scope: "GOAL",
    answered_at_utc: nowIso(),
    founder_answer_message_id: metadata.messageId == null ? null : Number(metadata.messageId),
    founder_chat_id: metadata.chatId == null ? null : String(metadata.chatId)
  };
  await writeJson2(store2, guidanceKey(goalId), next);
  await writeJson2(store2, ACTIVE_KEY, { goal_id: goalId, guidance_id: next.guidance_id, updated_at_utc: nowIso() });
  return { status: "ANSWERED", record: next };
}
__name(recordFounderGuidanceAnswer, "recordFounderGuidanceAnswer");
async function consumeFounderGuidance(env = {}, goalId, metadata = {}) {
  const store2 = binding(env);
  if (!store2) return { status: "PENDING_CONFIGURATION", record: null };
  const current = await readJson2(store2, guidanceKey(goalId));
  if (!current) return { status: "NOT_FOUND", record: null };
  if (current.status !== "ANSWERED") return { status: current.status, record: current };
  const next = {
    ...current,
    status: "CONSUMED",
    consumed_at_utc: nowIso(),
    consumed_by_action_id: metadata.actionId || null,
    consumed_by_strategy: metadata.strategySummary || null
  };
  await writeJson2(store2, guidanceKey(goalId), next);
  await writeJson2(store2, ACTIVE_KEY, { goal_id: goalId, guidance_id: next.guidance_id, updated_at_utc: nowIso() });
  return { status: "CONSUMED", record: next };
}
__name(consumeFounderGuidance, "consumeFounderGuidance");
function founderGuidanceContext(record = null) {
  if (!record || !["ANSWERED", "CONSUMED"].includes(record.status) || !norm4(record.answer)) return null;
  return {
    guidance_id: record.guidance_id,
    scope: record.answer_scope || record.scope || "GOAL",
    answer: record.answer,
    provenance: "FOUNDER_CONFIRMED",
    answered_at_utc: record.answered_at_utc || null,
    exact_question: record.exact_question || null
  };
}
__name(founderGuidanceContext, "founderGuidanceContext");
function formatFounderGuidanceQuestion(record = {}) {
  const checked = Array.isArray(record.checked) && record.checked.length ? record.checked.slice(0, 4).map((item) => `- ${item}`).join("\n") : "- Bounded investigation/replan completed; no sufficient policy rule found.";
  const unknowns = Array.isArray(record.unknowns) && record.unknowns.length ? record.unknowns.slice(0, 3).join(" | ") : "A policy/priority ambiguity remains.";
  return [
    `Victor needs one Founder decision for ${record.goal_id || "active objective"}.`,
    `Checked:
${checked}`,
    `Unresolved: ${unknowns}`,
    `Question: ${record.exact_question || "Please provide the missing scoped decision."}`,
    "Reply to this message, or send: Guidance: <your decision>"
  ].join("\n\n");
}
__name(formatFounderGuidanceQuestion, "formatFounderGuidanceQuestion");

// victor-telegram-worker/model_router.mjs
var DEFAULT_BEDROCK_BASE = "https://bedrock-mantle.us-east-1.api.aws/v1";
var DEFAULT_FALLBACK_MODEL = "qwen.qwen3-coder-next";
var COGNEE_AUTH_BREAKER_KEY = "victor:cognee:auth-breaker:v3";
function norm5(value) {
  return String(value || "").trim();
}
__name(norm5, "norm");
function modelId(item) {
  if (typeof item === "string") return item;
  return item?.id || item?.model_id || item?.modelId || item?.name || "";
}
__name(modelId, "modelId");
async function credentialFingerprint(secret) {
  const bytes = new TextEncoder().encode(String(secret || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(credentialFingerprint, "credentialFingerprint");
function cogneeBreakerStore(env = {}) {
  const store2 = env.VICTOR_CONVERSATION_STATE;
  return store2 && typeof store2.get === "function" && typeof store2.put === "function" ? store2 : null;
}
__name(cogneeBreakerStore, "cogneeBreakerStore");
async function readCogneeAuthBreaker(env = {}) {
  const store2 = cogneeBreakerStore(env);
  if (!store2) return null;
  try {
    const raw = await store2.get(COGNEE_AUTH_BREAKER_KEY);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}
__name(readCogneeAuthBreaker, "readCogneeAuthBreaker");
async function writeCogneeAuthBreaker(env = {}, state = null) {
  const store2 = cogneeBreakerStore(env);
  if (!store2) return false;
  try {
    if (state == null) {
      if (typeof store2.delete === "function") await store2.delete(COGNEE_AUTH_BREAKER_KEY);
      else await store2.put(COGNEE_AUTH_BREAKER_KEY, JSON.stringify({ status: "CLEARED", cleared_at_utc: (/* @__PURE__ */ new Date()).toISOString() }));
      return true;
    }
    await store2.put(COGNEE_AUTH_BREAKER_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
__name(writeCogneeAuthBreaker, "writeCogneeAuthBreaker");
function cogneeAuthBlockedError(httpStatus, suppressNotification = false) {
  return Object.assign(new Error("Cognee auth is blocked for the current dedicated Cognee credential and tenant contract"), {
    code: "COGNEE_AUTH_BLOCKED",
    httpStatus: httpStatus || 401,
    suppressNotification,
    credentialChangeRequired: true
  });
}
__name(cogneeAuthBlockedError, "cogneeAuthBlockedError");
function scoreModel(id, task) {
  const value = String(id || "").toLowerCase();
  let score = 0;
  const has = /* @__PURE__ */ __name((token) => value.includes(token), "has");
  if (task === "coding") {
    if (has("coder") || has("code")) score += 100;
    if (has("qwen")) score += 35;
    if (has("claude") || has("openai")) score += 20;
  } else if (task === "reasoning") {
    if (has("deepseek")) score += 95;
    if (has("reason") || has("r1")) score += 85;
    if (has("claude") || has("openai")) score += 55;
    if (has("qwen")) score += 35;
  } else if (task === "executive") {
    if (has("claude")) score += 90;
    if (has("openai") || has("gpt")) score += 85;
    if (has("nova") && (has("pro") || has("premier"))) score += 65;
    if (has("deepseek")) score += 45;
  } else if (task === "fast") {
    if (has("lite") || has("mini") || has("small") || has("flash")) score += 90;
    if (has("nova")) score += 55;
    if (has("qwen")) score += 35;
  } else {
    if (has("claude")) score += 70;
    if (has("openai") || has("gpt")) score += 65;
    if (has("qwen")) score += 50;
    if (has("nova")) score += 40;
  }
  if (has("embed") || has("image") || has("video") || has("rerank")) score -= 500;
  return score;
}
__name(scoreModel, "scoreModel");
function classifyVictorTask(system = "", userMessage = "") {
  const value = `${system}
${userMessage}`.toLowerCase();
  if (/\b(code|coding|javascript|python|github|workflow|bug|debug|repository|repo|syntax|test failure|implementation)\b/.test(value)) return "coding";
  if (/\b(root cause|reasoning|diagnos|investigat|why failed|failure|blocker|recover|repair|contradiction)\b/.test(value)) return "reasoning";
  if (/\b(executive|strategy|decision|objective|cross-department|business plan|synthesis|founder)\b/.test(value)) return "executive";
  if (/\b(classify|classification|intent|route|routing|short answer|quick|fast)\b/.test(value)) return "fast";
  return "chat";
}
__name(classifyVictorTask, "classifyVictorTask");
async function discoverBedrockModels(env = {}, options = {}) {
  const apiKey = options.apiKey || env.API_VICTOR || "";
  const base = norm5(options.base || env.VICTOR_BEDROCK_BASE || DEFAULT_BEDROCK_BASE).replace(/\/$/, "");
  if (!apiKey) return { status: "CREDENTIAL_MISSING", models: [], base };
  let response;
  try {
    response = await fetch(`${base}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(Number(env.VICTOR_MODEL_DISCOVERY_TIMEOUT_MS || 8e3))
    });
  } catch (error) {
    return { status: "DISCOVERY_UNREACHABLE", models: [], base, error: error?.name || "FetchError" };
  }
  if (!response.ok) return { status: "DISCOVERY_HTTP_ERROR", http_status: response.status, models: [], base };
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { status: "DISCOVERY_INVALID_JSON", models: [], base };
  }
  const raw = Array.isArray(payload) ? payload : payload?.data || payload?.models || payload?.items || [];
  const models = raw.map(modelId).filter(Boolean);
  return { status: "DISCOVERED", models: [...new Set(models)], base };
}
__name(discoverBedrockModels, "discoverBedrockModels");
function configuredCandidates(env, task) {
  const map = {
    coding: env.VICTOR_MODEL_CODING,
    reasoning: env.VICTOR_MODEL_REASONING,
    executive: env.VICTOR_MODEL_EXECUTIVE,
    fast: env.VICTOR_MODEL_FAST,
    chat: env.VICTOR_MODEL_CHAT
  };
  return [map[task], env.VICTOR_MODEL, DEFAULT_FALLBACK_MODEL].map(norm5).filter(Boolean);
}
__name(configuredCandidates, "configuredCandidates");
function rankVictorModels(models = [], task = "chat", env = {}) {
  const available = [...new Set(models.map(norm5).filter(Boolean))];
  const explicit = configuredCandidates(env, task);
  const ordered = [];
  for (const candidate of explicit) {
    if (!available.length || available.includes(candidate)) ordered.push(candidate);
  }
  const scored = available.filter((id) => !ordered.includes(id)).map((id) => ({ id, score: scoreModel(id, task) })).filter((x) => x.score > -100).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map((x) => x.id);
  return [.../* @__PURE__ */ new Set([...ordered, ...scored])];
}
__name(rankVictorModels, "rankVictorModels");
async function resolveVictorModelRoute(env = {}, system = "", userMessage = "", options = {}) {
  const task = options.task || classifyVictorTask(system, userMessage);
  const apiKey = options.apiKey || env.API_VICTOR || "";
  const discovery = await discoverBedrockModels(env, { apiKey, base: options.base });
  const candidates = rankVictorModels(discovery.models, task, env);
  if (!candidates.length) candidates.push(...configuredCandidates(env, task));
  return {
    task,
    base: discovery.base || norm5(env.VICTOR_BEDROCK_BASE || DEFAULT_BEDROCK_BASE).replace(/\/$/, ""),
    discovery_status: discovery.status,
    candidates: [...new Set(candidates)].filter(Boolean)
  };
}
__name(resolveVictorModelRoute, "resolveVictorModelRoute");
async function callVictorModel(env, system, userMessage, options = {}) {
  const apiKey = options.apiKey || env.API_VICTOR || "";
  if (!apiKey) throw Object.assign(new Error("API_VICTOR is not configured"), { code: "AI_CREDENTIAL_MISSING" });
  const route = await resolveVictorModelRoute(env, system, userMessage, options);
  const failures = [];
  for (const model of route.candidates.slice(0, Number(env.VICTOR_MODEL_MAX_ATTEMPTS || 4))) {
    let response;
    try {
      response = await fetch(`${route.base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: userMessage }],
          temperature: Number(options.temperature ?? 0.15),
          max_tokens: Number(options.maxTokens ?? 700)
        }),
        signal: AbortSignal.timeout(Number(env.VICTOR_AI_TIMEOUT_MS || 25e3))
      });
    } catch (error2) {
      failures.push({ model, code: error2?.name || "FetchError" });
      continue;
    }
    if (!response.ok) {
      failures.push({ model, http_status: response.status });
      continue;
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      failures.push({ model, code: "INVALID_JSON" });
      continue;
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return { content: content.trim(), model, task: route.task, discovery_status: route.discovery_status, failures };
    }
    failures.push({ model, code: "EMPTY_RESPONSE" });
  }
  const error = new Error("No compatible Victor model produced a valid response");
  error.code = "AI_MODEL_ROUTER_EXHAUSTED";
  error.modelFailures = failures;
  error.discoveryStatus = route.discovery_status;
  throw error;
}
__name(callVictorModel, "callVictorModel");
async function callCogneeInference(env = {}, system = "", userMessage = "", options = {}) {
  const apiKey = env.COGNEE_API_KEY || "";
  if (!apiKey) {
    throw Object.assign(new Error("Cognee API credential is not configured"), {
      code: "COGNEE_API_CREDENTIAL_MISSING"
    });
  }
  const fingerprint = await credentialFingerprint(apiKey);
  const breaker = await readCogneeAuthBreaker(env);
  if (breaker?.status === "COGNEE_AUTH_BLOCKED" && breaker?.credential_fingerprint === fingerprint) {
    throw cogneeAuthBlockedError(breaker.http_status || 401, true);
  }
  if (breaker?.credential_fingerprint && breaker.credential_fingerprint !== fingerprint) {
    await writeCogneeAuthBreaker(env, null);
  }
  const base = String(options.base || env.COGNEE_SERVICE_URL || "").replace(/\/$/, "");
  const tenantId = String(env.COGNEE_TENANT_ID || "").trim();
  if (!base) {
    throw Object.assign(new Error("Cognee tenant service URL is not configured"), { code: "COGNEE_SERVICE_URL_MISSING" });
  }
  if (!tenantId) {
    throw Object.assign(new Error("Cognee tenant ID is not configured"), { code: "COGNEE_TENANT_ID_MISSING" });
  }
  let response;
  try {
    response = await fetch(`${base}/api/v1/datasets/`, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        "X-Tenant-Id": tenantId,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(Number(env.VICTOR_COGNEE_AI_TIMEOUT_MS || env.VICTOR_AI_TIMEOUT_MS || 25e3))
    });
  } catch (error) {
    throw Object.assign(new Error("Cognee Cloud API request could not be reached"), {
      code: "COGNEE_API_UNREACHABLE",
      causeName: error?.name || "FetchError"
    });
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      await writeCogneeAuthBreaker(env, {
        status: "COGNEE_AUTH_BLOCKED",
        credential_fingerprint: fingerprint,
        http_status: response.status,
        blocked_at_utc: (/* @__PURE__ */ new Date()).toISOString(),
        stage: "COGNEE_DATASETS_AUTH_CHECK"
      });
      throw cogneeAuthBlockedError(response.status, false);
    }
    throw Object.assign(new Error("Cognee Cloud API returned non-success status"), {
      code: "COGNEE_API_HTTP_ERROR",
      httpStatus: response.status
    });
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw Object.assign(new Error("Cognee Cloud datasets response was not valid JSON"), {
      code: "COGNEE_API_INVALID_JSON"
    });
  }
  const datasets = Array.isArray(payload) ? payload : payload?.data || payload?.datasets || payload?.items || [];
  await writeCogneeAuthBreaker(env, null);
  return {
    content: `Cognee Cloud API authenticated successfully; accessible datasets: ${Array.isArray(datasets) ? datasets.length : 0}.`,
    model: null,
    discovery_status: "COGNEE_DATASETS_VERIFIED",
    credential_source: "COGNEE_API_KEY",
    provider: "COGNEE_CLOUD",
    endpoint: "/api/v1/datasets/",
    dataset_count: Array.isArray(datasets) ? datasets.length : 0
  };
}
__name(callCogneeInference, "callCogneeInference");

// brain/experience_ledger.mjs
var INDEX_PREFIX = "victor:experience:index:v1:";
var EPISODE_PREFIX = "victor:experience:episode:v1:";
var ALLOWED_PROVENANCE = /* @__PURE__ */ new Set(["OBSERVED", "VERIFIED", "FOUNDER_CONFIRMED", "INFERRED", "UNVERIFIED"]);
var SECRET_KEY_PATTERN = /(?:secret|token|password|credential|authorization|api[_-]?key|private[_-]?key)/i;
var SECRET_TEXT_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBedrockAPIKey-[A-Za-z0-9_-]{8,}\b/g
];
function norm6(value) {
  return String(value ?? "").trim();
}
__name(norm6, "norm");
function nowIso2() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso2, "nowIso");
function store(env = {}) {
  const binding2 = env.VICTOR_CONVERSATION_STATE;
  return binding2 && typeof binding2.get === "function" && typeof binding2.put === "function" ? binding2 : null;
}
__name(store, "store");
async function readJson3(binding2, key) {
  if (!binding2) return null;
  try {
    const value = await binding2.get(key, { type: "json" });
    if (value && typeof value === "object") return value;
  } catch (_) {
  }
  try {
    const raw = await binding2.get(key);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}
__name(readJson3, "readJson");
async function writeJson3(binding2, key, value) {
  await binding2.put(key, JSON.stringify(value));
  return value;
}
__name(writeJson3, "writeJson");
function episodeKey(episodeId) {
  return `${EPISODE_PREFIX}${encodeURIComponent(norm6(episodeId))}`;
}
__name(episodeKey, "episodeKey");
function indexKey(goalId) {
  return `${INDEX_PREFIX}${encodeURIComponent(norm6(goalId))}`;
}
__name(indexKey, "indexKey");
function sanitizeText(value) {
  let text3 = norm6(value);
  for (const pattern of SECRET_TEXT_PATTERNS) text3 = text3.replace(pattern, "[REDACTED]");
  return text3;
}
__name(sanitizeText, "sanitizeText");
function sanitizeExperienceValue(value, key = "") {
  if (SECRET_KEY_PATTERN.test(String(key))) return "[REDACTED]";
  if (value == null) return value;
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeExperienceValue(item));
  if (typeof value === "object") {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = sanitizeExperienceValue(childValue, childKey);
    }
    return out;
  }
  return sanitizeText(value);
}
__name(sanitizeExperienceValue, "sanitizeExperienceValue");
function buildExperienceEpisode({
  goal = {},
  actionContract = {},
  outcome = {},
  runtimeGoal = {},
  founderGuidance = null,
  episodeId = null,
  observedAt: observedAt2 = null
} = {}) {
  const assessment = outcome?.assessment || {};
  const progressDelta = outcome?.progressDelta || runtimeGoal?.last_progress_delta || null;
  const verified = outcome?.verified === true;
  const id = episodeId || `${goal.goal_id || "objective"}:${actionContract.action_id || Date.now()}`;
  const evidence = Array.isArray(assessment.evidence) ? assessment.evidence.filter(Boolean) : [];
  const failureModes = [];
  if (!verified) failureModes.push("EXECUTION_UNVERIFIED");
  if (progressDelta?.material === false) failureModes.push(progressDelta.reason || "NO_PROGRESS");
  if (assessment.hasBlocker === true) failureModes.push(assessment.status || "BLOCKED");
  const founderCorrection = founderGuidance?.provenance === "FOUNDER_CONFIRMED" ? {
    guidance_id: founderGuidance.guidance_id || null,
    scope: founderGuidance.scope || "GOAL",
    answer: founderGuidance.answer || null,
    provenance: "FOUNDER_CONFIRMED",
    answered_at_utc: founderGuidance.answered_at_utc || null
  } : null;
  const episode = {
    schema_version: 1,
    episode_id: id,
    objective_id: goal.goal_id || null,
    observed_at_utc: observedAt2 || nowIso2(),
    context_fingerprint: [
      actionContract.target || "unknown",
      actionContract.phase || "unknown",
      runtimeGoal.recovery_generation || 0
    ].join("|"),
    plan: outcome?.executiveReasoning?.plan || null,
    action_contract: actionContract || null,
    expected_progress_delta: Array.isArray(actionContract.expected_progress_delta) ? actionContract.expected_progress_delta : [],
    actual_progress_delta: progressDelta,
    observations: {
      department_status: assessment.status || null,
      root_cause: assessment.rootCause || null,
      next_action: assessment.nextAction || null,
      outcome_progress: assessment.outcomeProgress || null
    },
    evidence,
    outcome: {
      verified,
      goal_achieved: assessment.goalAchieved === true,
      founder_gate: assessment.founderGate === true,
      material_progress: progressDelta?.material === true
    },
    failure_modes: failureModes,
    founder_correction: founderCorrection,
    lesson_candidate: progressDelta?.material === true ? "SUCCESS_PATTERN_CANDIDATE" : failureModes.length ? "FAILURE_PATTERN_CANDIDATE" : null,
    provenance: verified ? "VERIFIED" : "OBSERVED",
    confidence: verified ? 1 : 0.5,
    immutable: true
  };
  return sanitizeExperienceValue(episode);
}
__name(buildExperienceEpisode, "buildExperienceEpisode");
function validateExperienceEpisode(episode = {}) {
  const errors = [];
  if (Number(episode.schema_version) !== 1) errors.push("SCHEMA_VERSION_UNSUPPORTED");
  if (!norm6(episode.episode_id)) errors.push("EPISODE_ID_REQUIRED");
  if (!norm6(episode.objective_id)) errors.push("OBJECTIVE_ID_REQUIRED");
  if (!norm6(episode.observed_at_utc)) errors.push("OBSERVED_AT_REQUIRED");
  if (!ALLOWED_PROVENANCE.has(norm6(episode.provenance).toUpperCase())) errors.push("PROVENANCE_INVALID");
  if (!episode.action_contract || typeof episode.action_contract !== "object") errors.push("ACTION_CONTRACT_REQUIRED");
  if (!episode.outcome || typeof episode.outcome !== "object") errors.push("OUTCOME_REQUIRED");
  if (episode.immutable !== true) errors.push("IMMUTABLE_FLAG_REQUIRED");
  const serialized = JSON.stringify(episode);
  if (/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/i.test(serialized)) errors.push("RAW_BEARER_SECRET_DETECTED");
  if (/gh[pousr]_[A-Za-z0-9_]{20,}/i.test(serialized)) errors.push("RAW_GITHUB_SECRET_DETECTED");
  if (/BedrockAPIKey-[A-Za-z0-9_-]{8,}/i.test(serialized)) errors.push("RAW_BEDROCK_SECRET_DETECTED");
  return { ok: errors.length === 0, errors, episode };
}
__name(validateExperienceEpisode, "validateExperienceEpisode");
async function appendExperienceEpisode(env = {}, episode = {}) {
  const binding2 = store(env);
  if (!binding2) return { status: "PENDING_CONFIGURATION", reason: "DURABLE_EXPERIENCE_STORE_UNAVAILABLE", episode: null };
  const validation = validateExperienceEpisode(episode);
  if (!validation.ok) {
    const error = new Error(`Experience episode invalid: ${validation.errors.join("; ")}`);
    error.code = "EXPERIENCE_EPISODE_INVALID";
    error.validationErrors = validation.errors;
    throw error;
  }
  const key = episodeKey(episode.episode_id);
  const existing = await readJson3(binding2, key);
  if (existing) return { status: "ALREADY_EXISTS", episode: existing };
  await writeJson3(binding2, key, episode);
  const idxKey = indexKey(episode.objective_id);
  const index = await readJson3(binding2, idxKey) || { schema_version: 1, objective_id: episode.objective_id, episode_ids: [] };
  const nextIds = [.../* @__PURE__ */ new Set([...Array.isArray(index.episode_ids) ? index.episode_ids : [], episode.episode_id])].slice(-100);
  await writeJson3(binding2, idxKey, {
    ...index,
    episode_ids: nextIds,
    updated_at_utc: nowIso2()
  });
  return { status: "APPENDED", episode };
}
__name(appendExperienceEpisode, "appendExperienceEpisode");

// victor-telegram-worker/autonomy_runtime.mjs
var TELEGRAM_API = "https://api.telegram.org";
var MANUAL_FOUNDER_TRIGGER = "founder-command";
function safeRouterDiagnostics(error) {
  const safeToken = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) ? value : "REDACTED", "safeToken");
  const failures = Array.isArray(error?.modelFailures) ? error.modelFailures.slice(0, 4) : [];
  return {
    discovery_status: error?.discoveryStatus ? safeToken(error.discoveryStatus) : null,
    model_failures: failures.map((item) => ({
      model: safeToken(item?.model),
      ...Number.isInteger(item?.http_status) && item.http_status >= 100 && item.http_status <= 599 ? { http_status: item.http_status } : {},
      ...item?.code ? { code: safeToken(item.code) } : {}
    }))
  };
}
__name(safeRouterDiagnostics, "safeRouterDiagnostics");
async function persistCycleExperience(env, entries = []) {
  const receipts = [];
  for (const entry of entries) {
    if (!entry.actionContract?.action_id) continue;
    try {
      const episode = buildExperienceEpisode(entry);
      const result = await appendExperienceEpisode(env, episode);
      receipts.push({ episode_id: episode.episode_id, status: result.status, reason: result.reason || null });
    } catch (error) {
      receipts.push({ episode_id: entry.actionContract.action_id, status: "FAILED", reason: error?.code || "EXPERIENCE_WRITE_FAILED" });
    }
  }
  return receipts;
}
__name(persistCycleExperience, "persistCycleExperience");
var VICTOR_REPO2 = "vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator";
var AUTONOMY_STATE_PATH = "data/autonomy_state.json";
var GOAL_RUNTIME_STATE_PATH = "data/goal_runtime_state.json";
var RAW_BASE = `https://raw.githubusercontent.com/${VICTOR_REPO2}/main`;
var GOAL_REGISTRY_RAW = `${RAW_BASE}/data/goal_registry.json`;
var GOAL_RUNTIME_STATE_RAW = `${RAW_BASE}/data/goal_runtime_state.json`;
var REVENUE_OUTCOMES_RAW = `${RAW_BASE}/data/revenue_outcomes.json`;
var ACTIVE_GOAL_STATES = /* @__PURE__ */ new Set(["ACTIVE", "READY", "WORKING", "BLOCKED_RETRYABLE"]);
var TERMINAL_GOAL_STATES = /* @__PURE__ */ new Set(["GOAL_ACHIEVED_VERIFIED", "COMPLETED", "CANCELLED", "FOUNDER_HOLD"]);
function unique3(values) {
  return [...new Set((values || []).filter(Boolean))];
}
__name(unique3, "unique");
function normalizedState(value, fallback = "UNKNOWN") {
  return String(value || fallback).trim().toUpperCase();
}
__name(normalizedState, "normalizedState");
function classifyAutonomyResult(result) {
  const strict = result?.strict_supervision || {};
  const status = normalizedState(strict.status || result?.execution_status || "UNKNOWN");
  const blocker = strict.error_or_blocker ?? result?.blockers ?? null;
  const strictEvidence = Array.isArray(strict.evidence) ? strict.evidence : [];
  const finalOutcome = result?.final_outcome || strict?.final_outcome || null;
  const finalEvidence = Array.isArray(finalOutcome?.evidence) ? finalOutcome.evidence : [];
  const evidence = unique3([...strictEvidence, ...finalEvidence]);
  const hasBlocker = Boolean(
    Array.isArray(blocker) && blocker.length || !Array.isArray(blocker) && blocker && !/^none|no blocker|null$/i.test(String(blocker))
  );
  const authorityText = [status, strict.next_action, blocker].flat().filter(Boolean).join(" ").toUpperCase();
  const credentialGate = /(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND).{0,28}(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY)|(?:CREDENTIAL|SECRET).{0,28}(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND)|MISSING (?:CREDENTIAL|SECRET)/.test(authorityText);
  const boundaryGate = /OBJECTIVE_IMPOSSIBLE|GOAL_IMPOSSIBLE|HARD_BOUNDARY_CONFLICT|CHANGE_(?:GOAL|OBJECTIVE|SUCCESS_CRITERIA|BUDGET_CEILING)|FOUNDER_GOAL_CHANGE_REQUIRED/.test(authorityText);
  const founderGate = credentialGate || boundaryGate;
  const statusClaimsGoal = /GOAL_ACHIEVED_VERIFIED|OBJECTIVE_MET_VERIFIED/.test(status);
  const finalClaimsGoal = finalOutcome?.verified === true && finalOutcome?.objective_met === true && finalEvidence.length > 0;
  const goalAchieved = statusClaimsGoal && evidence.length > 0 || finalClaimsGoal;
  const verifiedSuccess = goalAchieved || /COMPLETED|VERIFIED|PASS|HEALTHY|READY/.test(status) && !/PENDING|NOT_VERIFIED|SAFE_STOP|BLOCKED|FAILED/.test(status) && evidence.length > 0;
  return {
    status,
    hasBlocker,
    founderGate,
    credentialGate,
    boundaryGate,
    verifiedSuccess,
    goalAchieved,
    requiresFollowUp: strict.requires_follow_up === true,
    nextAction: strict.next_action || "NOT_PROVIDED",
    outcomeProgress: strict.outcome_progress || result?.outcome_progress || null,
    rootCause: strict.root_cause || result?.root_cause || null,
    solution: strict.solution || result?.solution || null,
    evidence,
    finalOutcome
  };
}
__name(classifyAutonomyResult, "classifyAutonomyResult");
function goalDepartmentOrder(goal, runtimeGoal = {}) {
  const allowed = Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : [];
  return unique3([
    runtimeGoal?.recommended_department,
    goal?.primary_department,
    ...allowed
  ]).filter((dept) => !allowed.length || allowed.includes(dept));
}
__name(goalDepartmentOrder, "goalDepartmentOrder");
function chooseGoalDepartment(goal, runtimeGoal = {}, availableDepartments2 = []) {
  const available = new Set(availableDepartments2 || []);
  return goalDepartmentOrder(goal, runtimeGoal).find((dept) => available.has(dept)) || null;
}
__name(chooseGoalDepartment, "chooseGoalDepartment");
function scoreGoal(goal, runtimeGoal = {}, nowMs2 = Date.now()) {
  const goalStatus = normalizedState(goal?.status, "ACTIVE");
  const runtimeStatus = normalizedState(runtimeGoal?.state, "READY");
  if (!ACTIVE_GOAL_STATES.has(goalStatus) && goalStatus !== "ACTIVE") return Number.NEGATIVE_INFINITY;
  if (TERMINAL_GOAL_STATES.has(runtimeStatus)) return Number.NEGATIVE_INFINITY;
  let score = Number(goal?.priority) || 0;
  if (runtimeStatus === "READY") score += 5;
  if (runtimeStatus === "WORKING") score += 10;
  if (runtimeStatus === "BLOCKED_RETRYABLE") score += 15;
  if (runtimeStatus === "NO_PROGRESS") score += 20;
  if (runtimeGoal?.failure_fingerprint) score += 3;
  const lastAttempt = Date.parse(runtimeGoal?.last_attempt_at_utc || "");
  if (Number.isFinite(lastAttempt)) {
    const staleMinutes = Math.max(0, (Number(nowMs2) - lastAttempt) / 6e4);
    score += Math.min(20, Math.floor(staleMinutes / 15));
  } else {
    score += 10;
  }
  const deadline = Date.parse(goal?.deadline || "");
  if (Number.isFinite(deadline)) {
    const hoursRemaining = (deadline - Number(nowMs2)) / 36e5;
    if (hoursRemaining <= 0) score += 30;
    else if (hoursRemaining <= 24) score += 20;
    else if (hoursRemaining <= 72) score += 10;
  }
  return score;
}
__name(scoreGoal, "scoreGoal");
function selectAutonomyGoal(registry, runtimeState, availableDepartments2 = [], nowMs2 = Date.now()) {
  const goals = Array.isArray(registry?.goals) ? registry.goals : [];
  const states = runtimeState?.goals || {};
  const candidates = goals.map((goal) => {
    const runtimeGoal = states[goal.goal_id] || {};
    const target = chooseGoalDepartment(goal, runtimeGoal, availableDepartments2);
    const score = target ? scoreGoal(goal, runtimeGoal, nowMs2) : Number.NEGATIVE_INFINITY;
    return { goal, runtimeGoal, target, score };
  }).filter((item) => Number.isFinite(item.score)).sort((a, b) => b.score - a.score || (Number(b.goal?.priority) || 0) - (Number(a.goal?.priority) || 0));
  return candidates[0] || null;
}
__name(selectAutonomyGoal, "selectAutonomyGoal");
function buildGoalTaskPrompt(goal, phase = "EXECUTE", runtimeGoal = {}) {
  const success = Array.isArray(goal?.success_conditions) ? goal.success_conditions : [];
  const boundaries = Array.isArray(goal?.hard_boundaries) ? goal.hard_boundaries : [];
  const fiveWhysMode = phase === "FIVE_WHYS_DIAGNOSIS" || runtimeGoal?.brain_required_mode === "FIVE_WHYS_BEFORE_NEXT_DISPATCH";
  return [
    `VICTOR GOAL CONTRACT \u2014 ${phase}`,
    `Goal ID: ${goal?.goal_id || "UNKNOWN"}`,
    `Target: ${goal?.objective || "NOT_PROVIDED"}`,
    `Success conditions: ${success.join(" | ") || "Use canonical department objective and evidence standard."}`,
    `Required evidence: ${goal?.required_evidence_level || "CANONICAL_REQUIRED_EVIDENCE"}`,
    `Hard boundaries: ${boundaries.join(" | ") || "Existing constitutional, credential, cost, compliance and evidence boundaries."}`,
    "Brain rule: decompose work into a concrete deliverable with authority, evidence, exit criteria, and next handoff. Department role is capability guidance, not a reason to reject a valid cross-department technical support task.",
    fiveWhysMode ? "BRAIN FIVE-WHYS MODE: do not repeat the previous action. Start from the verified symptom, build an evidence-backed causal chain, label unsupported causes HYPOTHESIS, identify the best supported controllable root cause, and return the corrective next action. If the verified chain ends at a Founder-only boundary, state the exact Founder action required; otherwise continue without Founder approval." : "Operating rule: the target is fixed; HOW is delegated. Choose the highest-impact valid next action yourself, execute it inside existing authority, and change the plan if the previous route is weak or blocked.",
    "Commercial priority rule: when verified revenue is zero and executable offers/actions exist, prioritize the closest policy-valid revenue/conversion action. Planning, readiness documents, or pillar rotation must not displace an executable higher-impact commercial action unless they remove a verified blocker.",
    "Do not wait for routine Founder approval. Founder is required only for credential/account identity administration, a hard-boundary/goal change, or objective impossibility after governed recovery.",
    "Return fresh evidence. Do not report task completion as goal achievement unless the Goal Contract success conditions are actually verified.",
    "Return strict_supervision with status, goal_id, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up, and progress_delta. progress_delta must include material:boolean, types:[], evidence:[] and must describe a real state/evidence/outcome delta, never a newly-created filename by itself. Include final_outcome only when final outcome evidence exists."
  ].join("\n");
}
__name(buildGoalTaskPrompt, "buildGoalTaskPrompt");
function recommendNextDepartment(goal, assessment, currentTarget) {
  const allowed = new Set(Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : []);
  const text3 = [assessment?.status, assessment?.nextAction, assessment?.rootCause, assessment?.solution, assessment?.hasBlocker ? "BLOCKER" : "", assessment?.outcomeProgress].filter(Boolean).join(" ").toUpperCase();
  if (allowed.has("tony_stark") && departmentCapabilityFit("tony_stark", text3)) return "tony_stark";
  if (allowed.has("aura3") && departmentCapabilityFit("aura3", text3)) return "aura3";
  if (allowed.has("rio") && departmentCapabilityFit("rio", text3)) return "rio";
  if (allowed.has("hulk") && departmentCapabilityFit("hulk", text3)) return "hulk";
  return currentTarget || goal?.primary_department || null;
}
__name(recommendNextDepartment, "recommendNextDepartment");
function buildGoalRuntimeState(previous, selection, outcome, checkedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const goal = selection?.goal || {};
  const goalId = goal.goal_id;
  const previousGoals = previous?.goals || {};
  const oldGoal = previousGoals[goalId] || {};
  const assessment = outcome?.assessment || {};
  const actionContract = outcome?.actionContract || {};
  const rawResult = outcome?.rawResult || {};
  const achieved = outcome?.verified === true && assessment.goalAchieved === true;
  const founderBlocked = assessment.founderGate === true;
  const strategyFingerprint = buildStrategyFingerprint(actionContract);
  const progressDelta = evaluateProgressDelta({
    previousGoal: oldGoal,
    actionContract,
    outcome,
    rawResult
  });
  const convergence = nextConvergenceState({
    previousGoal: oldGoal,
    progressDelta,
    strategyFingerprint,
    actionContract
  });
  const materialProgress = progressDelta.material === true;
  const state = achieved ? "GOAL_ACHIEVED_VERIFIED" : founderBlocked ? "FOUNDER_ONLY_BLOCKER" : outcome?.verified !== true ? "EXECUTION_UNVERIFIED" : materialProgress ? assessment.hasBlocker ? "BLOCKED_RETRYABLE" : "WORKING" : "NO_PROGRESS";
  const failureFingerprint = assessment.hasBlocker ? [selection?.target, assessment.status, assessment.nextAction].filter(Boolean).join("|").slice(0, 240) : null;
  const nextDepartment = achieved ? null : recommendNextDepartment(goal, assessment, selection?.target);
  const oldEvidence = Array.isArray(oldGoal.evidence) ? oldGoal.evidence : [];
  const assessmentEvidence = Array.isArray(assessment.evidence) ? assessment.evidence : [];
  const hasNewEvidence = assessmentEvidence.some((item) => !oldEvidence.includes(item));
  const sameFailureCount = failureFingerprint && failureFingerprint === oldGoal.failure_fingerprint ? (Number(oldGoal.same_failure_count) || 1) + 1 : failureFingerprint ? 1 : 0;
  const sameRecommendationCount = assessment.nextAction && assessment.nextAction === oldGoal.last_next_action ? (Number(oldGoal.same_recommendation_count) || 1) + 1 : assessment.nextAction ? 1 : 0;
  const brainReview = reviewOutcome({
    expected: oldGoal.last_next_action || null,
    actual: assessment.nextAction || null,
    previousAction: oldGoal.last_status || null,
    sameActionCount: Math.max(sameFailureCount, sameRecommendationCount, convergence.no_progress_count),
    hasNewEvidence: materialProgress ? hasNewEvidence : false
  });
  const fiveWhysRequired = !achieved && !founderBlocked && !materialProgress && (convergence.no_progress_count >= 2 || shouldRunFiveWhys({
    rootCauseKnown: Boolean(assessment.rootCause),
    repeatedFailureCount: Math.max(sameFailureCount, convergence.no_progress_count),
    sameRecommendationCount,
    hasNewEvidence: false,
    departmentExplainsFailure: assessment.hasBlocker ? Boolean(assessment.rootCause || assessment.outcomeProgress) : true,
    confidence: assessment.hasBlocker && !assessment.rootCause ? "LOW" : "MEDIUM"
  }));
  const evidence = unique3([...oldEvidence, ...assessmentEvidence]).slice(-50);
  const outcomeProgressFingerprint = assessment.outcomeProgress ? JSON.stringify(assessment.outcomeProgress).slice(0, 1e3) : null;
  return {
    ...previous,
    schema_version: 2,
    runtime_status: achieved ? "GOAL_ACHIEVED_VERIFIED" : "GOAL_DRIVEN_ACTIVE",
    active_goal_id: achieved ? null : goalId,
    goals: {
      ...previousGoals,
      [goalId]: {
        ...oldGoal,
        state,
        attempts: (Number(oldGoal.attempts) || 0) + 1,
        last_target: selection?.target || null,
        recommended_department: nextDepartment,
        brain_required_mode: fiveWhysRequired ? "FIVE_WHYS_BEFORE_NEXT_DISPATCH" : "NORMAL_EXECUTION",
        brain_review: brainReview,
        same_failure_count: sameFailureCount,
        same_recommendation_count: sameRecommendationCount,
        no_progress_count: convergence.no_progress_count,
        stalled_strategy_fingerprint: convergence.stalled_strategy_fingerprint,
        recovery_generation: convergence.recovery_generation,
        must_change_strategy: convergence.must_change_strategy,
        last_strategy_fingerprint: strategyFingerprint || null,
        last_progress_delta: progressDelta,
        last_status: assessment.status || "UNKNOWN",
        last_next_action: assessment.nextAction || null,
        last_root_cause: assessment.rootCause || oldGoal.last_root_cause || null,
        last_outcome_progress_fingerprint: outcomeProgressFingerprint || oldGoal.last_outcome_progress_fingerprint || null,
        last_attempt_at_utc: checkedAt,
        last_verified_progress_at_utc: materialProgress ? checkedAt : oldGoal.last_verified_progress_at_utc || null,
        last_progress_delta_at_utc: materialProgress ? checkedAt : oldGoal.last_progress_delta_at_utc || null,
        goal_achieved_at_utc: achieved ? checkedAt : oldGoal.goal_achieved_at_utc || null,
        evidence,
        failure_fingerprint: failureFingerprint
      }
    },
    note: "Runtime state records material progress separately from verified activity. New artifact filenames alone are not progress."
  };
}
__name(buildGoalRuntimeState, "buildGoalRuntimeState");
function autonomyConfigured(env) {
  return Boolean(
    env.GITHUB_ORCHESTRATION_TOKEN && env.TELEGRAM_BOT_TOKEN_VICTOR && env.VICTOR_FOUNDER_CHAT_ID
  );
}
__name(autonomyConfigured, "autonomyConfigured");
function buildAutonomyEvidence(previous, result, controller, checkedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const materialStatuses = /* @__PURE__ */ new Set(["GOAL_PROGRESS_VERIFIED", "GOAL_ACHIEVED_VERIFIED"]);
  const materialVerified = materialStatuses.has(result?.status);
  const noProgressVerified = result?.status === "GOAL_NO_PROGRESS_VERIFIED";
  return {
    ...previous,
    requested_mode: "MANUAL_GOVERNED_ORCHESTRATOR",
    decision_mode: "GOAL_DRIVEN_EXECUTIVE",
    runtime_status: materialVerified ? "MANUAL_GOAL_CYCLE_VERIFIED" : noProgressVerified ? "MANUAL_GOAL_CYCLE_NO_PROGRESS" : "MANUAL_GOAL_CYCLE_SAFE_STOP",
    automatic_next_action_loop: "GOAL_SELECT_ROUTE_EXECUTE_VERIFY_MATERIAL_PROGRESS_REPLAN",
    last_verified_cycle: materialVerified ? {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result.status,
      goal_id: result.goalId || null,
      target: result.target || "all",
      task_id: result.result?.taskId || null,
      evidence_received: result.result?.evidenceReceived ?? true,
      progress_delta: result.result?.progressDelta || null
    } : previous?.last_verified_cycle || null,
    last_observed_cycle: {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result?.status || "UNKNOWN",
      goal_id: result?.goalId || null,
      target: result?.target || null,
      task_id: result?.result?.taskId || null,
      progress_delta: result?.result?.progressDelta || null,
      experience_ledger: Array.isArray(result?.result?.experienceLedger) ? result.result.experienceLedger : []
    },
    last_cycle_attempt: {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result?.status || "UNKNOWN",
      goal_id: result?.goalId || null,
      target: result?.target || null,
      error_code: result?.error_code || null,
      diagnostics: result?.diagnostics || null
    },
    report_card: result?.reportCard || previous?.report_card || null
  };
}
__name(buildAutonomyEvidence, "buildAutonomyEvidence");
async function readRepoJsonRaw(url, fallback = {}) {
  try {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json();
  } catch {
    return fallback;
  }
}
__name(readRepoJsonRaw, "readRepoJsonRaw");
async function readRepoJson(env, path, fallback = {}) {
  const tokens2 = [...new Set([env.GITHUB_ORCHESTRATION_TOKEN, env.GITHUB_MEMORY_TOKEN].filter(Boolean))];
  const api = `https://api.github.com/repos/${VICTOR_REPO2}/contents/${path}?ref=main&t=${Date.now()}`;
  let lastError = "NO_TOKEN";
  for (const token of tokens2) {
    const headers3 = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Dr-Victor-Goal-Runtime/2.1"
    };
    try {
      const response = await fetch(api, { headers: headers3, cache: "no-store" });
      if (!response.ok) {
        lastError = `HTTP_${response.status}`;
        if ([401, 403].includes(response.status)) continue;
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error?.message || "READ_FAILED";
    }
  }
  const rawMap = {
    "data/goal_registry.json": GOAL_REGISTRY_RAW,
    "data/goal_runtime_state.json": GOAL_RUNTIME_STATE_RAW,
    "data/revenue_outcomes.json": REVENUE_OUTCOMES_RAW,
    [AUTONOMY_STATE_PATH]: `${RAW_BASE}/${AUTONOMY_STATE_PATH}`
  };
  if (rawMap[path]) {
    const publicRecord = await readRepoJsonRaw(rawMap[path], null);
    if (publicRecord) return publicRecord;
  }
  throw new Error(`CANONICAL_STATE_READ_FAILED_${path.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_${lastError}`);
}
__name(readRepoJson, "readRepoJson");
async function updateRepoJson(env, path, nextOrBuilder, message) {
  const tokens2 = [...new Set([env.GITHUB_ORCHESTRATION_TOKEN, env.GITHUB_MEMORY_TOKEN].filter(Boolean))];
  if (!tokens2.length) throw new Error("GOAL_STATE_TOKEN_NOT_CONFIGURED");
  const api = `https://api.github.com/repos/${VICTOR_REPO2}/contents/${path}`;
  let lastError = "UNKNOWN";
  for (const token of tokens2) {
    const headers3 = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "Dr-Victor-Goal-Runtime/2.2" };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const currentResponse = await fetch(`${api}?ref=main&t=${Date.now()}`, { headers: headers3, cache: "no-store" });
      if (!currentResponse.ok) {
        lastError = `READ_HTTP_${currentResponse.status}`;
        if ([401, 403].includes(currentResponse.status)) break;
        continue;
      }
      const currentFile = await currentResponse.json();
      let current = {};
      try {
        current = JSON.parse(decodeURIComponent(escape(atob(currentFile.content || ""))));
      } catch (_) {
        current = {};
      }
      const next = typeof nextOrBuilder === "function" ? nextOrBuilder(current) : nextOrBuilder;
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(next, null, 2) + "\n")));
      const updateResponse = await fetch(api, { method: "PUT", headers: headers3, body: JSON.stringify({ message, content: encoded, sha: currentFile.sha, branch: "main" }) });
      if (updateResponse.ok) return next;
      lastError = `WRITE_HTTP_${updateResponse.status}`;
      if ([401, 403].includes(updateResponse.status)) break;
      if ([409, 422].includes(updateResponse.status)) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        continue;
      }
      break;
    }
  }
  throw new Error(`GOAL_STATE_PERSIST_FAILED_${lastError}`);
}
__name(updateRepoJson, "updateRepoJson");
async function persistAutonomyEvidence(env, controller, result) {
  return updateRepoJson(
    env,
    AUTONOMY_STATE_PATH,
    (current) => buildAutonomyEvidence(current || {}, result, controller),
    `Record Victor goal-driven cycle: ${result.status}`
  );
}
__name(persistAutonomyEvidence, "persistAutonomyEvidence");
async function availableDepartments(env) {
  const configured = [];
  if (rioBridgeConfigured(env)) configured.push("rio");
  if (tonyBridgeConfigured(env)) configured.push("tony_stark");
  if (aura3BridgeConfigured(env)) configured.push("aura3");
  const checks = await Promise.all(configured.map(async (department) => ({
    department,
    pause: await isExecutionPaused(env, department)
  })));
  return checks.filter((item) => item.pause.paused !== true).map((item) => item.department);
}
__name(availableDepartments, "availableDepartments");
async function loadGoalRegistry(env) {
  const record = await readRepoJson(env, "data/goal_registry.json", { goals: [] });
  if (!Array.isArray(record?.goals) || record.goals.length === 0) throw new Error("GOAL_REGISTRY_EMPTY_OR_INVALID");
  return record;
}
__name(loadGoalRegistry, "loadGoalRegistry");
async function loadGoalRuntimeState(env) {
  const state = await readRepoJson(env, GOAL_RUNTIME_STATE_PATH, { schema_version: 1, goals: {} });
  if (!state?.goals || typeof state.goals !== "object") throw new Error("GOAL_RUNTIME_STATE_INVALID");
  return state;
}
__name(loadGoalRuntimeState, "loadGoalRuntimeState");
async function persistGoalRuntimeState(env, nextState, goalId) {
  return updateRepoJson(
    env,
    GOAL_RUNTIME_STATE_PATH,
    (current) => ({
      ...current || {},
      ...nextState,
      goals: {
        ...(current || {}).goals || {},
        ...(nextState || {}).goals || {},
        [goalId]: nextState?.goals?.[goalId] || current?.goals?.[goalId] || {}
      }
    }),
    `Record Victor goal progress: ${goalId}`
  );
}
__name(persistGoalRuntimeState, "persistGoalRuntimeState");
async function runAutonomousCycle(controller, env) {
  if (controller?.cron !== MANUAL_FOUNDER_TRIGGER) {
    return {
      status: "SAFE_STOP",
      goalId: null,
      target: null,
      error_code: "MANUAL_TRIGGER_REQUIRED",
      diagnostics: {
        received_trigger: controller?.cron || null,
        allowed_trigger: MANUAL_FOUNDER_TRIGGER,
        secrets_exposed: false
      }
    };
  }
  if (!autonomyConfigured(env)) throw new Error("AUTONOMY_REQUIRED_BINDINGS_NOT_CONFIGURED");
  const pause = await isExecutionPaused(env);
  if (pause.paused) return { status: "SAFE_STOP", goalId: null, target: null, error_code: "EMERGENCY_PAUSE_ACTIVE", diagnostics: pause };
  const registry = await loadGoalRegistry(env);
  let state = await loadGoalRuntimeState(env);
  const available = await availableDepartments(env);
  let selection = selectAutonomyGoal(registry, state, available, controller.scheduledTime);
  if (!selection) {
    const activeGoals = (registry.goals || []).filter((goal) => normalizedState(goal.status) === "ACTIVE");
    const activeGoalIds = activeGoals.map((goal) => goal.goal_id);
    const candidate_diagnostics = (registry.goals || []).map((goal) => {
      const runtimeGoal = state?.goals?.[goal.goal_id] || {};
      const departmentOrder = goalDepartmentOrder(goal, runtimeGoal);
      const target = chooseGoalDepartment(goal, runtimeGoal, available);
      const score = target ? scoreGoal(goal, runtimeGoal, controller.scheduledTime) : Number.NEGATIVE_INFINITY;
      return {
        goal_id: goal.goal_id || null,
        goal_status: normalizedState(goal.status, "ACTIVE"),
        runtime_state: normalizedState(runtimeGoal.state, "READY"),
        department_order: departmentOrder,
        chosen_target: target,
        finite_score: Number.isFinite(score),
        score: Number.isFinite(score) ? score : null
      };
    });
    return {
      status: "SAFE_STOP",
      goalId: state.active_goal_id || activeGoalIds[0] || null,
      target: null,
      error_code: "NO_ACTIONABLE_GOAL_OR_QUALIFIED_ROUTE",
      diagnostics: {
        registry_goal_count: Array.isArray(registry.goals) ? registry.goals.length : 0,
        active_goal_ids: activeGoalIds,
        available_departments: available,
        runtime_active_goal_id: state.active_goal_id || null,
        bridge_configured: {
          rio: rioBridgeConfigured(env),
          tony_stark: tonyBridgeConfigured(env),
          aura3: aura3BridgeConfigured(env)
        },
        candidates: candidate_diagnostics
      }
    };
  }
  const storedGuidance = await readFounderGuidance(env, selection.goal.goal_id);
  if (storedGuidance?.status === "PENDING") {
    return {
      status: "SAFE_STOP",
      goalId: selection.goal.goal_id,
      target: selection.target,
      error_code: "FOUNDER_GUIDANCE_PENDING",
      diagnostics: {
        stage: "FOUNDER_GUIDANCE_LOOP",
        guidance_id: storedGuidance.guidance_id || null,
        exact_question: storedGuidance.exact_question || null,
        secrets_exposed: false
      }
    };
  }
  const answeredGuidance = founderGuidanceContext(storedGuidance);
  if (answeredGuidance) {
    selection = {
      ...selection,
      runtimeGoal: {
        ...selection.runtimeGoal || {},
        founder_guidance: answeredGuidance
      }
    };
  }
  let initialPhase = selection.runtimeGoal?.brain_required_mode === "FIVE_WHYS_BEFORE_NEXT_DISPATCH" || Number(selection.runtimeGoal?.same_recommendation_count) >= 2 || Number(selection.runtimeGoal?.same_failure_count) >= 2 || selection.runtimeGoal?.brain_review?.repeat_loop_detected === true ? "FIVE_WHYS_DIAGNOSIS" : "EXECUTE";
  let executiveReasoning = null;
  if (shouldInvokeExecutiveReasoner(selection.runtimeGoal || {}, { force: Boolean(answeredGuidance) })) {
    let reasoned;
    try {
      reasoned = await requestExecutivePlan({
        env,
        goal: selection.goal,
        runtimeGoal: selection.runtimeGoal || {},
        availableDepartments: available,
        trigger: "PERSISTED_NO_PROGRESS_OR_STALLED_STRATEGY",
        callModel: callVictorModel
      });
    } catch (error) {
      return {
        status: "SAFE_STOP",
        goalId: selection.goal.goal_id,
        target: selection.target,
        error_code: error?.code || "EXECUTIVE_REASONER_FAILED",
        diagnostics: {
          stage: "EXECUTIVE_REASONING_BOUNDARY",
          validation_errors: Array.isArray(error?.validationErrors) ? error.validationErrors : [],
          ...error?.code === "AI_MODEL_ROUTER_EXHAUSTED" ? safeRouterDiagnostics(error) : {},
          secrets_exposed: false
        }
      };
    }
    executiveReasoning = {
      status: reasoned.status,
      model: reasoned.model,
      discovery_status: reasoned.discovery_status,
      plan: reasoned.plan
    };
    if (reasoned.status === "FOUNDER_GUIDANCE_NEEDED") {
      const guidanceRequest = buildFounderGuidanceRequest({
        goal: selection.goal,
        reasonedPlan: reasoned.plan,
        runtimeGoal: selection.runtimeGoal || {}
      });
      const persisted = await persistFounderGuidanceRequest(env, guidanceRequest);
      if (persisted.status === "PENDING_CONFIGURATION") {
        return {
          status: "SAFE_STOP",
          goalId: selection.goal.goal_id,
          target: selection.target,
          error_code: "FOUNDER_GUIDANCE_STORE_UNAVAILABLE",
          diagnostics: { stage: "FOUNDER_GUIDANCE_LOOP", secrets_exposed: false }
        };
      }
      let telegramMessageId = persisted.record?.telegram_message_id || null;
      if (persisted.status === "PERSISTED" || !telegramMessageId) {
        const sent = await sendFounder(env, formatFounderGuidanceQuestion(persisted.record || guidanceRequest));
        telegramMessageId = sent?.message_id || null;
        if (telegramMessageId) {
          await attachFounderGuidanceMessage(env, selection.goal.goal_id, telegramMessageId);
        }
      }
      return {
        status: "SAFE_STOP",
        goalId: selection.goal.goal_id,
        target: selection.target,
        error_code: "FOUNDER_GUIDANCE_PENDING",
        diagnostics: {
          stage: "FOUNDER_GUIDANCE_LOOP",
          guidance_id: persisted.record?.guidance_id || guidanceRequest.guidance_id,
          exact_question: persisted.record?.exact_question || guidanceRequest.exact_question,
          telegram_message_id: telegramMessageId,
          secrets_exposed: false
        }
      };
    }
    selection = {
      ...selection,
      target: reasoned.plan.target,
      executiveReasoning
    };
    initialPhase = reasoned.plan.phase;
  }
  let outcome = await superviseGoal(selection, env, initialPhase);
  const experienceEntries = [];
  if (executiveReasoning) outcome = { ...outcome, executiveReasoning };
  if (answeredGuidance && executiveReasoning && outcome?.actionContract?.action_id) {
    await consumeFounderGuidance(env, selection.goal.goal_id, {
      actionId: outcome.actionContract.action_id,
      strategySummary: executiveReasoning.plan?.strategy_summary || null
    });
  }
  state = buildGoalRuntimeState(state, selection, outcome);
  experienceEntries.push({ goal: selection.goal, actionContract: outcome.actionContract, outcome: {
    ...outcome,
    progressDelta: state.goals?.[selection.goal.goal_id]?.last_progress_delta
  }, runtimeGoal: state.goals?.[selection.goal.goal_id], founderGuidance: answeredGuidance });
  if (outcome.verified && outcome.assessment.requiresFollowUp && !outcome.assessment.founderGate && !outcome.assessment.goalAchieved) {
    const nextRuntimeGoal = state.goals?.[selection.goal.goal_id] || {};
    const nextTarget = chooseGoalDepartment(selection.goal, nextRuntimeGoal, available);
    if (nextTarget) {
      selection = { ...selection, runtimeGoal: nextRuntimeGoal, target: nextTarget };
      const followUpPhase = nextRuntimeGoal.brain_required_mode === "FIVE_WHYS_BEFORE_NEXT_DISPATCH" ? "FIVE_WHYS_DIAGNOSIS" : "REPLAN_EXECUTE";
      const followUp = await superviseGoal(selection, env, followUpPhase);
      state = buildGoalRuntimeState(state, selection, followUp);
      experienceEntries.push({ goal: selection.goal, actionContract: followUp.actionContract, outcome: {
        ...followUp,
        progressDelta: state.goals?.[selection.goal.goal_id]?.last_progress_delta
      }, runtimeGoal: state.goals?.[selection.goal.goal_id] });
      outcome = { ...followUp, previousTaskId: outcome.taskId, automaticReplan: true };
    }
  }
  await persistGoalRuntimeState(env, state, selection.goal.goal_id);
  const experienceLedger = await persistCycleExperience(env, experienceEntries);
  if (outcome.assessment.founderGate) {
    await sendFounder(env, [
      "Victor boundary escalation",
      `Goal: ${selection.goal.title}`,
      `Status: ${outcome.assessment.status}`,
      `Required: ${outcome.assessment.nextAction}`,
      "Routine plan approval nahi chahiye; ye Founder-owned boundary hai."
    ].join("\n"));
  } else if (outcome.verified && outcome.assessment.goalAchieved) {
    await sendFounder(env, [
      "Victor verified goal achieved",
      `Goal: ${selection.goal.title}`,
      `Department: ${selection.target}`,
      `Evidence items: ${outcome.assessment.evidence.length}`
    ].join("\n"));
  }
  const finalRuntimeGoal = state.goals?.[selection.goal.goal_id] || {};
  const cycleStatus = outcome.verified !== true ? "SAFE_STOP" : outcome.assessment.goalAchieved ? "GOAL_ACHIEVED_VERIFIED" : finalRuntimeGoal.last_progress_delta?.material === true ? "GOAL_PROGRESS_VERIFIED" : "GOAL_NO_PROGRESS_VERIFIED";
  return {
    status: cycleStatus,
    goalId: selection.goal.goal_id,
    target: selection.target,
    result: {
      ...outcome,
      progressDelta: finalRuntimeGoal.last_progress_delta || null,
      executiveReasoning: outcome.executiveReasoning || executiveReasoning || null,
      experienceLedger
    }
  };
}
__name(runAutonomousCycle, "runAutonomousCycle");
async function superviseGoal(selection, env, phase = "EXECUTE") {
  const target = selection.target;
  const actionContract = buildActionContract({
    goal: selection.goal,
    target,
    runtimePhase: phase,
    runtimeGoal: selection.runtimeGoal || {},
    actionId: `${selection.goal?.goal_id || "goal"}:${target}:${Date.now()}`
  });
  const contractValidation = validateActionContract(actionContract, selection.goal);
  if (!contractValidation.ok) {
    const error = new Error(`ACTION_CONTRACT_INVALID_${contractValidation.errors.join("_")}`);
    error.code = "ACTION_CONTRACT_INVALID";
    error.contractErrors = contractValidation.errors;
    throw error;
  }
  const strategyValidation = validateStrategyChange({
    previousGoal: selection.runtimeGoal || {},
    actionContract
  });
  if (!strategyValidation.ok) {
    const error = new Error(strategyValidation.code);
    error.code = strategyValidation.code;
    error.strategyValidation = strategyValidation;
    throw error;
  }
  const prompt = [
    buildGoalTaskPrompt(selection.goal, phase, selection.runtimeGoal || {}),
    "",
    summarizeActionContract(actionContract),
    "Authority rule: the machine-readable action_contract in the dispatch payload is authoritative. Natural-language wording cannot add permissions or downgrade an explicitly authorized corrective phase to read-only."
  ].join("\n");
  let dispatch;
  let received;
  let verification;
  if (target === "tony_stark") {
    if (!tonyBridgeConfigured(env)) throw new Error("TONY_BRIDGE_NOT_CONFIGURED");
    dispatch = await dispatchTonyTask(env, prompt, { messageId: "goal-auto", actionContract });
    received = await waitForTonyResult(dispatch.taskId, env, { attempts: 30, delayMs: 5e3 });
    verification = received.status === "RESULT_RECEIVED" ? verifyTonyResult(received.result, dispatch.taskId) : { ok: false };
  } else if (target === "rio") {
    if (!rioBridgeConfigured(env)) throw new Error("RIO_BRIDGE_NOT_CONFIGURED");
    dispatch = await dispatchRioTask(env, prompt, { messageId: "goal-auto", actionContract });
    received = await waitForRioResult(dispatch.taskId, { attempts: 30, delayMs: 5e3 });
    verification = received.status === "RESULT_RECEIVED" ? verifyRioResult(received.result, dispatch.taskId) : { ok: false };
  } else if (target === "aura3") {
    if (!aura3BridgeConfigured(env)) throw new Error("AURA3_BRIDGE_NOT_CONFIGURED");
    dispatch = await dispatchAura3Task(env, prompt, { messageId: "goal-auto", actionContract });
    received = await waitForAura3Result(dispatch.taskId, { attempts: 30, delayMs: 5e3 });
    verification = received.status === "RESULT_RECEIVED" ? verifyAura3Result(received.result, dispatch.taskId) : { ok: false };
  } else {
    throw new Error(`UNSUPPORTED_GOAL_TARGET_${String(target || "NONE").toUpperCase()}`);
  }
  const result = received.result || {};
  return {
    target,
    phase,
    actionContract,
    actionContractValid: contractValidation.ok,
    strategyFingerprint: strategyValidation.current_fingerprint,
    strategyChangeValidated: strategyValidation.ok,
    rawResult: result,
    taskId: dispatch.taskId,
    taskType: dispatch.taskType,
    verified: verification.ok === true,
    assessment: classifyAutonomyResult(result),
    evidenceReceived: received.status === "RESULT_RECEIVED"
  };
}
__name(superviseGoal, "superviseGoal");
async function sendFounder(env, text3) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(env.VICTOR_FOUNDER_CHAT_ID),
      text: String(text3).slice(0, 4096),
      disable_web_page_preview: true
    })
  });
  if (!response.ok) throw new Error(`AUTONOMY_TELEGRAM_HTTP_${response.status}`);
  const body = await response.json().catch(() => null);
  return body?.result || null;
}
__name(sendFounder, "sendFounder");

// victor-telegram-worker/cognee_memory_bridge.mjs
function cfg(env) {
  const base = String(env.COGNEE_SERVICE_URL || "").replace(/\/$/, "");
  return {
    enabled: String(env.COGNEE_MEMORY_ENABLED || "").toLowerCase() === "true",
    base,
    apiKey: env.COGNEE_API_KEY || "",
    dataset: env.COGNEE_DATASET || "victor_long_term_memory",
    tenantId: String(env.COGNEE_TENANT_ID || "").trim(),
    rememberTimeoutMs: Number(env.COGNEE_REMEMBER_TIMEOUT_MS || 25e3),
    recallTimeoutMs: Number(env.COGNEE_RECALL_TIMEOUT_MS || 6e3),
    improveTimeoutMs: Number(env.COGNEE_IMPROVE_TIMEOUT_MS || 1e4)
  };
}
__name(cfg, "cfg");
function headers2(apiKey, tenantId) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...apiKey ? { "X-Api-Key": apiKey } : {},
    ...tenantId ? { "X-Tenant-Id": tenantId } : {}
  };
}
__name(headers2, "headers");
function signal(timeoutMs) {
  return AbortSignal.timeout(Math.max(1e3, Number(timeoutMs || 5e3)));
}
__name(signal, "signal");
function cogneeMemoryStatus(env = {}) {
  const c = cfg(env);
  if (!c.enabled) return { status: "DISABLED" };
  if (!c.base) return { status: "PENDING_CONFIGURATION", reason: "COGNEE_SERVICE_URL_NOT_CONFIGURED" };
  if (!c.apiKey) return { status: "PENDING_CONFIGURATION", reason: "COGNEE_API_KEY_NOT_CONFIGURED" };
  if (!c.tenantId) return { status: "PENDING_CONFIGURATION", reason: "COGNEE_TENANT_ID_NOT_CONFIGURED" };
  return {
    status: "CONFIGURED",
    dataset: c.dataset,
    provider: "COGNEE"
  };
}
__name(cogneeMemoryStatus, "cogneeMemoryStatus");
async function cogneeRemember(env, text3, metadata = {}) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== "CONFIGURED") return status;
  const record = JSON.stringify({
    authority: metadata.authority || "VICTOR",
    source: metadata.source || "victor",
    observed_at: metadata.observedAt || (/* @__PURE__ */ new Date()).toISOString(),
    text: String(text3 || "").trim(),
    metadata
  });
  const form = new FormData();
  form.append("data", new Blob([record], { type: "application/json" }), "victor-memory.json");
  form.append("datasetName", c.dataset);
  form.append("run_in_background", "false");
  let res;
  try {
    res = await fetch(`${c.base}/api/v1/remember`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Api-Key": c.apiKey,
        "X-Tenant-Id": c.tenantId
      },
      body: form,
      signal: signal(c.rememberTimeoutMs)
    });
  } catch (error) {
    return { status: "FAILED", stage: "COGNEE_REMEMBER", reason: error?.name || "FETCH_ERROR" };
  }
  if (!res.ok) return { status: "FAILED", stage: "COGNEE_REMEMBER", http_status: res.status };
  return { status: "REMEMBERED", dataset: c.dataset };
}
__name(cogneeRemember, "cogneeRemember");
async function cogneeRecall(env, query, options = {}) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== "CONFIGURED") return { ...status, results: [] };
  const requestBody = {
    query: String(query || ""),
    datasets: [c.dataset],
    topK: Math.max(1, Math.min(Number(options.topK || 5), 15)),
    onlyContext: true,
    ...options.sessionId ? { sessionId: String(options.sessionId) } : {}
  };
  let res;
  try {
    res = await fetch(`${c.base}/api/v1/recall`, {
      method: "POST",
      headers: headers2(c.apiKey, c.tenantId),
      body: JSON.stringify(requestBody),
      signal: signal(options.timeoutMs || c.recallTimeoutMs)
    });
  } catch (error) {
    return { status: "FAILED", stage: "COGNEE_RECALL", reason: error?.name || "FETCH_ERROR", results: [] };
  }
  if (!res.ok) {
    let detail = null;
    try {
      detail = String(await res.text()).slice(0, 500);
    } catch (_) {
    }
    return { status: "FAILED", stage: "COGNEE_RECALL", http_status: res.status, detail, results: [] };
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    return { status: "FAILED", stage: "COGNEE_RECALL", reason: "INVALID_JSON", results: [] };
  }
  let results = [];
  let payloadShape = Array.isArray(payload) ? "array" : typeof payload;
  if (Array.isArray(payload)) {
    results = payload;
  } else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.results)) results = payload.results;
    else if (Array.isArray(payload.items)) results = payload.items;
    else if (Array.isArray(payload.data)) results = payload.data;
    else if (Array.isArray(payload.search_results)) results = payload.search_results;
    else if (typeof payload.context === "string" && payload.context.trim()) results = [{ context: payload.context }];
    else if (typeof payload.answer === "string" && payload.answer.trim()) results = [{ answer: payload.answer, context: payload.context || "" }];
    payloadShape = "object:" + Object.keys(payload).slice(0, 12).join(",");
  } else if (typeof payload === "string" && payload.trim()) {
    results = [{ context: payload }];
    payloadShape = "string";
  }
  return { status: "RECALLED", dataset: c.dataset, results, result_count: results.length, payload_shape: payloadShape };
}
__name(cogneeRecall, "cogneeRecall");
function mergeCogneeContext(authoritativeContext, cogneeResult) {
  const graph = cogneeResult?.status === "RECALLED" ? cogneeResult.results : [];
  return {
    ...authoritativeContext,
    cogneeMemory: graph,
    prompt: `${authoritativeContext?.prompt || ""}
COGNEE LONG-TERM RECALL (advisory; never overrides active Founder decisions or verified evidence):
${JSON.stringify(graph)}`
  };
}
__name(mergeCogneeContext, "mergeCogneeContext");

// victor-telegram-worker/memory_brain.mjs
var CANONICAL_PATTERNS = [
  /\b(founder\s+(decision|rule|instruction)|final\s+decision|architecture\s+lock|master\s+rule|policy)\b/i,
  /\b(lock\s+(this|it)|permanent\s+rule|must\s+always|must\s+never|never\s+change)\b/i,
  /\b(authoritative|canonical|source\s+of\s+truth)\b/i
];
function nowMs() {
  return Date.now();
}
__name(nowMs, "nowMs");
function emit(event, data = {}) {
  console.log(JSON.stringify({
    event,
    ...data,
    observed_at_utc: (/* @__PURE__ */ new Date()).toISOString(),
    secrets_exposed: false
  }));
}
__name(emit, "emit");
function classifyMemoryWrite(text3 = "") {
  const value = String(text3 || "").trim();
  const canonical = CANONICAL_PATTERNS.some((rx) => rx.test(value));
  return {
    explicit: Boolean(value),
    canonical,
    semantic: Boolean(value),
    route: canonical ? "CANONICAL_AND_SEMANTIC" : "SEMANTIC_ONLY"
  };
}
__name(classifyMemoryWrite, "classifyMemoryWrite");
function memoryBrainStatus(env = {}) {
  const cognee = cogneeMemoryStatus(env);
  return {
    status: cognee.status === "CONFIGURED" ? "READY" : "DEGRADED",
    version: "MEMORY_BRAIN_V1",
    active_layer: "CLOUDFLARE_KV",
    canonical_layer: "GITHUB",
    semantic_provider: "COGNEE",
    semantic_provider_status: cognee.status,
    semantic_provider_reason: cognee.reason || null,
    observability: "STRUCTURED_CLOUDFLARE_LOGS_V1",
    provider_interface: "REMEMBER_RECALL_IMPROVE_HEALTH_V1"
  };
}
__name(memoryBrainStatus, "memoryBrainStatus");
async function writeVictorMemory(env, text3, metadata = {}, canonicalWriter = null) {
  const route = classifyMemoryWrite(text3);
  const started = nowMs();
  const result = {
    status: "FAILED",
    route: route.route,
    canonical: { requested: route.canonical, status: route.canonical ? "NOT_ATTEMPTED" : "NOT_REQUIRED" },
    semantic: { requested: route.semantic, status: route.semantic ? "NOT_ATTEMPTED" : "NOT_REQUIRED" }
  };
  if (route.canonical) {
    if (typeof canonicalWriter !== "function") {
      result.canonical = { requested: true, status: "PENDING_CONFIGURATION", reason: "CANONICAL_WRITER_NOT_AVAILABLE" };
    } else {
      try {
        const canonical = await canonicalWriter();
        result.canonical = { requested: true, ...canonical };
      } catch (error) {
        result.canonical = { requested: true, status: "FAILED", reason: error?.code || error?.name || "CANONICAL_WRITE_ERROR" };
      }
    }
  }
  if (route.semantic) {
    const semanticStarted = nowMs();
    try {
      const semantic = await cogneeRemember(env, text3, {
        ...metadata,
        authority: route.canonical ? "FOUNDER" : metadata.authority || "VICTOR",
        source: metadata.source || "telegram"
      });
      result.semantic = { requested: true, ...semantic };
      emit("VICTOR_MEMORY_SEMANTIC_WRITE", {
        provider: "COGNEE",
        status: semantic.status,
        latency_ms: nowMs() - semanticStarted,
        route: route.route
      });
    } catch (error) {
      result.semantic = { requested: true, status: "FAILED", reason: error?.code || error?.name || "SEMANTIC_WRITE_ERROR" };
      emit("VICTOR_MEMORY_SEMANTIC_WRITE", {
        provider: "COGNEE",
        status: "FAILED",
        reason: result.semantic.reason,
        latency_ms: nowMs() - semanticStarted,
        route: route.route
      });
    }
  }
  const canonicalOk = !route.canonical || ["PERSISTED", "ALREADY_PRESENT"].includes(result.canonical.status);
  const semanticOk = !route.semantic || result.semantic.status === "REMEMBERED";
  result.status = canonicalOk && semanticOk ? "PERSISTED" : "FAILED";
  result.latency_ms = nowMs() - started;
  emit("VICTOR_MEMORY_WRITE", {
    status: result.status,
    route: route.route,
    canonical_status: result.canonical.status,
    semantic_status: result.semantic.status,
    latency_ms: result.latency_ms
  });
  return result;
}
__name(writeVictorMemory, "writeVictorMemory");
async function recallVictorMemory(env, query, authoritativeContext, options = {}) {
  const providerStatus = cogneeMemoryStatus(env);
  if (providerStatus.status !== "CONFIGURED") {
    emit("VICTOR_MEMORY_RECALL", {
      provider: "COGNEE",
      status: "SKIPPED",
      reason: providerStatus.reason || providerStatus.status,
      latency_ms: 0
    });
    return {
      ...authoritativeContext,
      cogneeMemory: [],
      semantic_recall_status: providerStatus.status
    };
  }
  const started = nowMs();
  try {
    const semantic = await cogneeRecall(env, query, options);
    emit("VICTOR_MEMORY_RECALL", {
      provider: "COGNEE",
      status: semantic.status,
      result_count: Array.isArray(semantic.results) ? semantic.results.length : 0,
      latency_ms: nowMs() - started
    });
    const merged = mergeCogneeContext(authoritativeContext, semantic);
    return { ...merged, semantic_recall_status: semantic.status };
  } catch (error) {
    emit("VICTOR_MEMORY_RECALL", {
      provider: "COGNEE",
      status: "FAILED",
      reason: error?.code || error?.name || "SEMANTIC_RECALL_ERROR",
      latency_ms: nowMs() - started
    });
    return {
      ...authoritativeContext,
      cogneeMemory: [],
      semantic_recall_status: "FAILED"
    };
  }
}
__name(recallVictorMemory, "recallVictorMemory");

// victor-telegram-worker/remembered_fact_gate.mjs
var STOP_WORDS = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "what",
  "which",
  "tell",
  "about",
  "please",
  "me",
  "my",
  "this",
  "that",
  "ka",
  "ki",
  "ke",
  "ko",
  "hai",
  "kya",
  "aur",
  "se",
  "ye",
  "vo",
  "main"
]);
var MEMORY_SOURCE_NAMES = /* @__PURE__ */ new Set([
  "FOUNDER_MEMORY",
  "DECISIONS",
  "LONG_TERM_MEMORY",
  "ACTIVE_PROJECTS_MEMORY",
  "WORKING_MEMORY",
  "LEARNINGS_MEMORY",
  "OPERATIONAL_MEMORY",
  "ACTIVITY_MEMORY",
  "MEMORY_INDEX_MD",
  "MEMORY_INDEX"
]);
function tokens(value = "") {
  return new Set((String(value).toLowerCase().match(/[a-z0-9_]+/g) || []).filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}
__name(tokens, "tokens");
function oneEditApart(left, right) {
  if (left === right || left.length < 4 || right.length < 4) return left === right;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return true;
}
__name(oneEditApart, "oneEditApart");
function matchedTerms(queryTerms, answerTerms) {
  return [...queryTerms].filter((term) => answerTerms.has(term) || [...answerTerms].some((candidate) => oneEditApart(term, candidate)));
}
__name(matchedTerms, "matchedTerms");
function recalledText(result) {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";
  for (const field of ["text", "context", "answer"]) {
    if (typeof result[field] === "string" && result[field].trim()) return result[field].trim();
  }
  return "";
}
__name(recalledText, "recalledText");
function cleanMemoryLead(text3) {
  return String(text3).replace(/^\s*(?:victor\s*,?\s*)?(?:remember\s+this|remember)\s*[:\-]?\s*/i, "").trim();
}
__name(cleanMemoryLead, "cleanMemoryLead");
function asksForFact(query) {
  const text3 = String(query || "");
  const questionCue = /\?|\b(?:what|which|who|when|where|kya|batao)\b|(?:क्या|बताओ)/i.test(text3);
  const factCue = /\b(?:code|validation|detail|value|status|owner|date)\b|(?:कोड|वैलिडेशन|विवरण|स्थिति|मालिक|तारीख)/i.test(text3);
  return questionCue && factCue;
}
__name(asksForFact, "asksForFact");
function codeValues(text3) {
  return String(text3).match(/\b[A-Z]{2,}(?:[-_][A-Z0-9]{2,})+\b/g) || [];
}
__name(codeValues, "codeValues");
function directFactText(text3, query) {
  const cleaned = cleanMemoryLead(text3);
  const queryTerms = tokens(query);
  const fragments = cleaned.split(/\n+|(?<=[.!?])\s+/).map((fragment) => fragment.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
  const isDirectCandidate = /* @__PURE__ */ __name((fragment) => !fragment.startsWith("{") && !fragment.includes('"text":') && !/^relevant\b|^related\s+facts\b|^document\s+chunk\b/i.test(fragment) && codeValues(fragment).length > 0, "isDirectCandidate");
  const direct = fragments.find((fragment) => {
    if (!isDirectCandidate(fragment)) return false;
    const fragmentTerms = tokens(fragment);
    const overlap = matchedTerms(queryTerms, fragmentTerms);
    return overlap.length >= 2;
  });
  if (direct) return direct;
  if (!queryTerms.size) {
    const candidates = [...new Set(fragments.filter(isDirectCandidate))];
    if (candidates.length === 1) return candidates[0];
  }
  return "";
}
__name(directFactText, "directFactText");
function hasExplicitCanonicalContradiction(query, remembered, sourceRecords = []) {
  const queryTerms = tokens(query);
  const rememberedTerms = tokens(remembered);
  const subjectTerms = [...queryTerms].filter((term) => rememberedTerms.has(term));
  const rememberedCodes = new Set(codeValues(remembered));
  if (!subjectTerms.length || !rememberedCodes.size) return false;
  for (const source of sourceRecords) {
    if (!source?.ok || MEMORY_SOURCE_NAMES.has(source.name) || typeof source.text !== "string") continue;
    for (const sentence of source.text.split(/[\r\n.!?]+/)) {
      const lower = sentence.toLowerCase();
      if (!subjectTerms.every((term) => lower.includes(term))) continue;
      if (![...queryTerms].some((term) => lower.includes(term))) continue;
      const canonicalCodes = codeValues(sentence);
      if (canonicalCodes.some((value) => !rememberedCodes.has(value))) return true;
    }
  }
  return false;
}
__name(hasExplicitCanonicalContradiction, "hasExplicitCanonicalContradiction");
function queryLanguage(query) {
  const text3 = String(query || "");
  if (/[\u0900-\u097F]/.test(text3)) return "HINDI";
  if (/\b(?:kya|ka|ki|ke|batao|mujhe|chahiye|hai|nahi|yaad|memory)\b/i.test(text3)) return "HINGLISH";
  return "ENGLISH";
}
__name(queryLanguage, "queryLanguage");
function renderRememberedFactForFounder(query, answer) {
  const text3 = String(answer || "").trim();
  const match = text3.match(/^(.+?)\s+(?:has|have|had)\s+(?:an?\s+)?(.+?)\s+([A-Z]{2,}(?:[-_][A-Z0-9]{2,})+)\.?$/i);
  if (!match) return text3;
  const [, subject, property, value] = match;
  const language = queryLanguage(query);
  if (language === "HINDI") return `${subject} \u0915\u093E ${property} ${value} \u0939\u0948\u0964`;
  if (language === "HINGLISH") return `${subject} ka ${property} ${value} hai.`;
  return text3;
}
__name(renderRememberedFactForFounder, "renderRememberedFactForFounder");
function selectDirectRememberedFact(query, results = [], sourceRecords = []) {
  if (!asksForFact(query)) return { matched: false, reason: "NOT_A_FACT_QUESTION" };
  const queryTerms = tokens(query);
  const nonLatinFactQuestion = !queryTerms.size && /[^\u0000-\u007F]/.test(String(query)) && asksForFact(query);
  if (!queryTerms.size && !nonLatinFactQuestion) return { matched: false, reason: "NO_QUERY_TERMS" };
  const recallResults = Array.isArray(results) ? results : [];
  for (const result of recallResults) {
    const answer = directFactText(recalledText(result), query);
    if (!answer) continue;
    const answerTerms = tokens(answer);
    const overlap = matchedTerms(queryTerms, answerTerms);
    const unambiguousNonLatinFact = nonLatinFactQuestion && recallResults.length === 1 && codeValues(answer).length === 1 && !/\n/.test(answer);
    if (overlap.length < 2 && !unambiguousNonLatinFact) continue;
    if (hasExplicitCanonicalContradiction(query, answer, sourceRecords)) {
      return { matched: false, reason: "CANONICAL_CONTRADICTION", answer: null };
    }
    return { matched: true, answer, overlap };
  }
  return { matched: false, reason: "NO_DIRECT_REMEMBERED_FACT" };
}
__name(selectDirectRememberedFact, "selectDirectRememberedFact");

// victor-telegram-worker/reply_integrity.mjs
function text(value) {
  return String(value || "").trim();
}
__name(text, "text");
function founderAskedForNextStep(userMessage = "") {
  return /\b(next|next step|next action|aage|aage kya|ab kya|kya karna|what next|recommend|recommendation|suggest|suggestion|choose action|priority action)\b/i.test(text(userMessage));
}
__name(founderAskedForNextStep, "founderAskedForNextStep");
function founderAskedForStructuredDetail(userMessage = "") {
  return /\b(detail|details|detailed|full|complete|comprehensive|breakdown|report|summary|status report|point wise|pointer wise|bullet)\b/i.test(text(userMessage));
}
__name(founderAskedForStructuredDetail, "founderAskedForStructuredDetail");
function assessReplyNaturalness(reply, userMessage = "") {
  const value = text(reply);
  const violations = [];
  if (!value) return { ok: false, violations: ["EMPTY_REPLY"] };
  const asksNext = founderAskedForNextStep(userMessage);
  const asksDetail = founderAskedForStructuredDetail(userMessage);
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!asksNext && /^\s*(?:next step|next action|recommended action|aage ka step)\s*:/im.test(value)) {
    violations.push("UNSOLICITED_NEXT_STEP_SECTION");
  }
  if (!asksNext && /\b(?:koi aur|another)\s+(?:high[- ]impact\s+)?(?:revenue\s+)?action\s+(?:choose|select)|\bchoose karein\b|\bchoose karen\b|\bwant me to\b|\bshall i\b/i.test(value)) {
    violations.push("UNSOLICITED_ACTION_CTA");
  }
  if (!asksDetail && /^\s*(?:note|current state|status snapshot|summary|evidence summary|recommended action)\s*:/im.test(value)) {
    violations.push("SCRIPTED_TEMPLATE_SECTION");
  }
  if (!asksDetail && lines.length >= 4 && lines.some((line) => /^(?:✅|⚠️|➡️|[-•*])/.test(line))) {
    violations.push("SCRIPTED_STATUS_DUMP");
  }
  if (!asksNext && /\b(?:agar aapko|if you want|if you need).{0,90}\b(?:main|i can|i will).{0,50}\b(?:verify|check|karunga|kar sakta|bataunga)\b/i.test(value)) {
    violations.push("UNSOLICITED_FOLLOWUP_OFFER");
  }
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}
__name(assessReplyNaturalness, "assessReplyNaturalness");
function buildNaturalReplyDirective() {
  return `NATURAL DIRECT REPLY GUARD \u2014 MANDATORY:
- Answer the Founder's exact message directly and naturally.
- Do not use stock report wrappers such as Note:, Current state:, Status snapshot:, Summary:, or Next step: unless explicitly requested.
- Do not append a generic recommendation, CTA, follow-up offer, or "choose another action" line unless the Founder asked what to do next.
- Do not pad a simple answer with status dumps, emojis, checklist formatting, or repeated governance language.
- Preserve evidence exactly. Style cleanup must never add, remove, strengthen, soften, or reinterpret factual claims.
- If evidence is insufficient, say so directly in the answer and stop.`;
}
__name(buildNaturalReplyDirective, "buildNaturalReplyDirective");

// brain/founder_intent.mjs
function normalizeFounderText(value) {
  return String(value || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}
__name(normalizeFounderText, "normalizeFounderText");
function resolveFounderIntent(text3, replyContext = "") {
  const value = normalizeFounderText(text3);
  const hasReplyContext = Boolean(String(replyContext || "").trim());
  if (/^(\?\?|\?|matlab\??|kya matlab\??|what do you mean\??|meaning\??)$/i.test(value)) {
    return {
      mode: "CLARIFICATION",
      reason: hasReplyContext ? "SHORT_CLARIFICATION_WITH_REPLY_CONTEXT" : "SHORT_CLARIFICATION_WITHOUT_CONTEXT",
      objective_change_explicit: false
    };
  }
  const operationFocus = /(focus (?:only |just )?on (?:the )?operation|focus on operations|operation par focus|operations par focus|sirf operation|sirf operations|just focus on operation|sirf kaam par dhyan|sirf kaam pe dhyan|kaam par dhyan|kaam pe dhyan)/i.test(value);
  const paymentDeprioritized = /(i don'?t want any payment|i do not want any payment|payment (?:par |pe )?focus mat|payment nahi chahiye|revenue (?:par |pe )?focus mat|payment par nhi|payment pe nhi|payment par nahi|payment pe nahi|payment nahi)/i.test(value);
  const explicitObjectiveChange = /(change|replace|update|amend).{0,24}(goal|objective)|(goal|objective).{0,24}(change|replace|update|amend)/i.test(value);
  if ((operationFocus || paymentDeprioritized) && !explicitObjectiveChange) {
    return {
      mode: "FOUNDER_DIRECTION",
      reason: operationFocus && paymentDeprioritized ? "OPERATIONS_PRIORITY_PAYMENT_DEPRIORITIZED" : "OPERATING_PRIORITY_DIRECTION",
      objective_change_explicit: false
    };
  }
  if (explicitObjectiveChange) {
    return {
      mode: "OBJECTIVE_CHANGE_REQUEST",
      reason: "EXPLICIT_GOAL_OR_OBJECTIVE_CHANGE_LANGUAGE",
      objective_change_explicit: true
    };
  }
  return { mode: null, reason: "NO_DETERMINISTIC_OVERRIDE", objective_change_explicit: false };
}
__name(resolveFounderIntent, "resolveFounderIntent");
function founderDirectionReply() {
  return "Samajh gaya. Sirf kaam/operation par focus rahega; payment ya revenue ko immediate task priority nahi banaunga. Existing locked goal ko silently replace nahi kiya gaya. Agar aap objective itself change karna chahte hain, usse explicit Founder objective-change ke roop me bind karunga.";
}
__name(founderDirectionReply, "founderDirectionReply");
function clarificationFallback(replyContext = "") {
  const previous = String(replyContext || "").trim();
  if (!previous) return "Aap kis previous reply ko clarify karwana chahte hain? Us message par reply karke ?? bhej dein; main wahi context explain karunga.";
  return `Aap mere previous reply ko clarify kar rahe hain. Previous reply: ${previous.slice(0, 700)}`;
}
__name(clarificationFallback, "clarificationFallback");

// brain/conversation_runtime.mjs
function normalizeConversationText(value) {
  return String(value || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}
__name(normalizeConversationText, "normalizeConversationText");
function looksLikeEvidenceGap(text3 = "") {
  const value = normalizeConversationText(text3);
  return /(evidence unavailable|evidence not available|fresh verified evidence unavailable|not verified|unverified|unknown|not confirmed|cannot confirm|no evidence|pending verification|evidence nahi|verify nahi|pata nahi)/i.test(value);
}
__name(looksLikeEvidenceGap, "looksLikeEvidenceGap");
function classifyConversationFollowUp(text3, session = {}) {
  const value = normalizeConversationText(text3);
  const hasTarget = ["rio", "tony_stark", "aura3"].includes(session?.last_target || session?.active_target);
  const target = session?.last_target || session?.active_target || null;
  const hasTask = Boolean(session?.last_task_id || session?.active_task_id);
  const taskId = session?.last_task_id || session?.active_task_id || null;
  const previousVictor = String(session?.last_victor_reply || "");
  const continuation = /^(pata karke batao|check karke batao|dekh ke batao|dekho aur batao|find out|check and tell me|kya hua|kya status hai|status\??)$/i.test(value);
  const taskStatus = /(iska|uska|task ka|task).*status|status.*(iska|uska|task)|kab pata chalega|kab result milega|result kab|revert kab/i.test(value);
  const problemFollowUp = /^(kya pareshani hai abhi|kaha atka hua hai|kahaan atka hua hai|kahan atka hai|what is the issue now|what is blocking it)$/i.test(value);
  const nextStepFollowUp = /^(to |toh |ab |then |so )?(ab )?(kya karna chahiye|kya kare|kya karen|next kya|aage kya|what should we do|what next|what should i do|what should victor do)\??$/i.test(value);
  const explanationFollowUp = /^(kyu|kyun|kyon|why|aisa kyu|aisa kyun|aisa kyon|why so|why is that|kaise|how so)\??$/i.test(value);
  const investigationVerb = /(iska|iske|uska|ye|this|that).{0,35}(pata karo|verify karo|check karo|confirm karo|investigate karo|find out|verify this|check this|investigate this|confirm this)|(pata karo|verify karo|check karo|confirm karo|investigate karo|find out).{0,50}(iska|iske|uska|ye|this|that)/i.test(value);
  const explicitGapReference = looksLikeEvidenceGap(value);
  const previousGap = looksLikeEvidenceGap(previousVictor);
  if (hasTarget && explanationFollowUp && previousVictor.trim()) {
    return {
      mode: "CONTEXTUAL_EXPLANATION",
      target,
      task_id: taskId,
      query: String(text3 || "").trim(),
      reason: "WHY_OR_HOW_BOUND_TO_PREVIOUS_VERIFIED_REPLY"
    };
  }
  if (hasTarget && (investigationVerb || explicitGapReference) && (previousGap || explicitGapReference || value.length > 20)) {
    return {
      mode: "CONTEXTUAL_INVESTIGATION",
      target,
      task_id: taskId,
      parent_task_id: taskId,
      query: String(text3 || "").trim(),
      reason: "FOLLOWUP_REQUESTS_NEW_EVIDENCE_ON_ACTIVE_THREAD"
    };
  }
  if (taskStatus && hasTask) {
    return { mode: "TASK_STATUS_FOLLOWUP", target, task_id: taskId, reason: "RECENT_TASK_STATUS_REFERENCE" };
  }
  if (nextStepFollowUp && hasTarget) {
    return { mode: "CONTEXTUAL_NEXT_STEP", target, task_id: taskId, reason: hasTask ? "NEXT_STEP_BOUND_TO_ACTIVE_TASK" : "NEXT_STEP_BOUND_TO_ACTIVE_TOPIC" };
  }
  if ((continuation || problemFollowUp) && hasTarget) {
    return { mode: "CONTEXTUAL_DEPARTMENT_FOLLOWUP", target, task_id: taskId, reason: "RECENT_DEPARTMENT_CONTEXT" };
  }
  return { mode: null, target: null, task_id: null, reason: "NO_CONTEXTUAL_FOLLOWUP" };
}
__name(classifyConversationFollowUp, "classifyConversationFollowUp");
function buildInvestigationTaskText(followUp = {}, session = {}) {
  const target = String(followUp?.target || session?.last_target || session?.active_target || "department").toUpperCase();
  const parentTask = followUp?.parent_task_id || session?.last_task_id || session?.active_task_id || "NONE";
  const founderQuery = String(followUp?.query || session?.last_founder_text || "").trim();
  const previousReply = String(session?.last_victor_reply || "").trim();
  return [
    "VICTOR CONTEXTUAL FOLLOW-UP INVESTIGATION",
    `Department: ${target}`,
    `Parent task: ${parentTask}`,
    `Founder asks: ${founderQuery}`,
    previousReply ? `Previous Victor report: ${previousReply.slice(0, 1800)}` : "Previous Victor report: unavailable",
    "Instruction: Investigate only the specific follow-up question using fresh evidence. Do not merely repeat the parent task report. If the requested fact is still unverified, identify exactly which source, collector, artifact, permission, or execution step is missing; state the root cause of the evidence gap; and return the concrete next corrective action. Return traceable evidence."
  ].join("\n");
}
__name(buildInvestigationTaskText, "buildInvestigationTaskText");

// brain/active_context.mjs
var TARGETS2 = [
  ["rio", /\brio\b/i],
  ["tony_stark", /\btony(?:\s+stark)?\b/i],
  ["aura3", /\baura\s*3(?:\.0)?\b|\baura3\b|\baura\b/i],
  ["hulk", /\bhulk\b/i]
];
function normalizeActiveContextText(value) {
  return String(value || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}
__name(normalizeActiveContextText, "normalizeActiveContextText");
function detectExplicitTarget(text3) {
  const value = normalizeActiveContextText(text3);
  for (const [target, pattern] of TARGETS2) {
    if (pattern.test(value)) return target;
  }
  return null;
}
__name(detectExplicitTarget, "detectExplicitTarget");
function inferThreadTopic(text3, previous = {}) {
  const value = normalizeActiveContextText(text3);
  const explicitTarget = detectExplicitTarget(value);
  const target = explicitTarget || previous.active_target || previous.last_target || null;
  const asksStatus = /\b(status|progress|kaha(?:an)?\s+atka|pareshani|problem|issue|blocker|kya\s+hua|result|revert|check|pata)\b/i.test(value);
  const asksAction = /\b(fix|repair|thik|theek|karo|kar do|execute|run|deploy|publish|start|resume|stop|pause|build|update)\b/i.test(value);
  const operatingDirection = /\b(operation|operations|kaam|work)\b/i.test(value) && /\b(focus|dhyan|priority)\b/i.test(value);
  const paymentContrast = /\b(payment|revenue)\b/i.test(value) && /\b(nahi|nhi|not|don't|do not|mat)\b/i.test(value);
  if (operatingDirection || paymentContrast) return "FOUNDER_OPERATING_DIRECTION";
  if (target && asksStatus) return `${target.toUpperCase()}_STATUS_OR_BLOCKER`;
  if (target && asksAction) return `${target.toUpperCase()}_ACTION`;
  if (explicitTarget) return `${explicitTarget.toUpperCase()}_DISCUSSION`;
  if (value.length <= 80 && previous.active_topic) return previous.active_topic;
  return previous.active_topic || "GENERAL_CONVERSATION";
}
__name(inferThreadTopic, "inferThreadTopic");
function buildActiveContext(previous = {}, input = {}) {
  const founderText = String(input.founderText || "").trim();
  const replyContext = String(input.replyContext || "").trim();
  const explicitTarget = detectExplicitTarget(founderText);
  const activeTarget = explicitTarget || previous.active_target || previous.last_target || null;
  const activeTopic = inferThreadTopic(founderText, { ...previous, active_target: activeTarget });
  const looksUnresolved = /\?|\b(batao|pata|check|status|result|revert|kyu|why|how|kaha|kahaan|pareshani|problem|issue|blocker)\b/i.test(founderText);
  return {
    active_topic: activeTopic,
    active_target: activeTarget,
    active_task_id: previous.last_task_id || previous.active_task_id || null,
    active_issue: looksUnresolved ? founderText.slice(0, 500) : previous.active_issue || null,
    unresolved_question: looksUnresolved ? founderText.slice(0, 500) : previous.unresolved_question || null,
    last_founder_text: founderText || previous.last_founder_text || "",
    reply_context: replyContext || previous.reply_context || "",
    context_version: 1
  };
}
__name(buildActiveContext, "buildActiveContext");
function appendRecentTurn(session = {}, role, text3, at = (/* @__PURE__ */ new Date()).toISOString()) {
  const current = Array.isArray(session.recent_turns) ? session.recent_turns : [];
  const next = [...current, { role, text: String(text3 || "").slice(0, 1e3), at }].filter((item) => item.text).slice(-10);
  return { ...session, recent_turns: next };
}
__name(appendRecentTurn, "appendRecentTurn");
function formatActiveContextForPrompt(session = {}) {
  const turns = Array.isArray(session.recent_turns) ? session.recent_turns.slice(-8).map((item) => `${item.role}: ${item.text}`).join("\n") : "";
  return [
    `Active topic: ${session.active_topic || "UNKNOWN"}`,
    `Active department: ${session.active_target || session.last_target || "NONE"}`,
    `Active task: ${session.active_task_id || session.last_task_id || "NONE"}`,
    `Current issue/question: ${session.unresolved_question || session.active_issue || "NONE"}`,
    `Last Founder message: ${session.last_founder_text || "NONE"}`,
    `Last Victor reply: ${session.last_victor_reply || "NONE"}`,
    turns ? `Recent turns:
${turns}` : "Recent turns: NONE"
  ].join("\n");
}
__name(formatActiveContextForPrompt, "formatActiveContextForPrompt");

// brain/anti_bogus_runtime.mjs
function normalize2(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").replace(/\s+/g, " ").trim();
}
__name(normalize2, "normalize");
var UNRESOLVED = /\b(not verified|verify nahi|verified nahi|clear nahi|unclear|unconfirmed|fresh evidence.*nahi|evidence.*available nahi|cannot confirm|unable to verify|pata nahi|maalum nahi|unknown|pending configuration|bridge configured nahi|dispatch nahi hua|read fail|generic status)\b/i;
var ACTIONISH = /\b(check|verify|pata|find|investigate|diagnos|fix|repair|recover|retry|thik|theek|karo|kar do|execute|run|status|kyu|why|blocker|issue|problem)\b/i;
var FOUNDER_ONLY = /\b(credential|secret|token|permission|access|payment|billing|purchase|irreversible|high[- ]risk|approval required|founder approval)\b/i;
function isUnresolvedVictorReply(text3 = "") {
  return UNRESOLVED.test(String(text3 || ""));
}
__name(isUnresolvedVictorReply, "isUnresolvedVictorReply");
function isFounderOnlyDependency(text3 = "") {
  return FOUNDER_ONLY.test(String(text3 || ""));
}
__name(isFounderOnlyDependency, "isFounderOnlyDependency");
function victorTurns(session = {}) {
  return (Array.isArray(session.recent_turns) ? session.recent_turns : []).filter((turn) => turn?.role === "victor" && turn?.text).slice(-4);
}
__name(victorTurns, "victorTurns");
function detectDeadEndLoop(founderText = "", session = {}) {
  const turns = victorTurns(session);
  const last = String(session.last_victor_reply || turns.at(-1)?.text || "");
  if (!last) return { matched: false, reason: "NO_PRIOR_REPLY" };
  if (!ACTIONISH.test(String(founderText || ""))) return { matched: false, reason: "FOUNDER_NOT_REQUESTING_RECOVERY" };
  if (isFounderOnlyDependency(last)) {
    return { matched: false, founder_only: true, reason: "FOUNDER_ONLY_DEPENDENCY", dependency: last };
  }
  if (!isUnresolvedVictorReply(last)) return { matched: false, reason: "LAST_REPLY_NOT_UNRESOLVED" };
  const lastNorm = normalize2(last);
  const unresolvedVictor = turns.filter((turn) => isUnresolvedVictorReply(turn.text));
  const nearDuplicateCount = unresolvedVictor.filter((turn) => {
    const current = normalize2(turn.text);
    if (!current || !lastNorm) return false;
    if (current === lastNorm) return true;
    const a = new Set(current.split(" "));
    const b = new Set(lastNorm.split(" "));
    const shared = [...a].filter((token) => b.has(token)).length;
    return shared / Math.max(1, Math.min(a.size, b.size)) >= 0.7;
  }).length;
  return {
    matched: nearDuplicateCount >= 1,
    reason: nearDuplicateCount >= 2 ? "REPEATED_UNRESOLVED_REPLY" : "UNRESOLVED_REPLY_REQUIRES_RECOVERY",
    repeated_count: nearDuplicateCount,
    target: session.active_target || session.last_target || null,
    prior_reply: last
  };
}
__name(detectDeadEndLoop, "detectDeadEndLoop");
function buildDeadEndRecoveryPrompt(detection = {}, founderText = "") {
  const target = detection.target || "relevant department";
  return [
    "VICTOR DEAD-END RECOVERY",
    `Target: ${target}`,
    `Founder request: ${String(founderText || "").trim()}`,
    `Prior unresolved reply: ${String(detection.prior_reply || "").slice(0, 1e3)}`,
    "Do not repeat the prior unresolved answer.",
    "Own the problem: inspect fresh evidence, identify the root cause, take the next safe corrective/retry action that existing authority permits, and return fresh evidence.",
    "If blocked only by a credential, permission, payment, or irreversible/high-risk Founder decision, stop and state exactly that dependency and the one action required from Founder.",
    "Never claim completed/deployed/live/healthy unless fresh evidence verifies that exact stage."
  ].join("\n");
}
__name(buildDeadEndRecoveryPrompt, "buildDeadEndRecoveryPrompt");
function buildNonRepetitionDirective(session = {}) {
  const recent = victorTurns(session).map((turn) => String(turn.text || "").slice(0, 800));
  return [
    "ANTI-BOGUS / NO-DEAD-END CONTRACT:",
    "- A repeated unresolved statement is a runtime failure, not a valid answer.",
    "- If the previous answer said unverified/unclear/unknown/pending, do not paraphrase it again.",
    "- Either produce new evidence/action/root cause, or name the exact Founder-only dependency.",
    "- Model output and memory are not proof of external state.",
    recent.length ? `Recent Victor replies to avoid repeating:
${recent.join("\n---\n")}` : "Recent Victor replies: none"
  ].join("\n");
}
__name(buildNonRepetitionDirective, "buildNonRepetitionDirective");

// brain/founder_conversation.mjs
function naturalDispatchAcknowledgement(target, request = "") {
  const name = displayTarget(target);
  const text3 = String(request || "").trim();
  const lower = text3.toLowerCase();
  if (/(instagram|insta).*(latest|new|post)|(?:latest|new).*(instagram|insta)/i.test(lower)) {
    return `${name} ka latest actually published Instagram post fresh evidence se verify kar raha hoon. Draft ya ready-to-post item ko published nahi maanunga. Result milte hi seedha yahin bataunga.`;
  }
  if (/(status|progress|kaha|kahaan|atka|pareshani|problem|issue|blocker)/i.test(lower)) {
    return `${name} ka fresh status check kar raha hoon. Jo actual blocker ya next step evidence se confirm hoga, wahi bataunga.`;
  }
  return `${name} par ye kaam start karwa diya hai. Internal tracking main handle kar raha hoon; useful result milte hi seedha update dunga.`;
}
__name(naturalDispatchAcknowledgement, "naturalDispatchAcknowledgement");
function naturalInvestigationAcknowledgement(target, query = "") {
  const name = displayTarget(target);
  const subject = String(query || "").trim();
  return subject ? `Haan, isi point ko specifically verify kar raha hoon: \u201C${clip(subject, 180)}\u201D. Purani report repeat nahi karunga; fresh evidence ya exact evidence-gap ka reason bataunga.` : `${name} ke isi unresolved point ko specifically verify kar raha hoon. Purani report repeat nahi karunga; fresh evidence ya exact evidence-gap ka reason bataunga.`;
}
__name(naturalInvestigationAcknowledgement, "naturalInvestigationAcknowledgement");
function naturalPendingReply(target) {
  const name = displayTarget(target);
  return `${name} ka fresh result abhi pending hai. Main isi check ko track kar raha hoon\u2014duplicate task create nahi kar raha. Result aate hi yahin bataunga.`;
}
__name(naturalPendingReply, "naturalPendingReply");
function buildNaturalResultPrompt(target, founderQuestion, rawReport) {
  return [
    "You are Victor speaking directly to the Founder in a natural conversational style.",
    "Answer like a capable executive assistant, not like a workflow engine, ticketing bot, audit log, or API response.",
    "Use concise natural Hinglish unless the Founder used English.",
    "Lead with the actual answer. Then mention only the useful evidence, implication, blocker, or next step.",
    "Do not expose internal task IDs, schema names, transport states, file paths, certification boilerplate, or machine labels unless the Founder explicitly asked for technical details.",
    "Do not invent facts. Preserve uncertainty exactly. READY_TO_POST is not PUBLISHED. Internal progress is not business outcome.",
    "If the raw report does not answer the question, say what is still unknown and what Victor is doing to verify it.",
    `Department: ${displayTarget(target)}`,
    `Founder question/context: ${String(founderQuestion || "").trim() || "Not supplied"}`,
    `Verified raw report:
${String(rawReport || "").trim()}`
  ].join("\n\n");
}
__name(buildNaturalResultPrompt, "buildNaturalResultPrompt");
function naturalResultFallback(target, rawReport) {
  const name = displayTarget(target);
  const cleaned = String(rawReport || "").replace(/Victor verification:[\s\S]*$/i, "").replace(/\bTask(?: ID)?:\s*[^\s]+/gi, "").replace(/\b(?:REPORTING_CONNECTED_PENDING_VICTOR_CERTIFICATION|CHECKED_AGAINST_[A-Z0-9_]+)\b/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned ? `${name} ka fresh verified update:

${cleaned}` : `${name} ka fresh result mila hai, lekin useful Founder-facing summary abhi generate nahi ho paayi.`;
}
__name(naturalResultFallback, "naturalResultFallback");
function displayTarget(target) {
  const value = String(target || "").toLowerCase();
  if (value === "rio") return "RIO";
  if (value === "tony_stark") return "Tony";
  if (value === "aura3") return "AURA3";
  if (value === "hulk") return "HULK";
  return value ? value.toUpperCase() : "Department";
}
__name(displayTarget, "displayTarget");
function clip(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}\u2026`;
}
__name(clip, "clip");

// brain/problem_ownership.mjs
function normalizeProblemText(value) {
  return String(value || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}
__name(normalizeProblemText, "normalizeProblemText");
function classifyOwnedProblem(text3, session = {}) {
  const value = normalizeProblemText(text3);
  const explicitTarget = /\brio\b/i.test(value) ? "rio" : /\btony(?:\s+stark)?\b/i.test(value) ? "tony_stark" : /\baura\s*3(?:\.0)?\b|\baura3\b|\baura\b/i.test(value) ? "aura3" : null;
  const target = explicitTarget || session?.active_target || session?.last_target || null;
  if (!["rio", "tony_stark", "aura3"].includes(target)) return { matched: false, target: null, reason: "NO_SUPPORTED_TARGET" };
  const blockerQuestion = /(kaha(?:an)?\s+atka|kyu\s+(?:nahi|nhi)\s+(?:hua|bana|develop|publish)|kyon\s+(?:nahi|nhi)|pareshani|problem|issue|blocker|what.*blocking|why.*not|stuck)/i.test(value);
  const ownershipAction = /(khud|apne\s+aap|automatically|auto|fix|thik|theek|repair|resolve|recover|continue|aage\s+badh|publish|post\s+kar|live\s+kar|develop|final\s+result|outcome)/i.test(value);
  const operationalOutcome = /(instagram|post|creative|publish|website|campaign|content|revenue|conversion|operation|kaam|result|outcome)/i.test(value);
  const threadText = normalizeProblemText([
    session?.active_issue,
    session?.unresolved_question,
    session?.last_founder_text,
    session?.last_victor_reply
  ].filter(Boolean).join(" "));
  const threadOperational = /(instagram|post|creative|publish|website|campaign|content|revenue|conversion|operation|kaam|blocker|issue|problem|stuck|result|outcome)/i.test(threadText);
  const explicitOwnershipFollowUp = /^(isko|ise|usko|usse|ye|this|that)?\s*(khud|apne\s+aap)?\s*(fix|thik|theek|repair|resolve|recover|continue|aage\s+badh|publish|post\s+kar|live\s+kar|develop).*(final\s+result|result|outcome|batao|do)?/i.test(value) || /(khud|apne\s+aap).*(fix|resolve|recover|continue|publish|develop)/i.test(value);
  if (blockerQuestion && (ownershipAction || operationalOutcome)) {
    return { matched: true, target, mode: "OWNED_PROBLEM_RECOVERY", reason: "BLOCKER_OR_DELAY_REQUIRES_DIAGNOSE_FIX_CONTINUE" };
  }
  if (ownershipAction && operationalOutcome) {
    return { matched: true, target, mode: "OWNED_PROBLEM_RECOVERY", reason: "FOUNDER_REQUESTS_OUTCOME_OWNERSHIP" };
  }
  if (!explicitTarget && explicitOwnershipFollowUp && threadOperational) {
    return { matched: true, target, mode: "OWNED_PROBLEM_RECOVERY", reason: "OWNERSHIP_FOLLOWUP_BOUND_TO_ACTIVE_OPERATIONAL_THREAD" };
  }
  return { matched: false, target, reason: "STATUS_OR_ACTION_NOT_OWNERSHIP_CLASS" };
}
__name(classifyOwnedProblem, "classifyOwnedProblem");
function buildOwnedProblemPrompt(target, founderRequest, previous = null) {
  const name = String(target || "").toUpperCase();
  const lines = [
    "VICTOR OWNED PROBLEM RECOVERY",
    `Department: ${name}`,
    `Founder request: ${String(founderRequest || "").trim()}`,
    "Operating contract: You own the problem to the verified outcome. Do not stop at diagnosis or a recommendation when the next corrective action is within existing authority.",
    "Required loop: inspect fresh evidence -> identify symptom/root cause -> execute the highest-impact corrective action -> verify the result -> continue to the next corrective action until the requested outcome is verified or a genuine Founder-only boundary is reached.",
    "Routine approval is not a blocker. Do not return VICTOR_REVIEW_REQUIRED, AUTHORIZE_REPAIR_PLAN, or similar internal approval language unless the next step truly requires credential/account identity administration, spend above the configured ceiling, irreversible high-impact commitment, unresolved legal/security judgment, explicit objective change, or Founder pause.",
    "If another department is better suited for a subproblem, state the concrete handoff needed in next_action with the capability required. Victor may reroute it automatically.",
    "Return strict_supervision with status, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up. Set requires_follow_up=true whenever the Founder-requested outcome is not yet verified and no Founder-only boundary exists.",
    "Do not claim published/live/completed without traceable external or canonical evidence."
  ];
  if (previous) lines.push(`Previous verified result: ${JSON.stringify(previous).slice(0, 5e3)}`);
  return lines.join("\n");
}
__name(buildOwnedProblemPrompt, "buildOwnedProblemPrompt");
function naturalOwnedProblemAck(target) {
  const name = target === "rio" ? "RIO" : target === "tony_stark" ? "Tony" : target === "aura3" ? "AURA3" : "Department";
  return `${name} ka issue own kar liya hai. Fresh evidence se root cause verify karke jo corrective action meri authority ke andar hai wo execute karunga, phir final outcome verify karke update dunga. Sirf genuine Founder-only boundary par aapko involve karunga.`;
}
__name(naturalOwnedProblemAck, "naturalOwnedProblemAck");

// brain/truth_resolver.mjs
var TRUTH_SOURCE_PRECEDENCE = Object.freeze({
  EXTERNAL_RESULT: 700,
  WORKFLOW_JOB: 600,
  DEPARTMENT_ENVELOPE: 500,
  CANONICAL_STATE: 400,
  HISTORICAL_LOG: 300,
  DURABLE_MEMORY: 200,
  CONVERSATION_CONTEXT: 100
});
var DEFAULT_STALE_AFTER_MS = 30 * 60 * 1e3;
function isoMs(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}
__name(isoMs, "isoMs");
function normalizeSourceClass(value) {
  const key = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRUTH_SOURCE_PRECEDENCE, key) ? key : "CONVERSATION_CONTEXT";
}
__name(normalizeSourceClass, "normalizeSourceClass");
function makeFactReceipt({
  fact,
  value,
  sourceClass,
  sourceUri,
  observedAt: observedAt2 = null,
  fetchedAt = (/* @__PURE__ */ new Date()).toISOString(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  confidence = "HIGH",
  scope = null,
  metadata = null
} = {}) {
  const source_class = normalizeSourceClass(sourceClass);
  const fetchedMs = isoMs(fetchedAt) ?? Date.now();
  const observedMs = isoMs(observedAt2);
  const ageMs = observedMs == null ? null : Math.max(0, fetchedMs - observedMs);
  const stale = ageMs != null && Number.isFinite(staleAfterMs) && ageMs > staleAfterMs;
  return {
    fact: String(fact || "").trim(),
    value: value ?? null,
    source_class,
    source_precedence: TRUTH_SOURCE_PRECEDENCE[source_class],
    source_uri: String(sourceUri || "").trim() || null,
    observed_at: observedAt2 || null,
    fetched_at: fetchedAt || null,
    age_ms: ageMs,
    stale_after_ms: staleAfterMs,
    stale,
    confidence: String(confidence || "UNKNOWN").toUpperCase(),
    scope,
    metadata
  };
}
__name(makeFactReceipt, "makeFactReceipt");
function valueFingerprint(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
__name(valueFingerprint, "valueFingerprint");
function compareReceipts(a, b) {
  const precedence = (b.source_precedence || 0) - (a.source_precedence || 0);
  if (precedence !== 0) return precedence;
  if (a.stale !== b.stale) return a.stale ? 1 : -1;
  const aObserved = isoMs(a.observed_at) ?? isoMs(a.fetched_at) ?? 0;
  const bObserved = isoMs(b.observed_at) ?? isoMs(b.fetched_at) ?? 0;
  return bObserved - aObserved;
}
__name(compareReceipts, "compareReceipts");
function reconcileReceiptSet(receipts = []) {
  const usable = (Array.isArray(receipts) ? receipts : []).filter((item) => item && item.fact && item.source_uri).map((item) => ({ ...item, source_class: normalizeSourceClass(item.source_class), source_precedence: TRUTH_SOURCE_PRECEDENCE[normalizeSourceClass(item.source_class)] })).sort(compareReceipts);
  if (!usable.length) {
    return { status: "UNRESOLVED", selected: null, rejected: [], conflict: false, reason: "NO_USABLE_RECEIPTS" };
  }
  const selected = usable[0];
  const selectedFingerprint = valueFingerprint(selected.value);
  const conflicting = usable.filter((item) => valueFingerprint(item.value) !== selectedFingerprint);
  const rejected = usable.slice(1).map((item) => {
    let reason = "LOWER_PRIORITY_DUPLICATE";
    if (valueFingerprint(item.value) !== selectedFingerprint) {
      if ((item.source_precedence || 0) < (selected.source_precedence || 0)) reason = "LOWER_PRECEDENCE_CONFLICT";
      else if (item.stale && !selected.stale) reason = "STALE_CONFLICT";
      else reason = "OLDER_OR_LOWER_CONFIDENCE_CONFLICT";
    }
    return { receipt: item, reason };
  });
  return {
    status: selected.stale ? "RESOLVED_STALE_ONLY" : "RESOLVED",
    selected,
    rejected,
    conflict: conflicting.length > 0,
    reason: selected.stale ? "BEST_AVAILABLE_RECEIPT_IS_STALE" : "HIGHEST_PRECEDENCE_FRESHEST_RECEIPT"
  };
}
__name(reconcileReceiptSet, "reconcileReceiptSet");
function resolveTruthReceipts(receipts = []) {
  const grouped = /* @__PURE__ */ new Map();
  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    if (!receipt?.fact) continue;
    const key = String(receipt.fact);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(receipt);
  }
  const facts = {};
  for (const [fact, items] of grouped.entries()) facts[fact] = reconcileReceiptSet(items);
  return {
    schema_version: 1,
    truth_hierarchy: Object.keys(TRUTH_SOURCE_PRECEDENCE),
    facts,
    unresolved: Object.entries(facts).filter(([, result]) => result.status === "UNRESOLVED").map(([fact]) => fact),
    stale_only: Object.entries(facts).filter(([, result]) => result.status === "RESOLVED_STALE_ONLY").map(([fact]) => fact),
    conflicts: Object.entries(facts).filter(([, result]) => result.conflict).map(([fact]) => fact)
  };
}
__name(resolveTruthReceipts, "resolveTruthReceipts");

// brain/result_truth_receipts.mjs
function unique4(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}
__name(unique4, "unique");
function observedAt(result = {}) {
  return result.observed_at || result.completed_at || result.updated_at || (/* @__PURE__ */ new Date()).toISOString();
}
__name(observedAt, "observedAt");
function externalVerificationOf(result = {}) {
  const strict = result.strict_supervision || {};
  const finalOutcome = result.final_outcome || strict.final_outcome || {};
  const explicit = result.external_verification || finalOutcome.external_verification || null;
  if (!explicit || explicit.verified !== true) return null;
  const evidence = unique4(Array.isArray(explicit.evidence) ? explicit.evidence : []);
  if (!evidence.length) return null;
  return {
    verified: true,
    objective_met: explicit.objective_met === true || finalOutcome.objective_met === true,
    platform: explicit.platform || null,
    external_id: explicit.external_id || explicit.media_id || explicit.transaction_id || null,
    permalink: explicit.permalink || explicit.url || null,
    evidence
  };
}
__name(externalVerificationOf, "externalVerificationOf");
function buildResultTruthReceipts(result = {}, { target = null, taskId = null, fetchedAt = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const strict = result.strict_supervision || {};
  const finalOutcome = result.final_outcome || strict.final_outcome || {};
  const sender = target || result.sender || "unknown";
  const task = taskId || result.task_id || "unknown";
  const sourceUri = `department://${sender}/task/${task}`;
  const at = observedAt(result);
  const receipts = [];
  const pushEnvelope = /* @__PURE__ */ __name((fact, value, metadata = null) => {
    if (value === void 0 || value === null) return;
    receipts.push(makeFactReceipt({
      fact,
      value,
      sourceClass: "DEPARTMENT_ENVELOPE",
      sourceUri,
      observedAt: at,
      fetchedAt,
      staleAfterMs: 30 * 60 * 1e3,
      confidence: result.__victor_verified === true ? "HIGH" : "MEDIUM",
      scope: { target: sender, task_id: task },
      metadata
    }));
  }, "pushEnvelope");
  pushEnvelope(`${sender}.result.status`, strict.status || result.execution_status || "UNKNOWN");
  pushEnvelope(`${sender}.result.blocker`, strict.error_or_blocker ?? result.blockers ?? null);
  pushEnvelope(`${sender}.result.next_action`, strict.next_action || result.next_valid_action || null);
  pushEnvelope(`${sender}.result.requires_follow_up`, strict.requires_follow_up === true);
  pushEnvelope(`${sender}.result.work_performed`, Boolean(
    result.governed_business_cycle_performed === true || result.public_action_performed === true || result.changed_files?.length || result.snapshot?.changed_files?.length
  ));
  if (Object.keys(finalOutcome).length) {
    pushEnvelope(`${sender}.result.final_outcome_claim`, {
      verified: finalOutcome.verified === true,
      objective_met: finalOutcome.objective_met === true,
      evidence: unique4(Array.isArray(finalOutcome.evidence) ? finalOutcome.evidence : [])
    }, { note: "Department final-outcome claim; not automatically an external-platform result." });
  }
  const external = externalVerificationOf(result);
  if (external) {
    const platformUri = external.permalink || `external://${external.platform || sender}/${external.external_id || task}`;
    receipts.push(makeFactReceipt({
      fact: `${sender}.external.objective_outcome`,
      value: external,
      sourceClass: "EXTERNAL_RESULT",
      sourceUri: platformUri,
      observedAt: at,
      fetchedAt,
      staleAfterMs: Number.POSITIVE_INFINITY,
      confidence: "HIGH",
      scope: { target: sender, task_id: task, platform: external.platform },
      metadata: { evidence_count: external.evidence.length }
    }));
  }
  return receipts;
}
__name(buildResultTruthReceipts, "buildResultTruthReceipts");
function attachResultTruth(result = {}, options = {}) {
  const receipts = buildResultTruthReceipts(result, options);
  return {
    ...result,
    truth_receipts: [...Array.isArray(result.truth_receipts) ? result.truth_receipts : [], ...receipts],
    resolved_truth: resolveTruthReceipts([...Array.isArray(result.truth_receipts) ? result.truth_receipts : [], ...receipts])
  };
}
__name(attachResultTruth, "attachResultTruth");

// brain/outcome_state.mjs
var OUTCOME_STAGE = Object.freeze({
  TASK_SENT: "TASK_SENT",
  WORK_PERFORMED: "WORK_PERFORMED",
  RESULT_VERIFIED: "RESULT_VERIFIED",
  OBJECTIVE_ACHIEVED: "OBJECTIVE_ACHIEVED",
  FOUNDER_ONLY_BLOCKER: "FOUNDER_ONLY_BLOCKER",
  EXECUTION_UNVERIFIED: "EXECUTION_UNVERIFIED"
});
var FOUNDER_BOUNDARY = /(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND).{0,40}(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY)|(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY).{0,40}(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND)|SPEND.{0,30}(?:CEILING|LIMIT|APPROVAL)|IRREVERSIBLE|LEGAL.{0,30}(?:JUDGMENT|DECISION|APPROVAL)|SECURITY.{0,30}(?:JUDGMENT|DECISION|APPROVAL)|OBJECTIVE_IMPOSSIBLE|GOAL_IMPOSSIBLE|CHANGE_(?:GOAL|OBJECTIVE|SUCCESS_CRITERIA)|FOUNDER_(?:PAUSE|HOLD|GOAL_CHANGE_REQUIRED)/i;
var EXTERNAL_OUTCOME_INTENT = /\b(?:publish|published|post(?:ed)?|instagram|meta|payment|paid|revenue|sale|order|transaction|permalink|live\s+external|external\s+platform)\b/i;
function text2(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(" | ") : String(value ?? "");
}
__name(text2, "text");
function evidenceOf(result = {}) {
  const strict = result?.strict_supervision || {};
  const finalOutcome = result?.final_outcome || strict?.final_outcome || {};
  const evidence = [
    ...Array.isArray(strict.evidence) ? strict.evidence : [],
    ...Array.isArray(finalOutcome.evidence) ? finalOutcome.evidence : []
  ];
  return [...new Set(evidence.filter(Boolean).map(String))];
}
__name(evidenceOf, "evidenceOf");
function hasResolvedExternalOutcome(result = {}, target = null) {
  const fact = `${target || result?.sender || "unknown"}.external.objective_outcome`;
  const resolved = result?.resolved_truth?.facts?.[fact];
  return Boolean(
    resolved?.status === "RESOLVED" && resolved?.selected?.source_class === "EXTERNAL_RESULT" && resolved?.selected?.value?.verified === true && resolved?.selected?.value?.objective_met === true && Array.isArray(resolved?.selected?.value?.evidence) && resolved.selected.value.evidence.length > 0
  );
}
__name(hasResolvedExternalOutcome, "hasResolvedExternalOutcome");
function createOwnedOutcomeState({ target, founderRequest, taskId, previous = null } = {}) {
  const prior = previous && typeof previous === "object" ? previous : {};
  return {
    schema_version: 1,
    target: target || prior.target || null,
    founder_request: String(founderRequest || prior.founder_request || "").trim(),
    stage: OUTCOME_STAGE.TASK_SENT,
    task_id: taskId || null,
    attempts: Math.max(1, Number(prior.attempts || 0) + 1),
    repeated_failure_count: Number(prior.repeated_failure_count || 0),
    last_failure_fingerprint: prior.last_failure_fingerprint || null,
    founder_boundary: false,
    objective_achieved: false,
    requires_follow_up: true,
    work_performed: false,
    result_verified: false,
    evidence: Array.isArray(prior.evidence) ? prior.evidence : [],
    truth_receipts: Array.isArray(prior.truth_receipts) ? prior.truth_receipts : [],
    resolved_truth: prior.resolved_truth || null,
    last_status: "TASK_DISPATCHED",
    last_next_action: null
  };
}
__name(createOwnedOutcomeState, "createOwnedOutcomeState");
function assessVerifiedDepartmentResult(result = {}, priorState = {}) {
  const truthAttached = attachResultTruth(result, {
    target: priorState?.target || result?.sender || null,
    taskId: result?.task_id || priorState?.task_id || null
  });
  const strict = truthAttached?.strict_supervision || {};
  const finalOutcome = truthAttached?.final_outcome || strict?.final_outcome || {};
  const evidence = evidenceOf(truthAttached);
  const status = String(strict.status || truthAttached.execution_status || "UNKNOWN").toUpperCase();
  const blocker = strict.error_or_blocker ?? truthAttached.blockers ?? null;
  const nextAction = strict.next_action || truthAttached.next_valid_action || null;
  const boundaryText = [status, text2(blocker), text2(nextAction)].join(" ");
  const founderBoundary = FOUNDER_BOUNDARY.test(boundaryText);
  const externalOutcomeRequired = EXTERNAL_OUTCOME_INTENT.test(String(priorState?.founder_request || ""));
  const externalOutcomeVerified = hasResolvedExternalOutcome(truthAttached, priorState?.target || truthAttached?.sender || null);
  const departmentOutcomeClaim = Boolean(
    finalOutcome?.verified === true && finalOutcome?.objective_met === true && Array.isArray(finalOutcome.evidence) && finalOutcome.evidence.length > 0 || /GOAL_ACHIEVED_VERIFIED|OBJECTIVE_MET_VERIFIED/.test(status) && evidence.length > 0
  );
  const objectiveAchieved = externalOutcomeRequired ? externalOutcomeVerified : departmentOutcomeClaim;
  const verified = truthAttached?.__victor_verified === true;
  const workPerformed = Boolean(
    truthAttached?.governed_business_cycle_performed === true || truthAttached?.public_action_performed === true || truthAttached?.changed_files?.length || truthAttached?.snapshot?.changed_files?.length || !/READ_ONLY|REPORTING_CONNECTED|STATUS_CHECK/.test(String(truthAttached.execution_status || "").toUpperCase()) && evidence.length > 0
  );
  let stage = OUTCOME_STAGE.EXECUTION_UNVERIFIED;
  if (workPerformed) stage = OUTCOME_STAGE.WORK_PERFORMED;
  if (verified) stage = OUTCOME_STAGE.RESULT_VERIFIED;
  if (founderBoundary) stage = OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER;
  if (objectiveAchieved) stage = OUTCOME_STAGE.OBJECTIVE_ACHIEVED;
  const requiresFollowUp = objectiveAchieved ? false : founderBoundary ? false : externalOutcomeRequired && departmentOutcomeClaim ? true : strict.requires_follow_up === true;
  const failureFingerprint = blocker || nextAction ? [priorState?.target || truthAttached?.sender || "unknown", status, text2(blocker), text2(nextAction)].filter(Boolean).join("|").slice(0, 500) : null;
  const repeatedFailureCount = failureFingerprint && failureFingerprint === priorState?.last_failure_fingerprint ? Number(priorState?.repeated_failure_count || 0) + 1 : failureFingerprint ? 1 : 0;
  return {
    ...priorState,
    stage,
    founder_boundary: founderBoundary,
    objective_achieved: objectiveAchieved,
    external_outcome_required: externalOutcomeRequired,
    external_outcome_verified: externalOutcomeVerified,
    requires_follow_up: requiresFollowUp,
    work_performed: workPerformed,
    result_verified: verified,
    evidence: [.../* @__PURE__ */ new Set([...priorState?.evidence || [], ...evidence])].slice(-100),
    truth_receipts: [...Array.isArray(priorState?.truth_receipts) ? priorState.truth_receipts : [], ...truthAttached.truth_receipts || []].slice(-100),
    resolved_truth: truthAttached.resolved_truth || priorState?.resolved_truth || null,
    last_status: status,
    last_next_action: nextAction,
    last_blocker: blocker,
    last_failure_fingerprint: failureFingerprint,
    repeated_failure_count: repeatedFailureCount
  };
}
__name(assessVerifiedDepartmentResult, "assessVerifiedDepartmentResult");
function shouldContinueOwnedRecovery(state = {}, maxAttempts = 3) {
  return Boolean(
    state.stage !== OUTCOME_STAGE.OBJECTIVE_ACHIEVED && state.stage !== OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER && state.result_verified === true && state.requires_follow_up === true && Number(state.attempts || 0) < maxAttempts
  );
}
__name(shouldContinueOwnedRecovery, "shouldContinueOwnedRecovery");
function buildOwnedRecoveryDirective(state = {}) {
  const repeated = Number(state.repeated_failure_count || 0) >= 2;
  const lines = [
    "VICTOR OWNED OUTCOME CONTINUATION",
    `Current stage: ${state.stage || "UNKNOWN"}`,
    `Attempt: ${Number(state.attempts || 0) + 1}`,
    state.external_outcome_required && !state.external_outcome_verified ? "External outcome proof is still missing; do not treat a department completion claim as the Founder outcome." : null,
    state.last_status ? `Last verified status: ${state.last_status}` : null,
    state.last_blocker ? `Last blocker: ${text2(state.last_blocker)}` : null,
    state.last_next_action ? `Last next action: ${text2(state.last_next_action)}` : null,
    repeated ? "REPEATED FAILURE MODE: Do not repeat the same action. Run evidence-backed Five Whys, identify the best-supported controllable root cause, then change the route/strategy or corrective action." : "Continue from the verified result. Execute the next corrective action; do not stop at diagnosis or recommendation.",
    "Return fresh evidence and set requires_follow_up=true if the Founder-requested outcome is still not verified and no Founder-only boundary exists."
  ].filter(Boolean);
  return lines.join("\n");
}
__name(buildOwnedRecoveryDirective, "buildOwnedRecoveryDirective");

// brain/conversation_state_store.mjs
var INTERNAL_PREFIX = "https://victor.internal/conversation/";
function normalizeChatId(chatId) {
  return String(chatId ?? "").trim();
}
__name(normalizeChatId, "normalizeChatId");
function durableKey(chatId) {
  return `conversation:${normalizeChatId(chatId)}`;
}
__name(durableKey, "durableKey");
function cacheRequest(chatId) {
  return new Request(`${INTERNAL_PREFIX}${encodeURIComponent(normalizeChatId(chatId))}`);
}
__name(cacheRequest, "cacheRequest");
function conversationStateCapability(env = {}) {
  const binding2 = env.VICTOR_CONVERSATION_STATE;
  if (binding2 && typeof binding2.get === "function" && typeof binding2.put === "function") {
    return {
      mode: "DURABLE_BINDING",
      durable: true,
      binding: "VICTOR_CONVERSATION_STATE",
      reason: "KV_LIKE_GET_PUT_BINDING_AVAILABLE"
    };
  }
  return {
    mode: "BEST_EFFORT_CACHE",
    durable: false,
    binding: null,
    reason: "NO_DURABLE_CONVERSATION_BINDING_CONFIGURED"
  };
}
__name(conversationStateCapability, "conversationStateCapability");
async function readConversationState(env, chatId, options = {}) {
  const id = normalizeChatId(chatId);
  if (!id) return { state: {}, capability: conversationStateCapability(env), found: false };
  const capability = conversationStateCapability(env);
  if (capability.durable) {
    try {
      const raw = await env.VICTOR_CONVERSATION_STATE.get(durableKey(id), { type: "json" });
      const state = raw && typeof raw === "object" ? raw : {};
      return { state, capability, found: Boolean(raw) };
    } catch (error) {
      if (options.requireDurable === true) {
        const failure = new Error("DURABLE_CONVERSATION_STATE_READ_FAILED");
        failure.cause = error;
        throw failure;
      }
      return readCacheState(id, { ...capability, mode: "CACHE_FALLBACK_AFTER_DURABLE_READ_ERROR", durable: false, reason: "DURABLE_READ_FAILED" });
    }
  }
  if (options.requireDurable === true) throw new Error("DURABLE_CONVERSATION_STATE_UNAVAILABLE");
  return readCacheState(id, capability);
}
__name(readConversationState, "readConversationState");
async function writeConversationState(env, chatId, patch = {}, options = {}) {
  const id = normalizeChatId(chatId);
  if (!id) throw new Error("CONVERSATION_CHAT_ID_REQUIRED");
  const capability = conversationStateCapability(env);
  const currentRecord = await readConversationState(env, id, { requireDurable: options.requireDurable === true });
  const next = {
    ...currentRecord.state || {},
    ...patch || {},
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (capability.durable) {
    try {
      await env.VICTOR_CONVERSATION_STATE.put(durableKey(id), JSON.stringify(next));
      return { state: next, capability, persisted: true };
    } catch (error) {
      if (options.requireDurable === true) {
        const failure = new Error("DURABLE_CONVERSATION_STATE_WRITE_FAILED");
        failure.cause = error;
        throw failure;
      }
      const fallback = await writeCacheState(id, next);
      return {
        ...fallback,
        capability: { ...capability, mode: "CACHE_FALLBACK_AFTER_DURABLE_WRITE_ERROR", durable: false, reason: "DURABLE_WRITE_FAILED" }
      };
    }
  }
  if (options.requireDurable === true) throw new Error("DURABLE_CONVERSATION_STATE_UNAVAILABLE");
  return writeCacheState(id, next, capability);
}
__name(writeConversationState, "writeConversationState");
async function readCacheState(chatId, capability) {
  try {
    const hit = await caches.default.match(cacheRequest(chatId));
    return { state: hit ? await hit.json() : {}, capability, found: Boolean(hit) };
  } catch (_) {
    return { state: {}, capability: { ...capability, mode: "CACHE_UNAVAILABLE", durable: false, reason: "CACHE_READ_FAILED" }, found: false };
  }
}
__name(readCacheState, "readCacheState");
async function writeCacheState(chatId, next, capability = conversationStateCapability({})) {
  try {
    await caches.default.put(
      cacheRequest(chatId),
      new Response(JSON.stringify(next), {
        headers: { "Cache-Control": "public, max-age=7200", "Content-Type": "application/json" }
      })
    );
    return { state: next, capability, persisted: true };
  } catch (_) {
    return {
      state: next,
      capability: { ...capability, mode: "CACHE_UNAVAILABLE", durable: false, reason: "CACHE_WRITE_FAILED" },
      persisted: false
    };
  }
}
__name(writeCacheState, "writeCacheState");

// brain/fact_evidence_resolver.mjs
function push(receipts, fact, value, sourceUri, fetchedAt, observedAt2 = null, options = {}) {
  if (value === void 0 || value === null) return;
  receipts.push(makeFactReceipt({
    fact,
    value,
    sourceClass: options.sourceClass || "CANONICAL_STATE",
    sourceUri,
    fetchedAt,
    observedAt: observedAt2,
    staleAfterMs: options.staleAfterMs,
    confidence: options.confidence || "HIGH",
    scope: options.scope || null,
    metadata: options.metadata || null
  }));
}
__name(push, "push");
function buildFactReceipts(evidence = {}) {
  const fetchedAt = evidence.fetched_at_utc || (/* @__PURE__ */ new Date()).toISOString();
  const receipts = [];
  const rio = evidence.rio || {};
  const runner = rio.heartbeat_runner_status || {};
  const control = rio.control || {};
  const production = rio.production_control || {};
  const work = rio.work_status || {};
  const igRun = rio.instagram_run_status || {};
  push(receipts, "rio.heartbeat.runner_state", runner.state, "github://vickykenin-lang/rio-affiliate-engine/data/heartbeat_runner_status.json", fetchedAt, runner.finished_at_utc || runner.started_at_utc, { staleAfterMs: 20 * 60 * 1e3 });
  push(receipts, "rio.heartbeat.finished_at_utc", runner.finished_at_utc, "github://vickykenin-lang/rio-affiliate-engine/data/heartbeat_runner_status.json", fetchedAt, runner.finished_at_utc, { staleAfterMs: 20 * 60 * 1e3 });
  push(receipts, "rio.work.status", work.status, "github://vickykenin-lang/rio-affiliate-engine/data/rio_work_status.json", fetchedAt, work.updated_at || null, { staleAfterMs: 30 * 60 * 1e3 });
  push(receipts, "rio.work.blocker", work.blocker, "github://vickykenin-lang/rio-affiliate-engine/data/rio_work_status.json", fetchedAt, work.updated_at || null, { staleAfterMs: 30 * 60 * 1e3 });
  push(receipts, "rio.instagram.last_run_status", igRun.status, "github://vickykenin-lang/rio-affiliate-engine/data/instagram_run_status.json", fetchedAt, igRun.updated_at || null, { staleAfterMs: 24 * 60 * 60 * 1e3 });
  const controlMeta = {
    last_change_at: control.maintenance_pause_set_at || control.resumed_at || null,
    semantics: "CURRENT_CONFIGURATION_FROM_FRESH_GITHUB_READ"
  };
  push(receipts, "rio.instagram_auto_publish", control.instagram_auto_publish, "github://vickykenin-lang/rio-affiliate-engine/data/control.json", fetchedAt, fetchedAt, { staleAfterMs: 5 * 60 * 1e3, metadata: controlMeta });
  push(receipts, "rio.instagram_pause_reason", control.instagram_pause_reason, "github://vickykenin-lang/rio-affiliate-engine/data/control.json", fetchedAt, fetchedAt, { staleAfterMs: 5 * 60 * 1e3, metadata: controlMeta });
  push(receipts, "rio.kill_switch", control.kill_switch, "github://vickykenin-lang/rio-affiliate-engine/data/control.json", fetchedAt, fetchedAt, { staleAfterMs: 5 * 60 * 1e3, metadata: controlMeta });
  push(receipts, "rio.production_state", production.production_state, "github://vickykenin-lang/rio-affiliate-engine/data/production_control.json", fetchedAt, fetchedAt, {
    staleAfterMs: 5 * 60 * 1e3,
    metadata: { last_change_at: production.activated_at || null, semantics: "CURRENT_CONFIGURATION_FROM_FRESH_GITHUB_READ" }
  });
  if (rio.workflow_counts) {
    push(receipts, "rio.workflow.counts", rio.workflow_counts.counts, "github://vickykenin-lang/rio-affiliate-engine/actions/runs", fetchedAt, rio.workflow_counts.latest?.updated_at || rio.workflow_counts.latest?.created_at || null, {
      sourceClass: "WORKFLOW_JOB",
      staleAfterMs: 30 * 60 * 1e3,
      scope: rio.workflow_counts.scope,
      metadata: { note: rio.workflow_counts.note, fetched: rio.workflow_counts.rio_runs_fetched }
    });
    push(receipts, "rio.workflow.latest_conclusion", rio.workflow_counts.latest?.conclusion, "github://vickykenin-lang/rio-affiliate-engine/actions/runs", fetchedAt, rio.workflow_counts.latest?.updated_at || null, { sourceClass: "WORKFLOW_JOB", staleAfterMs: 30 * 60 * 1e3 });
  }
  for (const [target, repo] of [["rio", "rio-affiliate-engine"], ["aura3", "aura-3.0"], ["tony_stark", "tony-stark-engineering"]]) {
    const commit = evidence?.[target]?.latest_commit;
    if (!commit) continue;
    push(receipts, `${target}.latest_commit`, { sha: commit.sha, date: commit.date, message: commit.message, html_url: commit.html_url }, `github://vickykenin-lang/${repo}/commits/${commit.sha || "latest"}`, fetchedAt, commit.date, {
      sourceClass: "WORKFLOW_JOB",
      staleAfterMs: Number.POSITIVE_INFINITY,
      confidence: "HIGH"
    });
  }
  return receipts;
}
__name(buildFactReceipts, "buildFactReceipts");
function attachResolvedTruth(evidence = {}) {
  const receipts = buildFactReceipts(evidence);
  return {
    ...evidence,
    truth_receipts: receipts,
    resolved_truth: resolveTruthReceipts(receipts)
  };
}
__name(attachResolvedTruth, "attachResolvedTruth");

// brain/fact_runtime.mjs
var REPOS = {
  rio: "vickykenin-lang/rio-affiliate-engine",
  aura3: "vickykenin-lang/aura-3.0",
  tony_stark: "vickykenin-lang/tony-stark-engineering"
};
function classifyFactRequest(text3 = "") {
  const value = String(text3 || "").toLowerCase();
  const asksExact = /\b(exact|timestamp|time stamp|kitne|count|number|commit|activity date|last commit|heartbeat|cached|default response|template|real[- ]?time|sach batao|pause|paused|auto[- ]?publish|alerts?|log|ground truth|data\/|\.json)\b/i.test(value);
  const asksEvidence = /\b(evidence|proof|verify|verified|source|github|repo|repository|fresh|actual|concrete|specific)\b/i.test(value);
  const targets = [];
  if (/\brio\b|instagram|heartbeat|rio alerts?/i.test(value)) targets.push("rio");
  if (/\baura\s*3\b|\baura3\b|vickykenin-lang\/aura-3\.0/i.test(value)) targets.push("aura3");
  if (/\btony(?:\s+stark)?\b/i.test(value)) targets.push("tony_stark");
  return {
    matched: asksExact || asksEvidence,
    targets: [...new Set(targets)],
    asksHeartbeat: /heartbeat/i.test(value),
    asksPause: /(pause|paused|auto[- ]?publish|instagram.*(on|off|enabled|disabled))/i.test(value),
    asksCommit: /(last commit|commit date|activity date|github.*activity|repo.*activity)/i.test(value),
    asksCounts: /(kitne|count|number|how many|total).*(heartbeat|run|cycle|fail|complete)|(heartbeat|run|cycle).*(kitne|count|number|how many|total)/i.test(value),
    asksCachedTruth: /(cached|default response|template|real[- ]?time|sach batao)/i.test(value)
  };
}
__name(classifyFactRequest, "classifyFactRequest");
function ghHeaders(env) {
  const headers3 = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Dr-Victor-Fact-Runtime/1.0"
  };
  if (env?.GITHUB_ORCHESTRATION_TOKEN) headers3.Authorization = `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`;
  return headers3;
}
__name(ghHeaders, "ghHeaders");
async function ghJson(env, url) {
  const res = await fetch(url, { headers: ghHeaders(env), cache: "no-store" });
  if (!res.ok) throw new Error(`GITHUB_FACT_HTTP_${res.status}`);
  return res.json();
}
__name(ghJson, "ghJson");
async function repoJson(env, repo, path) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=main&t=${Date.now()}`;
  const res = await fetch(url, { headers: { ...ghHeaders(env), Accept: "application/vnd.github.raw+json" }, cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, path };
  try {
    return { ok: true, path, value: await res.json() };
  } catch {
    return { ok: false, status: 0, path };
  }
}
__name(repoJson, "repoJson");
async function latestCommit(env, repo) {
  const rows = await ghJson(env, `https://api.github.com/repos/${repo}/commits?per_page=1&t=${Date.now()}`);
  const c = Array.isArray(rows) ? rows[0] : null;
  return c ? {
    sha: c.sha,
    date: c.commit?.committer?.date || c.commit?.author?.date || null,
    message: c.commit?.message || null,
    html_url: c.html_url || null
  } : null;
}
__name(latestCommit, "latestCommit");
function dateWindowFromText(text3 = "") {
  const iso = [...String(text3).matchAll(/20\d{2}-\d{2}-\d{2}/g)].map((m) => m[0]);
  if (iso.length >= 2) return `${iso[0]}..${iso[1]}`;
  return null;
}
__name(dateWindowFromText, "dateWindowFromText");
async function rioWorkflowCounts(env, text3) {
  const created = dateWindowFromText(text3);
  const suffix = created ? `&created=${encodeURIComponent(created)}` : "";
  const payload = await ghJson(env, `https://api.github.com/repos/${REPOS.rio}/actions/runs?per_page=100${suffix}`);
  const runs = (payload.workflow_runs || []).filter((run) => run.name === "RIO");
  const counts = runs.reduce((acc, run) => {
    const key = run.conclusion || run.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    scope: created ? `created=${created}` : "latest 100 repository workflow runs (filtered to workflow name RIO)",
    rio_runs_fetched: runs.length,
    counts,
    latest: runs[0] ? {
      id: runs[0].id,
      created_at: runs[0].created_at,
      updated_at: runs[0].updated_at,
      conclusion: runs[0].conclusion,
      event: runs[0].event
    } : null,
    note: "These are RIO workflow-run conclusions. A workflow can fail because a non-heartbeat job failed, so this is not automatically identical to heartbeat-job failure count."
  };
}
__name(rioWorkflowCounts, "rioWorkflowCounts");
async function collectFactEvidence(env, text3, classification = classifyFactRequest(text3)) {
  const evidence = { fetched_at_utc: (/* @__PURE__ */ new Date()).toISOString(), targets: classification.targets, rio: null, aura3: null, tony_stark: null };
  if (classification.targets.includes("rio") || classification.asksHeartbeat || classification.asksPause) {
    const [runner, control, production, work, igRun] = await Promise.all([
      repoJson(env, REPOS.rio, "data/heartbeat_runner_status.json"),
      repoJson(env, REPOS.rio, "data/control.json"),
      repoJson(env, REPOS.rio, "data/production_control.json"),
      repoJson(env, REPOS.rio, "data/rio_work_status.json"),
      repoJson(env, REPOS.rio, "data/instagram_run_status.json")
    ]);
    evidence.rio = {
      heartbeat_runner_status: runner.ok ? runner.value : null,
      control: control.ok ? control.value : null,
      production_control: production.ok ? production.value : null,
      work_status: work.ok ? work.value : null,
      instagram_run_status: igRun.ok ? igRun.value : null,
      sources: [runner, control, production, work, igRun].map((x) => ({ path: x.path, ok: x.ok, status: x.status || 200 }))
    };
    if (classification.asksCounts) {
      try {
        evidence.rio.workflow_counts = await rioWorkflowCounts(env, text3);
      } catch (error) {
        evidence.rio.workflow_counts_error = String(error?.message || "unknown");
      }
    }
    if (classification.asksCommit) {
      try {
        evidence.rio.latest_commit = await latestCommit(env, REPOS.rio);
      } catch (_) {
      }
    }
  }
  if (classification.targets.includes("aura3") || classification.asksCommit && /aura/i.test(text3)) {
    try {
      evidence.aura3 = { latest_commit: await latestCommit(env, REPOS.aura3) };
    } catch (error) {
      evidence.aura3 = { error: String(error?.message || "unknown") };
    }
  }
  if (classification.targets.includes("tony_stark") || classification.asksCommit && /tony/i.test(text3)) {
    try {
      evidence.tony_stark = { latest_commit: await latestCommit(env, REPOS.tony_stark) };
    } catch (error) {
      evidence.tony_stark = { error: String(error?.message || "unknown") };
    }
  }
  return attachResolvedTruth(evidence);
}
__name(collectFactEvidence, "collectFactEvidence");
function buildFactAnswerPrompt(founderText, evidence) {
  return [
    "You are Victor answering the Founder from the verified evidence provided below. GitHub is canonical when it contains an explicit fact; Cognee long-term memory may supply a noncanonical remembered fact when GitHub is silent. Absence from a registry, file, or department list is not a conflict with a remembered fact unless the canonical source explicitly states a contradictory value or rule.",
    "Answer every part of the Founder question. Do not ignore a second department or second sub-question.",
    "Give exact numbers/timestamps/commit dates when present. If a requested number is not supported by the fetched scope, say exactly what was counted and what remains unknown.",
    "Use resolved_truth as the authoritative reconciliation output. If it reports a conflict, explain which receipt won and why using truth precedence/freshness. If status is RESOLVED_STALE_ONLY, label the fact stale instead of presenting it as current.",
    "Never invent or mentally recalculate freshness ages or thresholds. If you mention staleness math, copy age_ms and stale_after_ms exactly from the selected receipt; otherwise simply say stale/current per the receipt. Do not write approximate ages that are not explicitly supported.",
    "For freshly fetched configuration receipts whose metadata.semantics is CURRENT_CONFIGURATION_FROM_FRESH_GITHUB_READ, report the configured value as current at fetched_at_utc; last_change_at is historical metadata, not proof that the current value is stale.",
    "Do not replace facts with reassurance, status templates, or phrases like \u201Ctrace kar raha hoon\u201D.",
    "If current canonical data conflicts with an older alert/message, explicitly distinguish OLD ALERT from CURRENT STATE and cite the current field/value in plain language.",
    "For heartbeat counts, preserve the runtime note: workflow-run conclusion is not necessarily identical to heartbeat-job conclusion.",
    "If asked whether the reply is cached/default/template, say this answer used fresh GitHub reads at fetched_at_utc. Do not claim real-time beyond those reads.",
    "Use natural concise Hinglish. No markdown table. Internal source paths may be named because the Founder explicitly asked for evidence.",
    `Founder question: ${String(founderText || "").trim()}`,
    `Fresh evidence JSON: ${JSON.stringify(evidence)}`
  ].join("\n\n");
}
__name(buildFactAnswerPrompt, "buildFactAnswerPrompt");

// brain/founder_request.mjs
var ENTITY_PATTERNS = [
  ["rio", /\brio\b|instagram|heartbeat|rio alerts?/i],
  ["aura3", /\baura\s*3\b|\baura3\b|aura-3\.0/i],
  ["tony_stark", /\btony(?:\s+stark)?\b/i],
  ["hulk", /\bhulk\b/i]
];
var FACT_PATTERNS = [
  ["timestamp", /timestamp|time stamp|exact time|last successful/i],
  ["count", /\bcount\b|\bnumber\b|\btotal\b|kitne|how many/i],
  ["commit_activity", /last commit|commit date|activity date|repo.*activity|github.*activity/i],
  ["pause_state", /pause|paused|auto[- ]?publish|enabled|disabled/i],
  ["heartbeat", /heartbeat/i],
  ["publish_state", /instagram|publish|posted|permalink|media id/i],
  ["source_value", /data\/|\.json|exact value|field value/i],
  ["evidence", /evidence|proof|verify|verified|source|ground truth|fresh|actual|concrete|specific/i]
];
var ACTION_PATTERNS = [
  ["diagnose", /diagnos|root cause|kyu|why|kaha atka|blocker|issue/i],
  ["repair", /fix|repair|recover|thik|correct/i],
  ["execute", /execute|run|start|continue|resume|karvao|karo/i],
  ["publish", /publish|post kar|live kar/i],
  ["verify", /verify|check|confirm|evidence|proof/i]
];
function unique5(values) {
  return [...new Set(values.filter(Boolean))];
}
__name(unique5, "unique");
function splitQuestions(text3 = "") {
  const value = String(text3 || "").trim();
  if (!value) return [];
  const explicit = value.split(/\?+/).map((x) => x.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;
  return value.split(/\s+(?:and|aur|or saath me|saath me|plus)\s+/i).map((x) => x.trim()).filter(Boolean);
}
__name(splitQuestions, "splitQuestions");
function buildFounderRequest(text3 = "", activeThread = null) {
  const value = String(text3 || "").trim();
  const entities = unique5(ENTITY_PATTERNS.filter(([, rx]) => rx.test(value)).map(([name]) => name));
  const requestedFacts = unique5(FACT_PATTERNS.filter(([, rx]) => rx.test(value)).map(([name]) => name));
  const requestedActions = unique5(ACTION_PATTERNS.filter(([, rx]) => rx.test(value)).map(([name]) => name));
  const questions = splitQuestions(value);
  const explicitTopic = entities.length ? entities[0] : null;
  const activeTopic = explicitTopic || activeThread?.topic || activeThread?.active_department || null;
  const asksObjectiveChange = /change.*objective|objective.*change|goal.*change|scope.*change/i.test(value);
  const asksPause = /\b(stop|pause|park)\b/i.test(value);
  const evidenceRequired = requestedFacts.length > 0 || /sach batao|real[- ]?time|cached|default response|template/i.test(value);
  return {
    version: "FOUNDER_REQUEST_V1",
    raw_text: value,
    intent: requestedActions.length ? "ACTION_OR_DIAGNOSIS" : evidenceRequired ? "FACT_QUERY" : "CONVERSATION",
    topic: activeTopic,
    entities,
    questions,
    requested_facts: requestedFacts,
    requested_actions: requestedActions,
    active_thread: activeThread || null,
    evidence_required: evidenceRequired,
    success_condition: requestedActions.includes("publish") ? "EXTERNALLY_VERIFIED_PUBLISH" : evidenceRequired ? "EVERY_REQUESTED_FACT_ANSWERED_OR_EXPLICITLY_UNAVAILABLE" : "FOUNDER_INTENT_SATISFIED",
    execution_owner: entities.length === 1 ? entities[0] : entities.length > 1 ? "victor_cross_department" : "victor",
    founder_boundary: asksObjectiveChange || asksPause ? "EXPLICIT_FOUNDER_DIRECTION" : null
  };
}
__name(buildFounderRequest, "buildFounderRequest");
var TRUTH_SOURCE_PRECEDENCE2 = Object.freeze([
  "EXTERNAL_PLATFORM_RESULT",
  "CURRENT_WORKFLOW_OR_JOB_EVIDENCE",
  "FRESH_DEPARTMENT_RESULT_ENVELOPE",
  "CURRENT_CANONICAL_STATE",
  "HISTORICAL_LOG_OR_ALERT",
  "DURABLE_MEMORY",
  "ACTIVE_CONVERSATION_CONTEXT"
]);

// brain/execution_plan.mjs
var SUPPORTED = /* @__PURE__ */ new Set(["rio", "tony_stark", "aura3"]);
function unique6(values = []) {
  return [...new Set(values.filter(Boolean))];
}
__name(unique6, "unique");
function buildExecutionPlan(founderRequest = {}) {
  const entities = unique6(founderRequest?.entities || []);
  const actions = unique6(founderRequest?.requested_actions || []);
  const actionableTargets = entities.filter((x) => SUPPORTED.has(x));
  const unsupportedTargets = entities.filter((x) => !SUPPORTED.has(x));
  const requiresAction = actions.length > 0;
  const crossDepartment = requiresAction && actionableTargets.length > 1;
  return {
    version: "VICTOR_EXECUTION_PLAN_V1",
    mode: crossDepartment ? "CROSS_DEPARTMENT_ACTION" : requiresAction && actionableTargets.length === 1 ? "SINGLE_DEPARTMENT_ACTION" : "NO_DETERMINISTIC_ACTION",
    requested_outcome: founderRequest?.success_condition || "FOUNDER_INTENT_SATISFIED",
    cross_department: crossDepartment,
    actions,
    steps: actionableTargets.map((target, index) => ({
      step_id: `step-${index + 1}`,
      target,
      requested_actions: actions,
      founder_text: founderRequest?.raw_text || "",
      status: "PLANNED",
      verification_required: true
    })),
    unsupported_targets: unsupportedTargets,
    founder_boundary: founderRequest?.founder_boundary || null
  };
}
__name(buildExecutionPlan, "buildExecutionPlan");
function shouldExecuteCrossDepartment(plan = {}) {
  return plan?.mode === "CROSS_DEPARTMENT_ACTION" && Array.isArray(plan?.steps) && plan.steps.length > 1 && !plan?.founder_boundary;
}
__name(shouldExecuteCrossDepartment, "shouldExecuteCrossDepartment");

// brain/request_gateway.mjs
function unique7(values = []) {
  return [...new Set(values.filter(Boolean))];
}
__name(unique7, "unique");
function buildRuntimeFounderRequest(text3 = "", session = {}) {
  const activeThread = {
    topic: session?.active_topic || session?.last_target || null,
    active_department: session?.last_target || null,
    task_id: session?.last_task_id || null,
    parent_task_id: session?.parent_task_id || null,
    unresolved_question: session?.unresolved_question || null
  };
  const baseRequest = buildFounderRequest(text3, activeThread);
  const explicitEntities = Array.isArray(baseRequest.entities) ? baseRequest.entities : [];
  const priorTarget = session?.last_target || null;
  const explicitPrimary = explicitEntities[0] || null;
  const topicSwitched = Boolean(explicitPrimary && priorTarget && explicitPrimary !== priorTarget);
  const request = {
    ...baseRequest,
    runtime: {
      explicit_primary_target: explicitPrimary,
      prior_target: priorTarget,
      topic_switched: topicSwitched,
      clear_stale_task_lineage: topicSwitched
    }
  };
  return {
    ...request,
    execution_plan: buildExecutionPlan(request)
  };
}
__name(buildRuntimeFounderRequest, "buildRuntimeFounderRequest");
function buildSessionPatchForRequest(request = {}) {
  const explicitPrimary = request?.runtime?.explicit_primary_target || null;
  const patch = {
    active_topic: request?.topic || explicitPrimary || null,
    last_founder_request: {
      version: request?.version || "FOUNDER_REQUEST_V1",
      intent: request?.intent || "CONVERSATION",
      topic: request?.topic || null,
      entities: unique7(request?.entities || []),
      questions: request?.questions || [],
      requested_facts: unique7(request?.requested_facts || []),
      requested_actions: unique7(request?.requested_actions || []),
      evidence_required: request?.evidence_required === true,
      success_condition: request?.success_condition || null,
      execution_plan: request?.execution_plan || null
    }
  };
  if (request?.runtime?.clear_stale_task_lineage) {
    Object.assign(patch, {
      last_target: explicitPrimary,
      last_task_id: null,
      parent_task_id: null,
      last_task_type: null,
      task_state: "TOPIC_SWITCHED_NO_ACTIVE_TASK",
      unresolved_question: null,
      active_issue: null
    });
  }
  return patch;
}
__name(buildSessionPatchForRequest, "buildSessionPatchForRequest");
function buildFactRequestFromFounderRequest(request = {}, rawText = "") {
  const legacy = classifyFactRequest(rawText);
  const structuredFacts = new Set(request?.requested_facts || []);
  const structuredTargets = request?.entities || [];
  const evidenceRequired = request?.evidence_required === true || structuredFacts.size > 0;
  return {
    ...legacy,
    matched: evidenceRequired || legacy.matched,
    targets: unique7([...structuredTargets.filter((x) => ["rio", "aura3", "tony_stark"].includes(x)), ...legacy.targets || []]),
    asksHeartbeat: structuredFacts.has("heartbeat") || legacy.asksHeartbeat,
    asksPause: structuredFacts.has("pause_state") || legacy.asksPause,
    asksCommit: structuredFacts.has("commit_activity") || legacy.asksCommit,
    asksCounts: structuredFacts.has("count") || legacy.asksCounts,
    asksCachedTruth: legacy.asksCachedTruth || /cached|default response|template|real[- ]?time|sach batao/i.test(String(rawText || "")),
    questions: request?.questions || [],
    success_condition: request?.success_condition || null
  };
}
__name(buildFactRequestFromFounderRequest, "buildFactRequestFromFounderRequest");
function shouldUseFactGateway(request = {}, factRequest = {}) {
  return request?.evidence_required === true || (request?.requested_facts || []).length > 0 || factRequest?.matched === true;
}
__name(shouldUseFactGateway, "shouldUseFactGateway");
function isExplicitExecutiveGoalCommand(text3 = "") {
  const normalized = String(text3 || "").trim();
  const namesOrganizationGoal = /\bORG-[A-Z0-9-]+\b/i.test(normalized);
  const requestsExecution = /\b(execute|run|start|resume|continue|chalao|chala do|shuru karo|aage badhao)\b/i.test(normalized);
  return namesOrganizationGoal && requestsExecution;
}
__name(isExplicitExecutiveGoalCommand, "isExplicitExecutiveGoalCommand");

// brain/hulk_guard.mjs
function normalizeHulkText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}
__name(normalizeHulkText, "normalizeHulkText");
function classifyHulkRequest(text3) {
  const value = normalizeHulkText(text3);
  if (!/\bhulk\b/i.test(value)) return { matched: false, mode: null };
  const action = /(push|run|start|execute|kaam karvao|result ready|research karvao|chalao|karo|karvao)/i.test(value);
  const status = /(kya research|abhi tak|status|kya kiya|kya hua|result|research kiya)/i.test(value);
  if (action) return { matched: true, mode: "HULK_ACTION", target: "hulk" };
  if (status) return { matched: true, mode: "HULK_STATUS", target: "hulk" };
  return { matched: true, mode: "HULK_REFERENCE", target: "hulk" };
}
__name(classifyHulkRequest, "classifyHulkRequest");
function hulkStatusReply() {
  return "HULK registered aur research mandate enabled hai, lekin Victor\u2194HULK connection abhi NOT_VERIFIED hai. Isliye main \u201CHULK ne kuch research nahi kiya\u201D jaisa absolute claim nahi karunga; fresh verified research evidence Victor ke paas available nahi hai. Seed task HULK-RND-001 registered hai.";
}
__name(hulkStatusReply, "hulkStatusReply");
function hulkActionBlockedReply() {
  return "Aap HULK ki baat kar rahe hain. Main is request ko RIO ko route nahi karunga. Abhi Victor\u2194HULK execution bridge NOT_VERIFIED hai, isliye HULK ko real task dispatch/success claim nahi kar sakta. Pehle HULK bridge ko connect/verify karna hoga; tab isi HULK request ko execute karenge.";
}
__name(hulkActionBlockedReply, "hulkActionBlockedReply");
function isCasualWellbeing(text3) {
  const value = normalizeHulkText(text3).replace(/[!?.,]+/g, "");
  return /^(kya haal hai|kaise ho|how are you|whats up|what's up|sab thik|sab theek)$/i.test(value);
}
__name(isCasualWellbeing, "isCasualWellbeing");
function casualWellbeingReply() {
  return "Main theek hoon. Batao, ab kis cheez par kaam karna hai?";
}
__name(casualWellbeingReply, "casualWellbeingReply");

// brain/founder_intent_gateway.mjs
var FOUNDER_INTENT = Object.freeze({
  CHAT: "CHAT",
  QUESTION: "QUESTION",
  STATUS_QUERY: "STATUS_QUERY",
  EXECUTION_COMMAND: "EXECUTION_COMMAND",
  STOP_PAUSE: "STOP_PAUSE",
  FOUNDER_DECISION: "FOUNDER_DECISION",
  SYSTEM_TEST: "SYSTEM_TEST"
});
function normalizeFounderText2(value) {
  return String(value || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9\u0900-\u097f\s?'_-]/gi, " ").replace(/\s+/g, " ").trim();
}
__name(normalizeFounderText2, "normalizeFounderText");
function targetFromText(text3 = "") {
  if (/\brio\b/i.test(text3)) return "rio";
  if (/\btony(?:_stark)?\b/i.test(text3)) return "tony_stark";
  if (/\baura3\b/i.test(text3)) return "aura3";
  if (/\bvictor\b/i.test(text3)) return "victor";
  return null;
}
__name(targetFromText, "targetFromText");
function classifyFounderIntent(text3, context = {}) {
  const value = normalizeFounderText2(text3);
  const target = targetFromText(value) || context?.active_target || null;
  const stop = /(?:^|\s)(?:stop|pause|hold|band\s+karo|band\s+kar|close\s+karo|close\s+kar|rok\s+do|roko|kaam\s+band)(?:\s|$)/i.test(value) || /(?:rio|tony(?:_stark)?|aura3|victor).{0,30}(?:stop|pause|hold|band\s+karo|band\s+kar|close\s+karo|rok\s+do|roko)/i.test(value) || /(?:stop|pause|hold|band\s+karo|close\s+karo|rok\s+do).{0,30}(?:rio|tony(?:_stark)?|aura3|victor)/i.test(value);
  if (stop) {
    return {
      intent: FOUNDER_INTENT.STOP_PAUSE,
      target,
      execution_allowed: false,
      requires_deterministic_stop: true,
      reason: "FOUNDER_STOP_PAUSE_PRECEDENCE"
    };
  }
  const systemTest = /\b(i want to test you|test you|test victor|system test|llm.*test|test.*llm|kaise test karoge|kese test karoge|test kaise|test kese)\b/i.test(value);
  if (systemTest) {
    return {
      intent: FOUNDER_INTENT.SYSTEM_TEST,
      target: target === "rio" ? null : target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: "SYSTEM_TEST_IS_NOT_DEPARTMENT_EXECUTION"
    };
  }
  const statusQuery = /\b(status|kya hua|kaha atka|kahaan atka|pending|progress|latest state|current state)\b/i.test(value);
  if (statusQuery && /[?]|\b(kya|what|where|kab|when|status)\b/i.test(value)) {
    return {
      intent: FOUNDER_INTENT.STATUS_QUERY,
      target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: "STATUS_QUERY_NO_IMPLICIT_DISPATCH"
    };
  }
  const explicitExecution = /\b(execute|start|run|deploy|implement|apply|create|build|fix|update|merge|release|continue work|resume work|kaam chalu|kaam shuru|shuru karo|start karo|execute karo|deploy karo|implement karo|fix karo|update karo|merge karo)\b/i.test(value);
  if (explicitExecution) {
    return {
      intent: FOUNDER_INTENT.EXECUTION_COMMAND,
      target,
      execution_allowed: true,
      requires_deterministic_stop: false,
      reason: "EXPLICIT_EXECUTION_VERB"
    };
  }
  const founderDecision = /\b(approve|approved|lock this|yes lock|plan lock|authorize|authorise|reject|denied|do not approve)\b/i.test(value);
  if (founderDecision) {
    return {
      intent: FOUNDER_INTENT.FOUNDER_DECISION,
      target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: "FOUNDER_GOVERNANCE_DECISION"
    };
  }
  const question = /[?]$|^(?:what|why|how|when|where|who|which|can|could|should|is|are|do|does|did|kya|kyu|kyun|kaise|kese|kab|kaha|kahaan)\b/i.test(value) || /\b(llm|model|connection|connected|joke).*(?:kya|kaise|kese|how|where|kaha|kahaan)/i.test(value);
  if (question) {
    return {
      intent: FOUNDER_INTENT.QUESTION,
      target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: "QUESTION_NO_IMPLICIT_DISPATCH"
    };
  }
  return {
    intent: FOUNDER_INTENT.CHAT,
    target,
    execution_allowed: false,
    requires_deterministic_stop: false,
    reason: "DEFAULT_CONVERSATIONAL_FAIL_CLOSED"
  };
}
__name(classifyFounderIntent, "classifyFounderIntent");

// brain/security_kernel.mjs
var SECURITY_POLICY_VERSION = "victor-security-policy-v1";
var SECURITY_ZONE = Object.freeze({
  GREEN: "GREEN",
  AMBER: "AMBER",
  RED: "RED"
});
var CAPABILITIES = Object.freeze({
  "repo.read": { zone: SECURITY_ZONE.GREEN, founder_gate: false, reversible: true },
  "evidence.read": { zone: SECURITY_ZONE.GREEN, founder_gate: false, reversible: true },
  "sandbox.execute": { zone: SECURITY_ZONE.GREEN, founder_gate: false, reversible: true },
  "repo.branch.write": { zone: SECURITY_ZONE.AMBER, founder_gate: false, reversible: true },
  "repo.pr.write": { zone: SECURITY_ZONE.AMBER, founder_gate: false, reversible: true },
  "production.reversible_change": { zone: SECURITY_ZONE.AMBER, founder_gate: false, reversible: true },
  "credential.rotate": { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  "security.policy.change": { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  "authority.expand": { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  "production.destructive_change": { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  "pause.override": { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false }
});
function getSecurityCapability(capabilityId) {
  const rule = CAPABILITIES[String(capabilityId || "")];
  return rule ? { capability_id: capabilityId, ...rule } : null;
}
__name(getSecurityCapability, "getSecurityCapability");
function leaseIsActive(lease, nowMs2 = Date.now()) {
  if (!lease || lease.status !== "ACTIVE") return false;
  if (!lease.expires_at_utc) return false;
  const expires = Date.parse(lease.expires_at_utc);
  return Number.isFinite(expires) && expires > nowMs2;
}
__name(leaseIsActive, "leaseIsActive");
function evaluateSecurityRequest({
  actor = "victor",
  capability_id,
  founder_approved = false,
  action_contract_authorized = false,
  lease = null,
  policy_version = SECURITY_POLICY_VERSION,
  emergency_pause = false,
  now_ms = Date.now()
} = {}) {
  const capability = getSecurityCapability(capability_id);
  if (emergency_pause === true && capability_id !== "evidence.read") {
    return { decision: "DENY", reason: "EMERGENCY_PAUSE_ACTIVE", policy_version };
  }
  if (policy_version !== SECURITY_POLICY_VERSION) {
    return { decision: "DENY", reason: "UNSUPPORTED_SECURITY_POLICY_VERSION", policy_version };
  }
  if (!capability) {
    return { decision: "DENY", reason: "CAPABILITY_NOT_REGISTERED", policy_version };
  }
  if (String(actor || "").toLowerCase() === "victor" && capability_id === "authority.expand") {
    return { decision: "DENY", reason: "SELF_AUTHORITY_GRANT_PROHIBITED", policy_version, zone: capability.zone };
  }
  if (capability.founder_gate === true && founder_approved !== true) {
    return { decision: "DENY", reason: "FOUNDER_APPROVAL_REQUIRED", policy_version, zone: capability.zone };
  }
  if (capability.zone === SECURITY_ZONE.GREEN) {
    return { decision: "ALLOW", reason: "GREEN_CAPABILITY", policy_version, zone: capability.zone };
  }
  if (capability.zone === SECURITY_ZONE.AMBER) {
    if (action_contract_authorized !== true) {
      return { decision: "DENY", reason: "ACTION_CONTRACT_REQUIRED", policy_version, zone: capability.zone };
    }
    if (!leaseIsActive(lease, now_ms)) {
      return { decision: "DENY", reason: "ACTIVE_EXECUTION_LEASE_REQUIRED", policy_version, zone: capability.zone };
    }
    return { decision: "ALLOW", reason: "AMBER_GOVERNED_REVERSIBLE", policy_version, zone: capability.zone };
  }
  if (capability.zone === SECURITY_ZONE.RED) {
    if (founder_approved !== true) {
      return { decision: "DENY", reason: "FOUNDER_APPROVAL_REQUIRED", policy_version, zone: capability.zone };
    }
    if (capability_id === "authority.expand" && String(actor || "").toLowerCase() === "victor") {
      return { decision: "DENY", reason: "SELF_AUTHORITY_GRANT_PROHIBITED", policy_version, zone: capability.zone };
    }
    return { decision: "ALLOW", reason: "FOUNDER_GATED_RED_CAPABILITY", policy_version, zone: capability.zone };
  }
  return { decision: "DENY", reason: "FAIL_CLOSED", policy_version };
}
__name(evaluateSecurityRequest, "evaluateSecurityRequest");

// brain/sandbox_manager.mjs
var SANDBOX_PROFILE_VERSION = "victor-sandbox-v1";
function secureOpaqueId(prefix, length) {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== "function") throw new Error("SECURE_RANDOM_UUID_UNAVAILABLE");
  return `${prefix}${randomUUID.call(globalThis.crypto).replace(/-/g, "").slice(0, length)}`;
}
__name(secureOpaqueId, "secureOpaqueId");
function createSandboxSpec({ objective_id, action_id, requested_tools = [], network_allowlist = [], budgets = {} } = {}) {
  if (!objective_id || !action_id) throw new Error("objective_id and action_id are required");
  const sandbox_id = secureOpaqueId("sbx_", 16);
  const normalizedTools = [...new Set(requested_tools.map(String))].filter(Boolean);
  const normalizedNetwork = [...new Set(network_allowlist.map(String))].filter(Boolean);
  return {
    schema_version: 1,
    profile_version: SANDBOX_PROFILE_VERSION,
    sandbox_id,
    objective_id,
    action_id,
    lifecycle: "DISPOSABLE",
    filesystem: { mode: "ISOLATED_EPHEMERAL", persist_after_teardown: false },
    git: { protected_branch_write: false, isolated_branch_only: true },
    credentials: { master_credentials_available: false, production_credentials_available: false, secret_handles_only: true },
    network: { default: "DENY", allowlist: normalizedNetwork },
    tools: normalizedTools,
    budgets: {
      runtime_seconds: Math.max(1, Math.min(Number(budgets.runtime_seconds || 900), 3600)),
      retry_count: Math.max(0, Math.min(Number(budgets.retry_count ?? 3), 10)),
      external_calls: Math.max(0, Math.min(Number(budgets.external_calls ?? 25), 200)),
      storage_mb: Math.max(16, Math.min(Number(budgets.storage_mb || 512), 4096)),
      spend_units: Math.max(0, Math.min(Number(budgets.spend_units || 0), 1e3))
    },
    evidence_export_required: true,
    teardown_required: true
  };
}
__name(createSandboxSpec, "createSandboxSpec");
function validateSandboxSpec(spec = {}) {
  if (spec?.profile_version !== SANDBOX_PROFILE_VERSION) return { valid: false, reason: "UNSUPPORTED_SANDBOX_PROFILE" };
  if (spec?.credentials?.master_credentials_available !== false) return { valid: false, reason: "MASTER_CREDENTIAL_EXPOSURE_PROHIBITED" };
  if (spec?.credentials?.production_credentials_available !== false) return { valid: false, reason: "PRODUCTION_CREDENTIAL_EXPOSURE_PROHIBITED" };
  if (spec?.network?.default !== "DENY") return { valid: false, reason: "NETWORK_DEFAULT_DENY_REQUIRED" };
  if (spec?.git?.protected_branch_write !== false) return { valid: false, reason: "PROTECTED_BRANCH_WRITE_PROHIBITED" };
  if (spec?.git?.isolated_branch_only !== true) return { valid: false, reason: "ISOLATED_BRANCH_REQUIRED" };
  if (spec?.lifecycle !== "DISPOSABLE" || spec?.teardown_required !== true) return { valid: false, reason: "DISPOSABLE_TEARDOWN_REQUIRED" };
  if (spec?.evidence_export_required !== true) return { valid: false, reason: "EVIDENCE_EXPORT_REQUIRED" };
  return { valid: true, reason: "SANDBOX_SPEC_VALID" };
}
__name(validateSandboxSpec, "validateSandboxSpec");

// brain/capability_broker.mjs
var BROKER_VERSION = "victor-capability-broker-v1";
function makeHandle() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== "function") throw new Error("SECURE_RANDOM_UUID_UNAVAILABLE");
  return `cap_${randomUUID.call(globalThis.crypto).replace(/-/g, "").slice(0, 24)}`;
}
__name(makeHandle, "makeHandle");
function issueCapabilityLease({
  actor = "victor",
  capability_id,
  objective_id,
  action_id,
  action_contract_authorized = false,
  founder_approved = false,
  ttl_seconds = 300,
  emergency_pause = false,
  now_utc = (/* @__PURE__ */ new Date()).toISOString()
} = {}) {
  if (!objective_id || !action_id) return { issued: false, reason: "OBJECTIVE_AND_ACTION_REQUIRED" };
  const ttl = Math.max(1, Math.min(Number(ttl_seconds || 300), 900));
  const nowMs2 = Date.parse(now_utc);
  if (!Number.isFinite(nowMs2)) return { issued: false, reason: "INVALID_NOW" };
  const expires = new Date(nowMs2 + ttl * 1e3).toISOString();
  const security = evaluateSecurityRequest({
    actor,
    capability_id,
    founder_approved,
    action_contract_authorized,
    lease: { status: "ACTIVE", expires_at_utc: expires },
    policy_version: SECURITY_POLICY_VERSION,
    emergency_pause,
    now_ms: nowMs2
  });
  if (security.decision !== "ALLOW") return { issued: false, reason: security.reason, security };
  return {
    issued: true,
    broker_version: BROKER_VERSION,
    handle: makeHandle(),
    capability_id,
    objective_id,
    action_id,
    status: "ACTIVE",
    issued_at_utc: now_utc,
    expires_at_utc: expires,
    secret_material_exposed: false,
    transferable: false,
    policy_version: SECURITY_POLICY_VERSION,
    zone: security.zone
  };
}
__name(issueCapabilityLease, "issueCapabilityLease");
function validateCapabilityLease(lease = {}, { objective_id, action_id, capability_id, now_utc = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!lease?.issued || lease.status !== "ACTIVE") return { valid: false, reason: "LEASE_NOT_ACTIVE" };
  if (lease.secret_material_exposed !== false) return { valid: false, reason: "SECRET_EXPOSURE_PROHIBITED" };
  if (lease.transferable !== false) return { valid: false, reason: "TRANSFERABLE_LEASE_PROHIBITED" };
  if (objective_id && lease.objective_id !== objective_id) return { valid: false, reason: "OBJECTIVE_SCOPE_MISMATCH" };
  if (action_id && lease.action_id !== action_id) return { valid: false, reason: "ACTION_SCOPE_MISMATCH" };
  if (capability_id && lease.capability_id !== capability_id) return { valid: false, reason: "CAPABILITY_SCOPE_MISMATCH" };
  const nowMs2 = Date.parse(now_utc);
  const expiryMs = Date.parse(lease.expires_at_utc || "");
  if (!Number.isFinite(nowMs2) || !Number.isFinite(expiryMs) || expiryMs <= nowMs2) return { valid: false, reason: "LEASE_EXPIRED" };
  return { valid: true, reason: "LEASE_VALID" };
}
__name(validateCapabilityLease, "validateCapabilityLease");

// brain/safety_watchdog.mjs
var WATCHDOG_VERSION = "victor-watchdog-v1";
function evaluateWatchdog({
  heartbeat_age_seconds = 0,
  semantic_no_progress_count = 0,
  transient_retry_count = 0,
  unexpected_external_side_effect = false,
  verification_failed_after_change = false,
  authority_ambiguity = false,
  credential_or_security_anomaly = false,
  material_environment_mismatch = false,
  budget_result = null,
  limits = {}
} = {}) {
  const maxHeartbeat = Number(limits.max_heartbeat_age_seconds ?? 180);
  const maxNoProgress = Number(limits.max_semantic_no_progress ?? 2);
  const maxTransient = Number(limits.max_transient_retries ?? 2);
  const triggers = [];
  if (Number(heartbeat_age_seconds) > maxHeartbeat) triggers.push("WATCHDOG_HEARTBEAT_STALE");
  if (Number(semantic_no_progress_count) > maxNoProgress) triggers.push("SEMANTIC_NO_PROGRESS_LIMIT");
  if (Number(transient_retry_count) > maxTransient) triggers.push("TRANSIENT_RETRY_LIMIT");
  if (unexpected_external_side_effect) triggers.push("UNEXPECTED_EXTERNAL_SIDE_EFFECT");
  if (verification_failed_after_change) triggers.push("POST_CHANGE_VERIFICATION_FAILED");
  if (authority_ambiguity) triggers.push("AUTHORITY_AMBIGUITY");
  if (credential_or_security_anomaly) triggers.push("CREDENTIAL_SECURITY_ANOMALY");
  if (material_environment_mismatch) triggers.push("ENVIRONMENT_MISMATCH");
  if (budget_result?.safe_hold === true || budget_result?.allowed === false) triggers.push("RESOURCE_BUDGET_BLOCK");
  return triggers.length ? {
    watchdog_version: WATCHDOG_VERSION,
    decision: "SAFE_HOLD",
    allow_new_execution: false,
    allow_evidence_collection: true,
    allow_sandbox_diagnosis: true,
    triggers
  } : {
    watchdog_version: WATCHDOG_VERSION,
    decision: "CONTINUE_BOUNDED",
    allow_new_execution: true,
    allow_evidence_collection: true,
    allow_sandbox_diagnosis: true,
    triggers: []
  };
}
__name(evaluateWatchdog, "evaluateWatchdog");

// brain/rollback_contract.mjs
var ROLLBACK_CONTRACT_VERSION = "victor-rollback-v1";

// brain/promotion_gate.mjs
var PROMOTION_GATE_VERSION = "victor-promotion-gate-v1";

// victor-telegram-worker/worker.js
var TELEGRAM_API2 = "https://api.telegram.org";
var RAW_BASE2 = "https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main";
var CORE_SOURCES = [
  ["ARCHITECTURE_LOCK", "docs/VICTOR_ARCHITECTURE_LOCK_INDEX.md", true],
  ["MASTER_RULE_BOOK", "VICTOR_MASTER_RULE_BOOK.md", true],
  ["SOUL", "VICTOR_SOUL.md", true],
  ["EXECUTIVE_CHARTER", "VICTOR_EXECUTIVE_CHARTER.md", true],
  ["BUSINESS_PLAN", "BUSINESS_PLAN.md", false],
  ["SYSTEM_STATE", "data/system_state.json", false],
  ["DEPARTMENT_REGISTRY", "data/department_registry.json", false],
  ["REPORT_CARD_POLICY", "data/victor_report_card_policy.json", false],
  ["RUNTIME_OWNERSHIP", "data/runtime_ownership.json", false],
  ["REVENUE_OUTCOMES", "data/revenue_outcomes.json", false],
  ["AI_RUNTIME_STATUS", "data/ai_runtime_status.json", false],
  ["TELEGRAM_RUNTIME_STATUS", "data/telegram_runtime_status.json", false],
  ["FOUNDER_MEMORY", "memory/founder_memory.json", false],
  ["DECISIONS", "memory/decisions.jsonl", false],
  ["LONG_TERM_MEMORY", "memory/MEMORY.md", false],
  ["ACTIVE_PROJECTS_MEMORY", "memory/ACTIVE_PROJECTS.md", false],
  ["WORKING_MEMORY", "memory/WORKING_MEMORY.md", false],
  ["LEARNINGS_MEMORY", "memory/LEARNINGS.md", false],
  ["OPERATIONAL_MEMORY", "memory/operational_memory.jsonl", false],
  ["ACTIVITY_MEMORY", "memory/ACTIVITY_LOG.md", false],
  ["MEMORY_INDEX_MD", "memory/INDEX.md", false],
  ["MEMORY_INDEX", "memory/memory_index.json", false]
];
var worker_default = {
  async scheduled(controller, env, ctx) {
    console.log(JSON.stringify({
      event: "VICTOR_SCHEDULED_TRIGGER_DISABLED",
      cron: controller.cron,
      status: "SAFE_STOP",
      error_code: "MANUAL_TRIGGER_REQUIRED",
      secrets_exposed: false
    }));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        service: "victor-telegram-webhook",
        deployment_git_sha: env.VICTOR_DEPLOY_GIT_SHA || null,
        deployment_build_uuid: env.VICTOR_BUILD_UUID || null,
        cloudflare_version_id: env.CF_VERSION_METADATA?.id || null,
        deployment_identity_gate: env.VICTOR_DEPLOY_GIT_SHA && (env.VICTOR_BUILD_UUID || env.CF_VERSION_METADATA?.id) ? "IDENTITY_PRESENT_NOT_LIVE_VERIFIED" : "IDENTITY_INCOMPLETE",
        deployment_identity_evidence_required: ["deployment_git_sha", "deployment_build_uuid_or_cloudflare_version_id", "fresh_health_receipt"],
        status: "READY",
        core_mode: "GOVERNED_CANONICAL_CONTEXT",
        precedence_mode: PRECEDENCE_VERSION,
        truth_guard: "DETERMINISTIC_V3",
        telegram_diagnostics: "ACTIONABLE_V4_GROUP_STATUS_FIX",
        operating_mode: "GOVERNED_SELF_MODE",
        founder_approval_gate: "CREDENTIAL_ADMINISTRATION_ONLY",
        memory_recall_mode: "LAYERED_REPO_MEMORY_V3",
        active_thread_memory: conversationStateCapability(env).durable ? "DURABLE_CONVERSATION_STATE_V1" : "BEST_EFFORT_WORKING_CONTEXT_V1",
        active_thread_memory_durable: conversationStateCapability(env).durable,
        active_thread_memory_reason: conversationStateCapability(env).reason,
        founder_conversation_layer: "NATURAL_CONVERSATION_FIRST_V1",
        fact_evidence_runtime: "FRESH_GITHUB_FACTS_V1",
        founder_request_gateway: "STRUCTURED_REQUEST_GATEWAY_V1",
        memory_write_configured: Boolean(env.GITHUB_MEMORY_TOKEN),
        memory_brain: memoryBrainStatus(env),
        aura3_bridge_configured: aura3BridgeConfigured(env),
        tony_bridge_configured: tonyBridgeConfigured(env),
        tony_task_request_supported: true,
        tony_assignment_routing: "EXPLICIT_TONY_PRIORITY_V2",
        tony_payload_contract: "STRUCTURED_V5_REPO_NORMALIZED",
        rio_bridge_configured: rioBridgeConfigured(env),
        telegram_token_configured: Boolean(env.TELEGRAM_BOT_TOKEN_VICTOR),
        webhook_secret_configured: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
        founder_chat_configured: Boolean(env.VICTOR_FOUNDER_CHAT_ID),
        management_chat_configured: Boolean(env.TELEGRAM_MANAGEMENT_CHAT_ID),
        ai_inference_enabled: env.ENABLE_AI_INFERENCE === "true",
        ai_credential_configured: Boolean(env.API_VICTOR),
        cognee_inference_credential_configured: Boolean(env.COGNEE_API_KEY),
        cognee_inference_runtime: "COGNEE_CLOUD_MEMORY_API_V2",
        cognee_auth_circuit_breaker: "COGNEE_CLOUD_AUTH_401_403_HOLD_V3",
        telegram_webhook_ack_policy: "HANDLED_ERRORS_HTTP_200_V1",
        model_router: "BEDROCK_DISCOVERY_SPECIALIST_V1",
        anti_bogus_runtime: "DEAD_END_RECOVERY_V1",
        response_integrity: "INDEPENDENT_EVIDENCE_LOCK_V1",
        reply_style_guard: "NATURAL_DIRECT_V1",
        autonomy_requested_mode: "MANUAL_GOVERNED_ORCHESTRATOR",
        autonomy_runtime_configured: autonomyConfigured(env),
        autonomy_scheduler_bound: false,
        autonomy_supervision_interval_minutes: null,
        autonomy_allowed_trigger: "founder-command",
        autonomy_evidence_persistence: "GITHUB_CANONICAL_STATE_V1",
        autonomy_reporting: "MANUAL_TRIGGER_RESULTS_AND_BOUNDARY_ESCALATIONS",
        telegram_brain_gateway: "BRAIN_FIRST_FOR_EXECUTIVE_AND_CROSS_DEPARTMENT_COMMANDS_V1",
        victor_report_card_target: "10/10",
        victor_report_card_basis: "VERIFIED_DEPARTMENT_FINAL_OUTCOMES_ONLY",
        direct_consequential_department_execution: false,
        governed_diagnostic_department_bridge: true,
        v2_runtime_wired: true,
        v2_founder_intent_gateway: "DETERMINISTIC_STOP_PAUSE_V1",
        v2_security_kernel_policy: SECURITY_POLICY_VERSION,
        v2_action_contract: "ACTION_CONTRACT_V1",
        v2_sandbox_profile: SANDBOX_PROFILE_VERSION,
        v2_capability_broker: BROKER_VERSION,
        v2_watchdog: WATCHDOG_VERSION,
        v2_promotion_gate: PROMOTION_GATE_VERSION,
        v2_rollback_contract: ROLLBACK_CONTRACT_VERSION,
        v2_production_autonomy_enabled: false,
        v2_live_sandbox_verified: false,
        v2_live_rollback_verified: false
      });
    }
    if (request.method === "GET" && ["/telegram-webhook-health", "/telegram-webhook-health/"].includes(url.pathname)) {
      if (!env.TELEGRAM_BOT_TOKEN_VICTOR) {
        return json({
          service: "telegram-webhook-health",
          status: "TOKEN_NOT_CONFIGURED",
          bot_token_configured: false,
          secrets_exposed: false
        }, 503);
      }
      try {
        const response = await fetch(`${TELEGRAM_API2}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/getWebhookInfo`, {
          method: "GET",
          headers: { "User-Agent": "Dr-Victor-Telegram-Webhook-Health/1.0" }
        });
        const body = await response.json().catch(() => null);
        const info = body?.result || {};
        const configuredUrl = typeof info.url === "string" ? info.url : "";
        const expectedUrl = `${url.origin}/telegram`;
        const urlMatches = Boolean(configuredUrl) && configuredUrl === expectedUrl;
        const telegramOk = response.ok && body?.ok === true;
        const status = !telegramOk ? "TELEGRAM_API_ERROR" : !configuredUrl ? "WEBHOOK_NOT_SET" : urlMatches ? "WEBHOOK_CONFIGURED_MATCHING" : "WEBHOOK_URL_MISMATCH";
        console.log(JSON.stringify({
          event: "VICTOR_TELEGRAM_WEBHOOK_HEALTH",
          status,
          telegram_http_status: response.status,
          webhook_url_matches_expected: urlMatches,
          pending_update_count: Number(info.pending_update_count || 0),
          last_error_date: info.last_error_date || null,
          secrets_exposed: false
        }));
        return json({
          service: "telegram-webhook-health",
          status,
          telegram_api_ok: telegramOk,
          telegram_http_status: response.status,
          webhook_configured: Boolean(configuredUrl),
          webhook_url: configuredUrl || null,
          expected_webhook_url: expectedUrl,
          webhook_url_matches_expected: urlMatches,
          pending_update_count: Number(info.pending_update_count || 0),
          last_error_date: info.last_error_date || null,
          last_error_message: info.last_error_message || null,
          max_connections: info.max_connections || null,
          ip_address: info.ip_address || null,
          bot_token_configured: true,
          secrets_exposed: false
        }, telegramOk && urlMatches ? 200 : 503);
      } catch (error) {
        console.error(JSON.stringify({
          event: "VICTOR_TELEGRAM_WEBHOOK_HEALTH_FAILED",
          error_name: error?.name || "Error",
          error_message: String(error?.message || "unknown").slice(0, 300),
          secrets_exposed: false
        }));
        return json({
          service: "telegram-webhook-health",
          status: "CHECK_FAILED",
          bot_token_configured: true,
          secrets_exposed: false
        }, 503);
      }
    }
    if (request.method === "GET" && ["/aura3-bridge-health", "/aura3-bridge-health/", "/aura3-health", "/aura3-health/"].includes(url.pathname)) {
      if (!aura3BridgeConfigured(env)) {
        return json({ service: "aura3-bridge", status: "PENDING_CONFIGURATION", token_present: false }, 503);
      }
      const headers3 = {
        Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Dr-Victor-AURA3-Bridge-Health/1.0"
      };
      const repoUrl = "https://api.github.com/repos/vickykenin-lang/aura-3.0";
      const workflowUrl = "https://api.github.com/repos/vickykenin-lang/aura-3.0/actions/workflows/victor-aura3-transport.yml";
      const [repoResponse, workflowResponse] = await Promise.all([
        fetch(repoUrl, { headers: headers3 }),
        fetch(workflowUrl, { headers: headers3 })
      ]);
      return json({
        service: "aura3-bridge",
        status: repoResponse.ok && workflowResponse.ok ? "READ_PATH_VERIFIED" : "BLOCKED",
        token_present: true,
        repository_access_http: repoResponse.status,
        workflow_access_http: workflowResponse.status,
        workflow_dispatch_write: "NOT_TESTED_BY_READ_ONLY_HEALTH_CHECK",
        expected_actions_permission: "READ_AND_WRITE",
        expected_contents_permission: "READ_ONLY_OR_HIGHER",
        secrets_exposed: false
      }, repoResponse.ok && workflowResponse.ok ? 200 : 503);
    }
    if (request.method === "GET" && ["/tony-bridge-health", "/tony-bridge-health/", "/tony-health", "/tony-health/"].includes(url.pathname)) {
      if (!tonyBridgeConfigured(env)) {
        return json({ service: "tony-bridge", status: "PENDING_CONFIGURATION", token_present: false }, 503);
      }
      const headers3 = {
        Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Dr-Victor-Tony-Bridge-Health/1.0"
      };
      const repoUrl = "https://api.github.com/repos/vickykenin-lang/tony-stark-engineering";
      const workflowUrl = "https://api.github.com/repos/vickykenin-lang/tony-stark-engineering/actions/workflows/victor_tony_transport.yml";
      const [repoResponse, workflowResponse] = await Promise.all([
        fetch(repoUrl, { headers: headers3 }),
        fetch(workflowUrl, { headers: headers3 })
      ]);
      return json({
        service: "tony-bridge",
        status: repoResponse.ok && workflowResponse.ok ? "READ_PATH_VERIFIED" : "BLOCKED",
        token_present: true,
        repository_access_http: repoResponse.status,
        workflow_access_http: workflowResponse.status,
        workflow_dispatch_write: "NOT_TESTED_BY_READ_ONLY_HEALTH_CHECK",
        expected_actions_permission: "READ_AND_WRITE",
        expected_contents_permission: "READ_ONLY_OR_HIGHER",
        secrets_exposed: false
      }, repoResponse.ok && workflowResponse.ok ? 200 : 503);
    }
    if (request.method === "GET" && url.pathname === "/core-health") {
      const core = await loadVictorCore();
      return json({
        service: "victor-core-context",
        status: core.ready ? "READY" : "SAFE_STOP",
        required_sources_ok: core.requiredSourcesOk,
        precedence_mode: PRECEDENCE_VERSION,
        truth_guard: "DETERMINISTIC_V3",
        memory_sources: core.sourceStatus.filter((x) => ["FOUNDER_MEMORY", "DECISIONS", "LONG_TERM_MEMORY", "ACTIVE_PROJECTS_MEMORY", "WORKING_MEMORY", "LEARNINGS_MEMORY", "OPERATIONAL_MEMORY", "ACTIVITY_MEMORY", "MEMORY_INDEX_MD", "MEMORY_INDEX"].includes(x.name)),
        resolved_runtime_rules: RESOLVED_RUNTIME_RULES,
        sources: core.sourceStatus
      }, core.ready ? 200 : 503);
    }
    if (request.method === "GET" && url.pathname === "/v2-health") {
      const stopTest = classifyFounderIntent("STOP Victor");
      const greenTest = evaluateSecurityRequest({ capability_id: "evidence.read" });
      const redTest = evaluateSecurityRequest({ capability_id: "credential.rotate", founder_approved: false });
      const sandbox = createSandboxSpec({ objective_id: "V2-LIVE-SELFTEST", action_id: "SANDBOX-SPEC" });
      const sandboxValidation = validateSandboxSpec(sandbox);
      const lease = issueCapabilityLease({ capability_id: "sandbox.execute", objective_id: "V2-LIVE-SELFTEST", action_id: "LEASE", ttl_seconds: 60 });
      const leaseValidation = validateCapabilityLease(lease, { objective_id: "V2-LIVE-SELFTEST", action_id: "LEASE", capability_id: "sandbox.execute" });
      const watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });
      const ready = stopTest.intent === FOUNDER_INTENT.STOP_PAUSE && greenTest.decision === "ALLOW" && redTest.decision === "DENY" && sandboxValidation.valid === true && lease.issued === true && leaseValidation.valid === true && watchdog.decision === "CONTINUE_BOUNDED";
      return json({
        service: "victor-v2-runtime",
        status: ready ? "READY" : "SAFE_STOP",
        runtime_wired: true,
        founder_stop_precedence: stopTest.intent === FOUNDER_INTENT.STOP_PAUSE,
        green_evidence_read: greenTest.decision,
        red_credential_without_founder: redTest.decision,
        sandbox_profile: sandbox.profile_version,
        sandbox_validation: sandboxValidation.reason,
        capability_broker: lease.broker_version || BROKER_VERSION,
        capability_lease_valid: leaseValidation.valid === true,
        watchdog: watchdog.decision,
        security_policy: SECURITY_POLICY_VERSION,
        production_autonomy_enabled: false,
        live_sandbox_execution_verified: false,
        live_rollback_drill_verified: false,
        secrets_exposed: false
      }, ready ? 200 : 503);
    }
    if (request.method !== "POST" || url.pathname !== "/telegram") return json({ error: "not_found" }, 404);
    if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "webhook_secret_not_configured" }, 503);
    const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (!constantTimeEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET)) return json({ error: "unauthorized" }, 401);
    let update;
    try {
      update = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const message = update?.message;
    if (!message || typeof message?.text !== "string") return json({ ok: true, ignored: true });
    const chatId = String(message?.chat?.id ?? "");
    if (!chatId) return json({ ok: true, ignored: true });
    const text3 = message.text.trim();
    if (!text3) return json({ ok: true, ignored: true });
    const senderId = String(message?.from?.id ?? "");
    if (!isAuthorizedFounderMessage(env, chatId, senderId)) {
      return json({ ok: true, ignored: true, reason: "chat_not_authorized" });
    }
    const v2Intent = classifyFounderIntent(text3);
    const v2Watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });
    if (v2Watchdog.decision === "SAFE_HOLD") {
      await sendTelegramMessage(env, chatId, "Victor V2 watchdog SAFE_HOLD active hai; new execution dispatch blocked hai.", message.message_id);
      return json({ ok: true, mode: "V2_SAFE_HOLD", dispatch: "BLOCKED", watchdog: v2Watchdog.triggers });
    }
    const traceId = buildTraceId(update?.update_id, message.message_id);
    console.log(JSON.stringify({
      event: "VICTOR_TELEGRAM_MESSAGE_ACCEPTED",
      trace_id: traceId,
      message_id: message.message_id,
      chat_authorized: true,
      secrets_exposed: false
    }));
    const emergencyCommand = parseEmergencyCommand(text3);
    if (v2Intent.intent === FOUNDER_INTENT.STOP_PAUSE && !emergencyCommand) {
      await sendTelegramMessage(env, chatId, "Founder STOP/PAUSE precedence detected. New execution fail-closed SAFE_HOLD me hai; no dispatch attempted.", message.message_id);
      return json({ ok: true, mode: "V2_STOP_PAUSE_SAFE_HOLD", dispatch: "BLOCKED" });
    }
    if (emergencyCommand) {
      try {
        const pauseResult = await applyEmergencyCommand(env, emergencyCommand, { chatId, messageId: message.message_id });
        const label = pauseResult.status === "PAUSE_UNCONFIRMED" ? "Emergency pause requested but RIO acknowledgement failed. Victor remains fail-closed for new dispatch; check RIO mirror before assuming organization-wide pause." : `${pauseResult.status}: ${emergencyCommand.scope === "system" ? "SYSTEM" : emergencyCommand.department}. RIO mirror: ${pauseResult.rio_mirror}.`;
        await sendTelegramMessage(env, chatId, label, message.message_id);
        return json({ ok: true, emergency_pause: pauseResult.status, rio_mirror: pauseResult.rio_mirror });
      } catch (pauseError) {
        await sendTelegramMessage(env, chatId, "Emergency pause command failed to persist. Treat execution state as unconfirmed; no success claimed.", message.message_id);
        return json({ ok: false, emergency_pause: "FAILED" }, 503);
      }
    }
    let processingStage = "REQUEST_ACCEPTED";
    try {
      processingStage = "FOUNDER_GUIDANCE_CHECK";
      const pendingGuidance = await readActiveFounderGuidance(env);
      if (shouldTreatAsFounderGuidanceAnswer(text3, message, pendingGuidance)) {
        const answered = await recordFounderGuidanceAnswer(env, pendingGuidance, text3, {
          chatId,
          messageId: message.message_id
        });
        if (answered.status === "ANSWERED") {
          await writeConversationSession(chatId, {
            task_state: "FOUNDER_GUIDANCE_ANSWERED",
            founder_guidance_id: answered.record.guidance_id,
            founder_guidance_goal_id: answered.record.goal_id
          }, env);
          await sendTelegramMessage(
            env,
            chatId,
            `Guidance received for ${answered.record.goal_id}. Victor is replanning now; completion will be claimed only after fresh verified evidence.`,
            message.message_id
          );
          ctx?.waitUntil(runFounderGuidanceWake(env));
          return json({ ok: true, mode: "FOUNDER_GUIDANCE_ANSWER", status: "ANSWERED", goal_id: answered.record.goal_id });
        }
      }
      processingStage = "MEMORY_WRITE";
      let memoryWrite = { status: "NOT_REQUESTED" };
      const memoryDirective = isExplicitMemoryDirective(text3);
      if (memoryDirective) {
        try {
          memoryWrite = await writeVictorMemory(env, text3, {
            chatId,
            messageId: message.message_id,
            source: "telegram"
          }, () => persistExplicitFounderMemory(env, text3, {
            chatId,
            messageId: message.message_id
          }));
        } catch (memoryError) {
          console.error("Victor memory persistence failed:", memoryError?.message || "unknown");
          memoryWrite = { status: "FAILED" };
        }
      }
      processingStage = "REQUEST_PLANNING";
      const replyContext = message?.reply_to_message?.text || "";
      const session = await readConversationSession(chatId, env);
      const activePatch = buildActiveContext(session, { founderText: text3, replyContext, messageId: message.message_id });
      let sessionWithFounderTurn = appendRecentTurn({ ...session, ...activePatch }, "founder", text3);
      const founderRequest = buildRuntimeFounderRequest(text3, sessionWithFounderTurn);
      const requestSessionPatch = buildSessionPatchForRequest(founderRequest);
      sessionWithFounderTurn = { ...sessionWithFounderTurn, ...requestSessionPatch };
      await writeConversationSession(chatId, sessionWithFounderTurn, env);
      const deterministicIntent = resolveFounderIntent(text3, replyContext);
      const contextualFollowUp = classifyConversationFollowUp(text3, sessionWithFounderTurn);
      const ownedProblem = classifyOwnedProblem(text3, sessionWithFounderTurn);
      const deadEnd = detectDeadEndLoop(text3, sessionWithFounderTurn);
      const factRequest = buildFactRequestFromFounderRequest(founderRequest, text3);
      const explicitExecutiveGoalCommand = isExplicitExecutiveGoalCommand(text3);
      const hulkRequest = classifyHulkRequest(text3);
      if (!memoryDirective && isCasualWellbeing(text3)) {
        await sendTelegramMessage(env, chatId, casualWellbeingReply(), message.message_id);
        return json({ ok: true, mode: "CASUAL_WELLBEING" });
      }
      if (!memoryDirective && hulkRequest.matched) {
        await writeConversationSession(chatId, { last_target: "hulk", last_founder_text: text3, task_state: "NO_VERIFIED_BRIDGE" }, env);
        const reply2 = hulkRequest.mode === "HULK_ACTION" ? hulkActionBlockedReply() : hulkStatusReply();
        await sendTelegramMessage(env, chatId, reply2, message.message_id);
        return json({ ok: true, mode: hulkRequest.mode, target: "hulk", dispatch: "NOT_ATTEMPTED_BRIDGE_UNVERIFIED" });
      }
      if (v2Intent.intent === FOUNDER_INTENT.EXECUTION_COMMAND && shouldRunDeadEndRecovery(memoryDirective, explicitExecutiveGoalCommand, deadEnd)) {
        processingStage = "DEAD_END_RECOVERY";
        const recoveryText = buildDeadEndRecoveryPrompt(deadEnd, text3);
        const dispatch = await dispatchContextualInvestigation(env, deadEnd.target, recoveryText, { messageId: message.message_id });
        await writeConversationSession(chatId, {
          last_target: deadEnd.target,
          last_task_id: dispatch.taskId,
          last_task_type: "DEAD_END_RECOVERY",
          active_issue: text3,
          unresolved_question: text3,
          task_state: "DEAD_END_RECOVERY_RUNNING",
          dead_end_reason: deadEnd.reason,
          dead_end_repeat_count: deadEnd.repeated_count || 1
        }, env);
        await sendTelegramMessage(env, chatId, "Same unresolved answer repeat nahi karunga. Fresh diagnosis/recovery task start kar diya hai; next update fresh evidence ya exact Founder-only blocker ke saath hoga.", message.message_id);
        if (deadEnd.target === "rio") ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        else if (deadEnd.target === "tony_stark") ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        else if (deadEnd.target === "aura3") ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        return json({ ok: true, mode: "DEAD_END_RECOVERY", target: deadEnd.target, task_id: dispatch.taskId });
      }
      const explicitInferenceDiagnostic = !/\bcognee\b/i.test(text3) && /\b(live ai inference|ai inference test|inference test|bedrock model discovery|selected model|model discovery status|test bedrock|bedrock test)\b/i.test(text3);
      if (!memoryDirective && explicitInferenceDiagnostic) {
        processingStage = "LIVE_AI_INFERENCE_DIAGNOSTIC";
        if (env.ENABLE_AI_INFERENCE !== "true") {
          await sendTelegramMessage(env, chatId, "Live AI inference disabled hai: ENABLE_AI_INFERENCE=true required.", message.message_id);
          return json({ ok: false, mode: "LIVE_AI_INFERENCE_DIAGNOSTIC", status: "INFERENCE_DISABLED", acknowledged: true }, 200);
        }
        if (!env.API_VICTOR) {
          await sendTelegramMessage(env, chatId, "Live AI inference blocked hai: API_VICTOR runtime credential configured nahi hai.", message.message_id);
          return json({ ok: false, mode: "LIVE_AI_INFERENCE_DIAGNOSTIC", status: "CREDENTIAL_MISSING", acknowledged: true }, 200);
        }
        try {
          const result = await callVictorModel(
            env,
            "You are Victor runtime diagnostic. Return one short harmless confirmation sentence only. Do not mention or expose any credential, token, secret, or key.",
            "Reply exactly with a brief confirmation that this is a live inference response."
          );
          const safeContent = String(result.content || "").trim().slice(0, 500);
          const reply2 = [
            "Live AI inference: VERIFIED",
            `Task type: ${result.task || "unknown"}`,
            `Selected model: ${result.model || "unknown"}`,
            `Bedrock model discovery: ${result.discovery_status || "unknown"}`,
            `Fallback attempts: ${result.failures?.length || 0}`,
            `Live response: ${safeContent}`,
            "Secrets exposed: no"
          ].join("\n");
          await sendTelegramMessage(env, chatId, reply2, message.message_id);
          return json({
            ok: true,
            mode: "LIVE_AI_INFERENCE_DIAGNOSTIC",
            status: "VERIFIED",
            task: result.task || null,
            model: result.model || null,
            discovery_status: result.discovery_status || null,
            fallback_attempts: result.failures?.length || 0,
            secrets_exposed: false
          });
        } catch (error) {
          const code = error?.code || "AI_MODEL_ROUTER_EXHAUSTED";
          await sendTelegramMessage(env, chatId, `Live AI inference FAILED. Runtime code: ${code}. Main generic GitHub status se is failure ko cover nahi karunga.`, message.message_id);
          return json({ ok: false, mode: "LIVE_AI_INFERENCE_DIAGNOSTIC", status: "FAILED", code, acknowledged: true, secrets_exposed: false }, 200);
        }
      }
      const explicitCogneeInferenceDiagnostic = /\b(cognee inference|cognee smoke|victor_cognee_api|cognee api|test cognee)\b/i.test(text3);
      if (!memoryDirective && explicitCogneeInferenceDiagnostic) {
        processingStage = "LIVE_COGNEE_API_DIAGNOSTIC";
        if (!env.COGNEE_API_KEY) {
          await sendTelegramMessage(env, chatId, "Cognee API check blocked hai: Cognee runtime credential configured nahi hai.", message.message_id);
          return json({ ok: false, mode: "LIVE_COGNEE_API_DIAGNOSTIC", status: "CREDENTIAL_MISSING", acknowledged: true }, 200);
        }
        try {
          console.log(JSON.stringify({
            event: "VICTOR_COGNEE_DIAGNOSTIC_MATCHED",
            trace_id: traceId,
            provider: "COGNEE_CLOUD",
            api_victor_fallback: false,
            secrets_exposed: false
          }));
          const result = await callCogneeInference(env, "", "");
          const safeContent = String(result.content || "").trim().slice(0, 500);
          const reply2 = [
            "Cognee Cloud API: VERIFIED",
            `Credential path: ${result.credential_source || "Cognee API secret"}`,
            `Provider: ${result.provider || "COGNEE_CLOUD"}`,
            `API endpoint: ${result.endpoint || "/api/v1/datasets/"}`,
            `Accessible datasets: ${Number(result.dataset_count || 0)}`,
            `Auth/data read status: ${result.discovery_status || "COGNEE_DATASETS_VERIFIED"}`,
            `Result: ${safeContent}`,
            "Bedrock used for Cognee: no",
            "API_VICTOR fallback: no",
            "Secrets exposed: no"
          ].join("\n");
          console.log(JSON.stringify({
            event: "VICTOR_COGNEE_API_VERIFIED",
            trace_id: traceId,
            provider: result.provider || "COGNEE_CLOUD",
            endpoint: result.endpoint || "/api/v1/datasets/",
            dataset_count: Number(result.dataset_count || 0),
            credential_source: result.credential_source || null,
            api_victor_fallback: false,
            secrets_exposed: false
          }));
          await sendTelegramMessage(env, chatId, reply2, message.message_id);
          return json({
            ok: true,
            mode: "LIVE_COGNEE_API_DIAGNOSTIC",
            status: "VERIFIED",
            provider: result.provider || "COGNEE_CLOUD",
            endpoint: result.endpoint || "/api/v1/datasets/",
            dataset_count: Number(result.dataset_count || 0),
            credential_source: result.credential_source || null,
            api_victor_fallback: false,
            secrets_exposed: false
          });
        } catch (error) {
          const code = error?.code || "COGNEE_API_FAILED";
          const detail = error?.httpStatus ? ` HTTP ${error.httpStatus}.` : "";
          const suppressed = Boolean(error?.suppressNotification);
          if (!suppressed) {
            const messageText = code === "COGNEE_AUTH_BLOCKED" ? `Cognee Cloud auth blocked.${detail} Same credential par retries hold hain; credential change ke baad retry allow hoga.` : `Cognee Cloud API check FAILED. Runtime code: ${code}.${detail}`;
            await sendTelegramMessage(env, chatId, messageText, message.message_id);
          }
          console.log(JSON.stringify({
            event: "VICTOR_COGNEE_API_BLOCKED",
            trace_id: traceId,
            code,
            http_status: error?.httpStatus || null,
            notification_suppressed: suppressed,
            credential_change_required: Boolean(error?.credentialChangeRequired),
            acknowledged: true,
            secrets_exposed: false
          }));
          return json({
            ok: false,
            mode: "LIVE_COGNEE_API_DIAGNOSTIC",
            status: code === "COGNEE_AUTH_BLOCKED" ? "AUTH_BLOCKED" : "FAILED",
            code,
            http_status: error?.httpStatus || null,
            notification_suppressed: suppressed,
            credential_change_required: Boolean(error?.credentialChangeRequired),
            acknowledged: true,
            secrets_exposed: false
          }, 200);
        }
      }
      const explicitMemoryRecallDiagnostic = /\b(memory recall diagnostic|cognee recall diagnostic|debug memory recall)\b/i.test(text3);
      if (!memoryDirective && explicitMemoryRecallDiagnostic) {
        processingStage = "LIVE_COGNEE_RECALL_DIAGNOSTIC";
        const diagnosticQuery = text3.replace(/\b(memory recall diagnostic|cognee recall diagnostic|debug memory recall)\b/ig, "").replace(/^\s*[:\-]\s*/, "").trim() || "Falcon validation code";
        const result = await cogneeRecall(env, diagnosticQuery, { topK: 5, timeoutMs: 1e4 });
        const diagnosticResults = Array.isArray(result.results) ? result.results : [];
        const serializedResults = JSON.stringify(diagnosticResults).toLowerCase();
        const firstResult = diagnosticResults[0];
        const firstResultType = Array.isArray(firstResult) ? "array" : typeof firstResult;
        const firstResultKeys = firstResult && typeof firstResult === "object" && !Array.isArray(firstResult) ? Object.keys(firstResult).slice(0, 12).join(",") : "n/a";
        const containsFalcon = serializedResults.includes("falcon");
        const containsExpectedCode = serializedResults.includes("cf-914-vg");
        const reply2 = [
          "Cognee recall diagnostic",
          `Status: ${result.status || "unknown"}`,
          `Dataset: ${result.dataset || "unknown"}`,
          `Result count: ${diagnosticResults.length || Number(result.result_count || 0)}`,
          `Payload shape: ${result.payload_shape || "n/a"}`,
          `First result type: ${firstResultType}`,
          `First result keys: ${firstResultKeys}`,
          `Contains Falcon: ${containsFalcon ? "yes" : "no"}`,
          `Contains expected code: ${containsExpectedCode ? "yes" : "no"}`,
          `HTTP status: ${result.http_status || "n/a"}`,
          `Reason: ${result.reason || "n/a"}`,
          "Secrets exposed: no"
        ].join("\n");
        await sendTelegramMessage(env, chatId, reply2, message.message_id);
        return json({
          ok: result.status === "RECALLED",
          mode: "LIVE_COGNEE_RECALL_DIAGNOSTIC",
          status: result.status || "unknown",
          dataset: result.dataset || null,
          result_count: diagnosticResults.length || Number(result.result_count || 0),
          payload_shape: result.payload_shape || null,
          first_result_type: firstResultType,
          first_result_keys: firstResultKeys,
          contains_falcon: containsFalcon,
          contains_expected_code: containsExpectedCode,
          http_status: result.http_status || null,
          reason: result.reason || null,
          secrets_exposed: false
        }, 200);
      }
      if (!memoryDirective && !explicitExecutiveGoalCommand && shouldUseFactGateway(founderRequest, factRequest)) {
        processingStage = "FACT_RETRIEVAL";
        try {
          const evidence = await collectFactEvidence(env, text3, factRequest);
          const authoritativeMemory = buildMemoryContext(text3, [], 0);
          const semanticMemory = await recallVictorMemory(env, text3, authoritativeMemory, { topK: 5 });
          const semanticResults = Array.isArray(semanticMemory?.cogneeMemory) ? semanticMemory.cogneeMemory : [];
          const rememberedFact = selectDirectRememberedFact(text3, semanticResults, [{
            name: "FACT_GATEWAY_EVIDENCE",
            ok: true,
            text: JSON.stringify(evidence)
          }]);
          let reply2;
          if (rememberedFact.matched) {
            reply2 = rememberedFact.answer;
            console.log(JSON.stringify({
              event: "VICTOR_MEMORY_DIRECT_ANSWER",
              provider: "COGNEE",
              semantic_result_count: semanticResults.length,
              canonical_contradiction: false,
              secrets_exposed: false
            }));
          } else if (env.ENABLE_AI_INFERENCE === "true" && env.API_VICTOR) {
            reply2 = await askModel(
              env,
              "Answer from the verified evidence provided. GitHub canonical evidence has precedence only when it contains an explicit relevant fact or an explicit contradiction. Cognee long-term memory is valid remembered evidence when it directly answers the Founder query and GitHub is silent. Mere absence from a department registry, file, or canonical source is NOT a conflict and must not cause UNVERIFIED if Cognee contains a direct matching memory. Never call Cognee canonical unless GitHub also supports it. If Cognee directly contains the requested remembered fact and there is no explicit canonical contradiction, answer that fact naturally and identify it as remembered long-term memory when provenance matters. If neither source supports the answer, say UNVERIFIED.",
              buildFactAnswerPrompt(text3, evidence) + `

COGNEE LONG-TERM MEMORY (advisory semantic recall):
${JSON.stringify(semanticResults)}`
            );
          } else if (semanticResults.length) {
            reply2 = `Semantic memory recall returned ${semanticResults.length} result(s), but AI synthesis is unavailable.`;
          } else {
            reply2 = `Fresh evidence fetched at ${evidence.fetched_at_utc}. AI synthesis unavailable; raw fact retrieval succeeded.`;
          }
          await sendTelegramMessage(env, chatId, reply2, message.message_id);
          return json({
            ok: true,
            mode: "FACT_EVIDENCE_QUERY",
            targets: factRequest.targets,
            questions: founderRequest.questions.length,
            semantic_recall_status: semanticMemory?.semantic_recall_status || null,
            semantic_result_count: semanticResults.length
          });
        } catch (error) {
          console.error("Fresh fact retrieval failed:", safeErrorMessage(error));
          await sendTelegramMessage(env, chatId, "Fresh evidence read fail hua. Main generic status line se gap cover nahi karunga; exact GitHub/Cognee fact abhi verify nahi hua.", message.message_id);
          return json({ ok: true, mode: "FACT_EVIDENCE_QUERY_FAILED" });
        }
      }
      if (!memoryDirective && v2Intent.intent === FOUNDER_INTENT.EXECUTION_COMMAND && shouldExecuteCrossDepartment(founderRequest.execution_plan)) {
        processingStage = "CROSS_DEPARTMENT_EXECUTION";
        const crossResult = await executeCrossDepartmentPlan(env, ctx, chatId, founderRequest.execution_plan, message.message_id);
        await writeConversationSession(chatId, {
          active_issue: text3,
          unresolved_question: text3,
          task_state: crossResult.failed.length ? "CROSS_DEPARTMENT_PARTIAL" : "CROSS_DEPARTMENT_DISPATCHED",
          cross_department_plan: crossResult,
          last_task_id: null,
          parent_task_id: null
        }, env);
        const dispatchedNames = crossResult.dispatched.map((x) => x.target === "tony_stark" ? "Tony" : x.target.toUpperCase()).join(", ");
        const failedNames = crossResult.failed.map((x) => x.target === "tony_stark" ? "Tony" : x.target.toUpperCase()).join(", ");
        const reply2 = failedNames ? `Cross-department plan start hua. Dispatched: ${dispatchedNames || "none"}. Abhi dispatch nahi hua: ${failedNames}. Main unverified execution ko completed claim nahi kar raha.` : `Cross-department plan start hua: ${dispatchedNames}. Final outcome har department ke verified result ke baad hi maana jayega.`;
        await sendTelegramMessage(env, chatId, reply2, message.message_id);
        return json({ ok: true, mode: "CROSS_DEPARTMENT_ACTION", dispatched: crossResult.dispatched.map((x) => x.target), failed: crossResult.failed.map((x) => x.target) });
      }
      if (!memoryDirective && v2Intent.intent === FOUNDER_INTENT.EXECUTION_COMMAND && ownedProblem.matched) {
        const recoveryText = buildOwnedProblemPrompt(ownedProblem.target, text3);
        const dispatch = await dispatchContextualInvestigation(env, ownedProblem.target, recoveryText, { messageId: message.message_id });
        const ownedOutcome = createOwnedOutcomeState({
          target: ownedProblem.target,
          founderRequest: text3,
          taskId: dispatch.taskId
        });
        await writeConversationSession(chatId, {
          last_target: ownedProblem.target,
          last_task_id: dispatch.taskId,
          last_task_type: "OWNED_PROBLEM_RECOVERY",
          active_issue: text3,
          unresolved_question: text3,
          task_state: ownedOutcome.stage,
          owned_outcome: ownedOutcome
        }, env);
        await sendTelegramMessage(env, chatId, naturalOwnedProblemAck(ownedProblem.target), message.message_id);
        if (ownedProblem.target === "rio") ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        else if (ownedProblem.target === "tony_stark") ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        else if (ownedProblem.target === "aura3") ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        return json({ ok: true, mode: ownedProblem.mode, target: ownedProblem.target, task_id: dispatch.taskId });
      }
      if (!memoryDirective && contextualFollowUp.mode === "CONTEXTUAL_EXPLANATION") {
        const previousReply = String(sessionWithFounderTurn?.last_victor_reply || "").trim();
        let reply2 = previousReply ? "Previous verified update ke context se explain kar raha hoon: " + previousReply.slice(0, 1200) : "Is follow-up ka reliable previous context available nahi hai; main guess nahi karunga.";
        if (previousReply && env.ENABLE_AI_INFERENCE === "true" && env.API_VICTOR) {
          reply2 = await askModel(
            env,
            "Answer the Founder short follow-up using ONLY the immediately previous verified Victor reply and active thread. Do not dispatch a task. Do not claim new evidence. Explain naturally and concisely in the Founder language.",
            "Previous verified Victor reply:\n" + previousReply + "\n\nFounder follow-up: " + text3
          );
        }
        await sendTelegramMessage(env, chatId, reply2, message.message_id);
        return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, dispatch: "NOT_REQUIRED" });
      }
      if (!memoryDirective && v2Intent.intent === FOUNDER_INTENT.EXECUTION_COMMAND && contextualFollowUp.mode === "CONTEXTUAL_INVESTIGATION") {
        const investigationText = buildInvestigationTaskText(contextualFollowUp, sessionWithFounderTurn);
        const dispatch = await dispatchContextualInvestigation(env, contextualFollowUp.target, investigationText, { messageId: message.message_id });
        await writeConversationSession(chatId, {
          last_target: contextualFollowUp.target,
          last_task_id: dispatch.taskId,
          parent_task_id: contextualFollowUp.parent_task_id || contextualFollowUp.task_id || null,
          last_task_type: "CONTEXTUAL_INVESTIGATION",
          active_issue: contextualFollowUp.query || text3,
          unresolved_question: contextualFollowUp.query || text3,
          task_state: "PENDING_INVESTIGATION"
        }, env);
        await sendTelegramMessage(env, chatId, naturalInvestigationAcknowledgement(contextualFollowUp.target, contextualFollowUp.query || text3), message.message_id);
        if (contextualFollowUp.target === "rio") ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        else if (contextualFollowUp.target === "tony_stark") ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        else if (contextualFollowUp.target === "aura3") ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, parent_task_id: contextualFollowUp.parent_task_id || null, task_id: dispatch.taskId });
      }
      if (!memoryDirective && contextualFollowUp.mode) {
        const handled = await answerExistingDepartmentTask(env, chatId, contextualFollowUp, sessionWithFounderTurn, message.message_id);
        if (handled) return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, task_id: contextualFollowUp.task_id });
      }
      if (!memoryDirective && deterministicIntent.mode === "FOUNDER_DIRECTION") {
        await sendTelegramMessage(env, chatId, founderDirectionReply(), message.message_id);
        return json({ ok: true, mode: deterministicIntent.mode, reason: deterministicIntent.reason });
      }
      if (!memoryDirective && deterministicIntent.mode === "CLARIFICATION") {
        let clarification = clarificationFallback(replyContext);
        if (replyContext && env.ENABLE_AI_INFERENCE === "true") {
          clarification = await askModel(
            env,
            "Explain the immediately previous Victor reply to the Founder. Use the supplied previous reply as context. Do not greet, reintroduce yourself, change topic, or execute a new task. Answer concisely in the Founder language.",
            `Previous Victor reply: ${replyContext}
Founder clarification: ${text3}`
          );
        }
        await sendTelegramMessage(env, chatId, clarification, message.message_id);
        return json({ ok: true, mode: deterministicIntent.mode, reason: deterministicIntent.reason });
      }
      const plan = explicitExecutiveGoalCommand ? { mode: "EXECUTIVE_GOAL", target: null, reason: "explicit_organization_goal_execution_command" } : await planFounderRequest(env, text3, replyContext, sessionWithFounderTurn);
      if (!memoryDirective && plan.mode === "EXECUTIVE_GOAL") {
        processingStage = "EXECUTIVE_EXECUTION";
        const controller = { cron: "founder-command", scheduledTime: Date.now() };
        const result = await runAutonomousCycle(controller, env);
        await persistAutonomyEvidence(env, controller, result);
        const assessment = result?.result?.assessment || {};
        const summary = [
          assessment.rootCause ? `Root cause: ${assessment.rootCause}` : null,
          assessment.solution ? `Decision: ${assessment.solution}` : null,
          assessment.nextAction ? `Next: ${assessment.nextAction}` : null,
          result?.result?.taskId ? `Task: ${result.result.taskId}` : null
        ].filter(Boolean).join("\n");
        await sendTelegramMessage(env, chatId, summary || `Victor ne objective par executive cycle chala diya. Status: ${result.status}.`, message.message_id);
        return json({ ok: true, mode: plan.mode, result });
      }
      if (!memoryDirective && (plan.mode === "DEPARTMENT_STATUS" || plan.mode === "DEPARTMENT_ACTION")) {
        processingStage = "DEPARTMENT_EXECUTION";
        const target = plan.target;
        if (plan.mode === "DEPARTMENT_ACTION") {
          if (v2Intent.intent !== FOUNDER_INTENT.EXECUTION_COMMAND) {
            await sendTelegramMessage(env, chatId, "Victor V2 ne implicit department execution block kiya. Explicit execution command required hai.", message.message_id);
            return json({ ok: true, mode: "V2_NO_IMPLICIT_EXECUTION", target, dispatch: "BLOCKED" });
          }
          const preflight = buildV2DispatchPreflight(target, traceId);
          if (!preflight.allowed) {
            await sendTelegramMessage(env, chatId, `Victor V2 security preflight SAFE_HOLD: ${preflight.reason}.`, message.message_id);
            return json({ ok: true, mode: "V2_SECURITY_SAFE_HOLD", target, dispatch: "BLOCKED", reason: preflight.reason });
          }
        }
        if (plan.mode === "DEPARTMENT_STATUS" && sessionWithFounderTurn?.last_target === target && sessionWithFounderTurn?.last_task_id) {
          const handled = await answerExistingDepartmentTask(env, chatId, { mode: "TASK_STATUS_FOLLOWUP", target, task_id: sessionWithFounderTurn.last_task_id }, sessionWithFounderTurn, message.message_id);
          if (handled) return json({ ok: true, mode: "DEPARTMENT_STATUS_REUSED", target, task_id: sessionWithFounderTurn.last_task_id });
        }
        if (target === "rio") {
          const pause = await isExecutionPaused(env, "rio");
          if (pause.paused) {
            await sendTelegramMessage(env, chatId, "RIO paused hai; task dispatch nahi kiya.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, paused: true });
          }
          if (!rioBridgeConfigured(env)) {
            await sendTelegramMessage(env, chatId, "RIO bridge configured nahi hai.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, configured: false });
          }
          let dispatch;
          try {
            dispatch = await dispatchRioTask(env, text3, { messageId: message.message_id });
          } catch (error) {
            console.error("RIO dispatch failed:", safeErrorMessage(error));
            await sendTelegramMessage(env, chatId, "RIO ko task dispatch nahi hua. Victor ne failure record kiya hai; duplicate retry nahi karega.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, dispatch: "FAILED" });
          }
          await writeConversationSession(chatId, { last_target: "rio", last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text3, task_state: "PENDING" }, env);
          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement("rio", text3), message.message_id);
          ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
          return json({ ok: true, mode: plan.mode, target, task_id: dispatch.taskId });
        }
        if (target === "tony_stark") {
          const pause = await isExecutionPaused(env, "tony_stark");
          if (pause.paused) {
            await sendTelegramMessage(env, chatId, "Tony paused hai; task dispatch nahi kiya.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, paused: true });
          }
          if (!tonyBridgeConfigured(env)) {
            await sendTelegramMessage(env, chatId, "Tony bridge configured nahi hai.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, configured: false });
          }
          let dispatch;
          try {
            dispatch = await dispatchTonyTask(env, text3, { messageId: message.message_id });
          } catch (error) {
            console.error("Tony dispatch failed:", safeErrorMessage(error));
            await sendTelegramMessage(env, chatId, "Tony ko task dispatch nahi hua. Victor ne failure record kiya hai; duplicate retry nahi karega.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, dispatch: "FAILED" });
          }
          await writeConversationSession(chatId, { last_target: "tony_stark", last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text3, task_state: "PENDING" }, env);
          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement("tony_stark", text3), message.message_id);
          ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
          return json({ ok: true, mode: plan.mode, target, task_id: dispatch.taskId });
        }
        if (target === "aura3") {
          const pause = await isExecutionPaused(env, "aura3");
          if (pause.paused) {
            await sendTelegramMessage(env, chatId, "AURA3 paused hai; task dispatch nahi kiya.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, paused: true });
          }
          if (!aura3BridgeConfigured(env)) {
            await sendTelegramMessage(env, chatId, "AURA3 bridge configured nahi hai.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, configured: false });
          }
          let dispatch;
          try {
            dispatch = await dispatchAura3Task(env, text3, { messageId: message.message_id });
          } catch (error) {
            console.error("AURA3 dispatch failed:", safeErrorMessage(error));
            await sendTelegramMessage(env, chatId, "AURA3 ko task dispatch nahi hua. Victor ne failure record kiya hai; duplicate retry nahi karega.", message.message_id);
            return json({ ok: true, mode: plan.mode, target, dispatch: "FAILED" });
          }
          await writeConversationSession(chatId, { last_target: "aura3", last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text3, task_state: "PENDING" }, env);
          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement("aura3", text3), message.message_id);
          ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
          return json({ ok: true, mode: plan.mode, target, task_id: dispatch.taskId });
        }
      }
      let reply;
      processingStage = "REPLY_GENERATION";
      if (memoryDirective) {
        reply = memoryAcknowledgement(memoryWrite.status);
      } else if (isGreeting(text3)) {
        reply = "Hi Vicky. Victor online hai. Bataiye, aap kya discuss karna chahte hain?";
      } else if (env.ENABLE_AI_INFERENCE === "true") {
        processingStage = "AI_INFERENCE";
        reply = await callVictorCore(env, text3, {
          telegramWebhookAuthenticated: true,
          telegramMessageReceivedNow: true,
          diagnosticDepartmentBridgeAvailable: aura3BridgeConfigured(env) || tonyBridgeConfigured(env) || rioBridgeConfigured(env)
        }, sessionWithFounderTurn);
      } else {
        reply = "Victor Telegram gateway connected hai, lekin AI inference disabled hai. Main paid inference Founder approval ke bina enable nahi karunga.";
      }
      processingStage = "TELEGRAM_DELIVERY";
      await sendTelegramMessage(env, chatId, reply, message.message_id);
      console.log(JSON.stringify({
        event: "VICTOR_TELEGRAM_PROCESSED",
        trace_id: traceId,
        status: "SUCCESS",
        secrets_exposed: false
      }));
      return json({ ok: true, memory_write: memoryWrite.status });
    } catch (error) {
      const diagnostic = classifyProcessingError(error, processingStage);
      console.error(JSON.stringify({
        event: "VICTOR_TELEGRAM_PROCESSING_FAILED",
        trace_id: traceId,
        stage: diagnostic.stage,
        category: diagnostic.category,
        upstream_http_status: diagnostic.upstreamHttpStatus,
        error_name: error?.name || "Error",
        error_message: safeErrorMessage(error),
        secrets_exposed: false
      }));
      try {
        await sendTelegramMessage(env, chatId, diagnostic.founderMessage(traceId), message.message_id);
      } catch (_) {
      }
      return json({ ok: false, error: diagnostic.category, trace_id: traceId, acknowledged: true }, 200);
    }
  }
};
function sanitizeRuntimeError(error) {
  const value = String(error?.message || "AUTONOMOUS_CYCLE_FAILED").toUpperCase();
  return value.replace(/[^A-Z0-9_:-]/g, "_").slice(0, 120);
}
__name(sanitizeRuntimeError, "sanitizeRuntimeError");
async function runFounderGuidanceWake(env) {
  const controller = { cron: "founder-command", scheduledTime: Date.now() };
  let result;
  try {
    result = await runAutonomousCycle(controller, env);
  } catch (error) {
    result = {
      status: "SAFE_STOP",
      target: null,
      error_code: sanitizeRuntimeError(error)
    };
  }
  await persistAutonomyEvidence(env, controller, result);
  console.log(JSON.stringify({
    event: "VICTOR_FOUNDER_GUIDANCE_WAKE",
    status: result.status,
    goal_id: result.goalId || null,
    target: result.target || null,
    secrets_exposed: false
  }));
  return result;
}
__name(runFounderGuidanceWake, "runFounderGuidanceWake");
async function handleAura3RoundTrip(env, chatId, dispatch, replyToMessageId) {
  try {
    const received = await waitForAura3Result(dispatch.taskId);
    if (received.status !== "RESULT_RECEIVED") {
      await sendTelegramMessage(env, chatId, "AURA3 ka fresh result abhi verify nahi ho paya. Main same check ko track kar raha hoon; unverified result ko final nahi maanunga.", replyToMessageId);
      return;
    }
    const verification = verifyAura3Result(received.result, dispatch.taskId);
    if (!verification.ok) {
      await sendTelegramMessage(env, chatId, "AURA3 se result mila, lekin verification pass nahi hui. Main ise reliable final result nahi maan raha.", replyToMessageId);
      return;
    }
    if (await maybeContinueOwnedOutcome(env, chatId, "aura3", dispatch, received.result, replyToMessageId)) return;
    const report = formatAura3ResultForFounder(received.result);
    await sendNaturalDepartmentResult(env, chatId, "aura3", report, replyToMessageId);
  } catch (error) {
    console.error("AURA3 round-trip failed:", error?.message || "unknown");
    try {
      await sendTelegramMessage(env, chatId, "AURA3 ka fresh check verify nahi ho paya. Main success claim nahi kar raha; issue internally track ho raha hai.", replyToMessageId);
    } catch (_) {
    }
  }
}
__name(handleAura3RoundTrip, "handleAura3RoundTrip");
async function handleRioRoundTrip(env, chatId, dispatch, replyToMessageId) {
  try {
    const received = await waitForRioResult(dispatch.taskId);
    if (received.status !== "RESULT_RECEIVED") {
      await sendTelegramMessage(env, chatId, "RIO ka fresh result abhi verify nahi ho paya. Main ise success ya connected result claim nahi kar raha; same check ko track karunga.", replyToMessageId);
      return;
    }
    const verification = verifyRioResult(received.result, dispatch.taskId);
    if (!verification.ok) {
      await sendTelegramMessage(env, chatId, "RIO se result mila, lekin verification pass nahi hui. Isliye main us result ko reliable fact ke roop me use nahi karunga.", replyToMessageId);
      return;
    }
    if (await maybeContinueOwnedOutcome(env, chatId, "rio", dispatch, received.result, replyToMessageId)) return;
    const report = formatRioResultForFounder(received.result);
    await sendNaturalDepartmentResult(env, chatId, "rio", report, replyToMessageId);
  } catch (error) {
    console.error("RIO round-trip failed:", error?.message || "unknown");
    try {
      await sendTelegramMessage(env, chatId, "RIO ka fresh check verify nahi ho paya. Main success claim nahi kar raha; exact failure ko internally track kar raha hoon.", replyToMessageId);
    } catch (_) {
    }
  }
}
__name(handleRioRoundTrip, "handleRioRoundTrip");
async function handleTonyRoundTrip(env, chatId, dispatch, replyToMessageId) {
  try {
    const received = await waitForTonyResult(dispatch.taskId, env);
    if (received.status !== "RESULT_RECEIVED") {
      await sendTelegramMessage(env, chatId, "Tony ka fresh result abhi verify nahi ho paya. Main same check ko track kar raha hoon aur unverified result ko final nahi maanunga.", replyToMessageId);
      return;
    }
    const verification = verifyTonyResult(received.result, dispatch.taskId);
    if (!verification.ok) {
      await sendTelegramMessage(env, chatId, "Tony se result mila, lekin verification pass nahi hui. Main ise reliable final result nahi maan raha.", replyToMessageId);
      return;
    }
    if (await maybeContinueOwnedOutcome(env, chatId, "tony_stark", dispatch, received.result, replyToMessageId)) return;
    const report = formatTonyResultForFounder(received.result);
    const verificationNote = dispatch.taskType === "TASK_REQUEST" ? "Victor verification: governed TASK_REQUEST envelope ka fresh round-trip VERIFIED. Isse task execution complete prove nahi hota; changed files aur tests ka evidence alag verify hoga." : "Victor verification: fresh round-trip evidence VERIFIED for this task. Ye diagnostic communication verification hai; Tony LIVE certification alag gate hai.";
    await sendNaturalDepartmentResult(env, chatId, "tony_stark", `${report}

${verificationNote}`, replyToMessageId);
  } catch (error) {
    console.error("Tony round-trip failed:", error?.message || "unknown");
    try {
      await sendTelegramMessage(env, chatId, "Tony ka fresh check verify nahi ho paya. Main success claim nahi kar raha; issue internally track ho raha hai.", replyToMessageId);
    } catch (_) {
    }
  }
}
__name(handleTonyRoundTrip, "handleTonyRoundTrip");
async function maybeContinueOwnedOutcome(env, chatId, target, dispatch, rawResult, replyToMessageId) {
  const session = await readConversationSession(chatId, env);
  if (session?.last_task_type !== "OWNED_PROBLEM_RECOVERY") return false;
  if (session?.last_task_id && session.last_task_id !== dispatch.taskId) return false;
  const prior = session?.owned_outcome || createOwnedOutcomeState({
    target,
    founderRequest: session?.active_issue || session?.unresolved_question || session?.last_founder_text || "",
    taskId: dispatch.taskId
  });
  const assessed = assessVerifiedDepartmentResult({ ...rawResult, __victor_verified: true }, prior);
  await writeConversationSession(chatId, {
    task_state: assessed.stage,
    owned_outcome: assessed
  }, env);
  if (!shouldContinueOwnedRecovery(assessed)) return false;
  const founderRequest = assessed.founder_request || session?.active_issue || session?.unresolved_question || session?.last_founder_text || "";
  const continuationText = [
    buildOwnedProblemPrompt(target, founderRequest, rawResult),
    buildOwnedRecoveryDirective(assessed)
  ].join("\n\n");
  const nextDispatch = await dispatchContextualInvestigation(env, target, continuationText, { messageId: "owned-recovery" });
  const nextOutcome = createOwnedOutcomeState({
    target,
    founderRequest,
    taskId: nextDispatch.taskId,
    previous: assessed
  });
  await writeConversationSession(chatId, {
    last_target: target,
    last_task_id: nextDispatch.taskId,
    last_task_type: "OWNED_PROBLEM_RECOVERY",
    task_state: nextOutcome.stage,
    owned_outcome: nextOutcome,
    unresolved_question: founderRequest
  }, env);
  if (target === "rio") await handleRioRoundTrip(env, chatId, nextDispatch, replyToMessageId);
  else if (target === "tony_stark") await handleTonyRoundTrip(env, chatId, nextDispatch, replyToMessageId);
  else if (target === "aura3") await handleAura3RoundTrip(env, chatId, nextDispatch, replyToMessageId);
  return true;
}
__name(maybeContinueOwnedOutcome, "maybeContinueOwnedOutcome");
async function sendNaturalDepartmentResult(env, chatId, target, rawReport, replyToMessageId) {
  const session = await readConversationSession(chatId, env);
  const founderQuestion = session?.unresolved_question || session?.active_issue || session?.last_founder_text || "";
  let reply = naturalResultFallback(target, rawReport);
  if (env.ENABLE_AI_INFERENCE === "true") {
    try {
      reply = await askModel(
        env,
        "Rewrite verified department evidence into a natural Founder-facing answer. Follow the supplied rules exactly; never invent or upgrade evidence.",
        buildNaturalResultPrompt(target, founderQuestion, rawReport)
      );
    } catch (error) {
      console.error("Natural Founder result synthesis failed:", safeErrorMessage(error));
    }
  }
  const finalSession = await readConversationSession(chatId, env);
  await writeConversationSession(chatId, {
    last_victor_reply: reply,
    unresolved_question: finalSession?.owned_outcome?.objective_achieved === true ? null : finalSession?.unresolved_question || null,
    task_state: finalSession?.owned_outcome?.stage || "RESULT_VERIFIED"
  }, env);
  await sendTelegramMessage(env, chatId, reply, replyToMessageId);
}
__name(sendNaturalDepartmentResult, "sendNaturalDepartmentResult");
async function readConversationSession(chatId, env = {}) {
  try {
    const record = await readConversationState(env, chatId);
    return record.state || {};
  } catch (_) {
    return {};
  }
}
__name(readConversationSession, "readConversationSession");
async function writeConversationSession(chatId, next, env = {}) {
  try {
    await writeConversationState(env, chatId, next || {});
  } catch (_) {
  }
}
__name(writeConversationSession, "writeConversationSession");
function buildV2DispatchPreflight(target, traceId) {
  const normalizedTarget = ["rio", "tony_stark", "aura3", "hulk"].includes(target) ? target : "internal";
  const goal = { goal_id: `telegram:${traceId}`, allowed_departments: [normalizedTarget] };
  const contract = buildActionContract({ goal, target: normalizedTarget, runtimePhase: "EXECUTE", actionId: `${traceId}:${normalizedTarget}` });
  const contractValidation = validateActionContract(contract, goal);
  if (!contractValidation.ok) return { allowed: false, reason: `ACTION_CONTRACT_INVALID:${contractValidation.errors.join(",")}`, contract };
  const lease = issueCapabilityLease({
    capability_id: "sandbox.execute",
    objective_id: contract.objective_id,
    action_id: contract.action_id,
    action_contract_authorized: true,
    ttl_seconds: 300
  });
  if (!lease.issued) return { allowed: false, reason: `CAPABILITY_DENIED:${lease.reason}`, contract, lease };
  const leaseValidation = validateCapabilityLease(lease, {
    objective_id: contract.objective_id,
    action_id: contract.action_id,
    capability_id: "sandbox.execute"
  });
  if (!leaseValidation.valid) return { allowed: false, reason: `CAPABILITY_INVALID:${leaseValidation.reason}`, contract, lease };
  return { allowed: true, reason: "V2_PREFLIGHT_ALLOWED", contract, lease };
}
__name(buildV2DispatchPreflight, "buildV2DispatchPreflight");
async function executeCrossDepartmentPlan(env, ctx, chatId, plan, replyToMessageId) {
  const dispatched = [];
  const failed = [];
  for (const step of plan.steps || []) {
    const target = step.target;
    try {
      const v2Preflight = buildV2DispatchPreflight(target, `cross:${replyToMessageId || "none"}:${target}`);
      if (!v2Preflight.allowed) {
        failed.push({ target, reason: v2Preflight.reason });
        continue;
      }
      const pause = await isExecutionPaused(env, target);
      if (pause.paused) {
        failed.push({ target, reason: "PAUSED" });
        continue;
      }
      let dispatch;
      if (target === "rio") {
        if (!rioBridgeConfigured(env)) throw new Error("RIO_BRIDGE_NOT_CONFIGURED");
        dispatch = await dispatchRioTask(env, step.founder_text, { replyToMessageId });
        ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, replyToMessageId));
      } else if (target === "tony_stark") {
        if (!tonyBridgeConfigured(env)) throw new Error("TONY_BRIDGE_NOT_CONFIGURED");
        dispatch = await dispatchTonyTask(env, step.founder_text, { replyToMessageId });
        ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, replyToMessageId));
      } else if (target === "aura3") {
        if (!aura3BridgeConfigured(env)) throw new Error("AURA3_BRIDGE_NOT_CONFIGURED");
        dispatch = await dispatchAura3Task(env, step.founder_text, { replyToMessageId });
        ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, replyToMessageId));
      } else {
        failed.push({ target, reason: "UNSUPPORTED_TARGET" });
        continue;
      }
      dispatched.push({ target, task_id: dispatch.taskId, task_type: dispatch.taskType || "CROSS_DEPARTMENT_ACTION" });
    } catch (error) {
      console.error("Cross-department dispatch failed:", target, safeErrorMessage(error));
      failed.push({ target, reason: "DISPATCH_FAILED" });
    }
  }
  return { version: plan.version, requested_outcome: plan.requested_outcome, dispatched, failed };
}
__name(executeCrossDepartmentPlan, "executeCrossDepartmentPlan");
async function dispatchContextualInvestigation(env, target, investigationText, metadata = {}) {
  if (target === "rio") {
    if (!rioBridgeConfigured(env)) throw new Error("RIO_BRIDGE_NOT_CONFIGURED");
    return dispatchRioTask(env, investigationText, metadata);
  }
  if (target === "tony_stark") {
    if (!tonyBridgeConfigured(env)) throw new Error("TONY_BRIDGE_NOT_CONFIGURED");
    return dispatchTonyTask(env, investigationText, metadata);
  }
  if (target === "aura3") {
    if (!aura3BridgeConfigured(env)) throw new Error("AURA3_BRIDGE_NOT_CONFIGURED");
    return dispatchAura3Task(env, investigationText, metadata);
  }
  throw new Error("CONTEXTUAL_INVESTIGATION_TARGET_UNSUPPORTED");
}
__name(dispatchContextualInvestigation, "dispatchContextualInvestigation");
async function answerExistingDepartmentTask(env, chatId, followUp, session, replyToMessageId) {
  const target = followUp?.target || session?.last_target;
  const taskId = followUp?.task_id || session?.last_task_id;
  if (!target || !taskId) return false;
  try {
    let received;
    let verification;
    let report;
    if (target === "rio") {
      received = await waitForRioResult(taskId, { attempts: 1, delayMs: 0 });
      if (received.status === "RESULT_RECEIVED") {
        verification = verifyRioResult(received.result, taskId);
        if (verification.ok) report = formatRioResultForFounder(received.result);
      }
    } else if (target === "tony_stark") {
      received = await waitForTonyResult(taskId, env, { attempts: 1, delayMs: 0 });
      if (received.status === "RESULT_RECEIVED") {
        verification = verifyTonyResult(received.result, taskId);
        if (verification.ok) report = formatTonyResultForFounder(received.result);
      }
    } else if (target === "aura3") {
      received = await waitForAura3Result(taskId, { attempts: 1, delayMs: 0 });
      if (received.status === "RESULT_RECEIVED") {
        verification = verifyAura3Result(received.result, taskId);
        if (verification.ok) report = formatAura3ResultForFounder(received.result);
      }
    } else {
      return false;
    }
    if (report) {
      await writeConversationSession(chatId, { last_target: target, last_task_id: taskId, task_state: "RESULT_VERIFIED" }, env);
      await sendNaturalDepartmentResult(env, chatId, target, report, replyToMessageId);
      return true;
    }
    await sendTelegramMessage(env, chatId, naturalPendingReply(target), replyToMessageId);
    return true;
  } catch (error) {
    console.error("Existing task status lookup failed:", safeErrorMessage(error));
    await sendTelegramMessage(env, chatId, `Existing task ${taskId} ka fresh status abhi verify nahi hua. Victor naya duplicate task dispatch nahi karega; same task ko track karega.`, replyToMessageId);
    return true;
  }
}
__name(answerExistingDepartmentTask, "answerExistingDepartmentTask");
function memoryAcknowledgement(status) {
  if (status === "PERSISTED") return "Record ho gaya. Founder instruction permanent memory mein save kar diya gaya hai.";
  if (status === "ALREADY_PRESENT") return "Ye instruction permanent memory mein already recorded hai.";
  if (status === "PENDING_CONFIGURATION") return "Record nahi hua. Permanent memory write configuration complete nahi hai.";
  if (status === "CONFLICT_RETRY_REQUIRED") return "Record abhi confirm nahi hua. Memory write conflict aaya hai; retry required hai.";
  if (status === "FAILED") return "Record nahi hua. Memory persistence fail hui hai; main ise saved claim nahi karunga.";
  return "Memory write request process nahi hui.";
}
__name(memoryAcknowledgement, "memoryAcknowledgement");
function isGreeting(text3) {
  const normalized = text3.toLowerCase().replace(/[!.?,]+/g, "").trim();
  return (/* @__PURE__ */ new Set(["hi", "hello", "hey", "hii", "hiii", "namaste", "namaskar", "good morning", "good afternoon", "good evening"])).has(normalized);
}
__name(isGreeting, "isGreeting");
async function loadVictorCore() {
  const cache = caches.default;
  const cacheKey = new Request("https://victor.internal/core-context-v7-bridge");
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();
  const results = await Promise.all(CORE_SOURCES.map(async ([name, path, required]) => {
    try {
      const res = await fetch(`${RAW_BASE2}/${path}`, { headers: { "User-Agent": "Dr-Victor-Telegram-Core/7.0" } });
      if (!res.ok) return { name, path, required, ok: false, status: res.status, text: "" };
      const text3 = await res.text();
      return { name, path, required, ok: Boolean(text3.trim()), status: res.status, text: text3 };
    } catch (error) {
      return { name, path, required, ok: false, status: 0, text: "", error: error?.name || "FetchError" };
    }
  }));
  const requiredSourcesOk = results.filter((r) => r.required).every((r) => r.ok);
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));
  const payload = {
    ready: requiredSourcesOk,
    requiredSourcesOk,
    sourceStatus: results.map(({ name, path, required, ok, status }) => ({ name, path, required, ok, status })),
    sourceRecords: results,
    context: results.filter((r) => r.ok && !["FOUNDER_MEMORY", "DECISIONS", "LONG_TERM_MEMORY", "ACTIVE_PROJECTS_MEMORY", "WORKING_MEMORY", "LEARNINGS_MEMORY", "OPERATIONAL_MEMORY", "ACTIVITY_MEMORY", "MEMORY_INDEX_MD", "MEMORY_INDEX"].includes(r.name)).map((r) => `
===== ${r.name} :: ${r.path} =====
${r.text}`).join("\n"),
    architectureLockLoaded: Boolean(byName.ARCHITECTURE_LOCK?.ok)
  };
  const response = new Response(JSON.stringify(payload), { headers: { "Cache-Control": "public, max-age=120" } });
  await cache.put(cacheKey, response.clone());
  return payload;
}
__name(loadVictorCore, "loadVictorCore");
async function planFounderRequest(env, text3, replyContext = "", activeSession = {}) {
  const system = `
You are Victor's request planner. Understand the Founder's intent like a normal AI.
Return ONLY one JSON object, no prose.

ACTIVE WORKING THREAD:
${formatActiveContextForPrompt(activeSession)}

Continuity rule: short, elliptical or pronoun-based messages normally refer to this active thread unless the Founder clearly starts a new topic. Do not reset context merely because the current message omits the department or task name.

Modes:
- CHAT: normal conversation, story, explanation, brainstorming, general question.
- DEPARTMENT_STATUS: asks current/fresh/status/result/facts about RIO, Tony Stark or AURA3.
- DEPARTMENT_ACTION: asks to fix, run, start, stop, recover, build, change, execute or otherwise act on RIO, Tony Stark or AURA3.
- EXECUTIVE_GOAL: organization-level objective/strategy/root-cause/replanning request that Victor should manage across departments.

Important semantic guard:
- Operating preference/direction such as 'focus on operation, not payment' is NOT an EXECUTIVE_GOAL trigger by itself. It is handled before this planner.
- Do not reinterpret a Founder preference statement as permission to run the currently active goal.

Targets: rio, tony_stark, aura3, hulk, or null. HULK is intercepted before planner execution; never map HULK to RIO.
Rules:
- A department name inside an explanation does NOT make it an action.
- "Tell me what departments do" is CHAT.
- "AURA3 system thik karo" is DEPARTMENT_ACTION target aura3.
- "RIO ne kitne posts publish kiye" is DEPARTMENT_STATUS target rio.
- "Tony ko RIO website me help karne bolo" is DEPARTMENT_ACTION target tony_stark.
- Casual conversation stays CHAT even though Victor is an orchestrator.

Schema: {"mode":"CHAT|DEPARTMENT_STATUS|DEPARTMENT_ACTION|EXECUTIVE_GOAL","target":"rio|tony_stark|aura3|hulk|null","reason":"short"}
`;
  const content = await askModel(env, system, `${replyContext ? `Previous message: ${replyContext}
` : ""}Founder: ${text3}`);
  const cleaned = content.replace(/```json|```/gi, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    parsed = null;
  }
  const allowedModes = /* @__PURE__ */ new Set(["CHAT", "DEPARTMENT_STATUS", "DEPARTMENT_ACTION", "EXECUTIVE_GOAL"]);
  const allowedTargets = /* @__PURE__ */ new Set(["rio", "tony_stark", "aura3", "hulk", null]);
  if (!parsed || !allowedModes.has(parsed.mode) || !allowedTargets.has(parsed.target ?? null)) {
    const entity = resolveFounderEntityQuery(text3);
    const target = ["rio", "tony_stark", "aura3"].includes(entity?.entity_id) ? entity.entity_id : null;
    return { mode: target ? "DEPARTMENT_STATUS" : "CHAT", target, reason: "planner_fallback" };
  }
  return { mode: parsed.mode, target: parsed.target ?? null, reason: String(parsed.reason || "").slice(0, 160) };
}
__name(planFounderRequest, "planFounderRequest");
async function callVictorCore(env, userMessage, requestFacts, activeSession = {}) {
  if (!env.API_VICTOR) throw codedError("AI_CREDENTIAL_MISSING", "API_VICTOR is not configured");
  const core = await loadVictorCore();
  if (!core.ready || !core.architectureLockLoaded) throw codedError("CORE_CONTEXT_UNAVAILABLE", "Victor canonical governance context unavailable");
  const semanticMemory = await recallVictorMemory(
    env,
    userMessage,
    buildMemoryContext(userMessage, core.sourceRecords, 6),
    { topK: 5 }
  );
  const rememberedFact = selectDirectRememberedFact(userMessage, semanticMemory.cogneeMemory, core.sourceRecords);
  if (rememberedFact.matched) {
    console.log(JSON.stringify({
      event: "VICTOR_MEMORY_DIRECT_ANSWER",
      provider: "COGNEE",
      semantic_result_count: semanticMemory.cogneeMemory.length,
      canonical_contradiction: false,
      secrets_exposed: false
    }));
    return renderRememberedFactForFounder(userMessage, rememberedFact.answer);
  }
  const intent = classifyFounderMessage(userMessage);
  if (isNaturalConversationIntent(intent, userMessage)) {
    return callVictorNatural(env, userMessage, core.sourceRecords);
  }
  const entity = resolveFounderEntityQuery(userMessage);
  const facts = {
    ...requestFacts,
    resolvedDepartmentId: entity.entity_id,
    resolvedDepartmentName: entity.canonical_name,
    entityResolutionReason: entity.reason
  };
  const truthSnapshot = buildTruthSnapshot(core.sourceRecords, facts);
  const memory = semanticMemory;
  const entityDirective = entity.matched ? `FOUNDER ENTITY RESOLUTION: The message target is ${entity.canonical_name} (${entity.entity_id}) because ${entity.reason}. Answer for this target only. If target is AURA3, do not mention AURA2 unless Founder explicitly asked for comparison.` : "FOUNDER ENTITY RESOLUTION: no special alias matched.";
  const system = `
You are Dr. Victor, Founder Vicky's AI assistant and executive orchestration intelligence. Telegram is the Founder communication transport. Speak naturally while preserving evidence and authority boundaries.

${buildPrecedenceDirective()}
${buildTruthContract(intent, truthSnapshot)}

${entityDirective}

ACTIVE WORKING THREAD:
${formatActiveContextForPrompt(activeSession)}

THREAD CONTINUITY CONTRACT:
- Treat the active thread as the default referent for short follow-ups such as 'pata karke batao', 'iska kya hua', 'kyu', 'status?', 'continue', or 'thik karo'.
- A new explicit department/topic may replace the active thread.
- Working-thread memory is conversational context, not proof of external state; current operational facts still require fresh evidence.
- Do not contradict a recent Founder correction unless newer explicit Founder wording changes it.

MEMORY CONTRACT:
- Relevant memory is supporting context, not proof of current external state.
- Explicit newer Founder instructions override older conflicting memories.
- Never invent a remembered preference or decision.
- Never claim memory was recorded unless the runtime write path actually confirmed persistence.
- Never expose credentials, secrets, tokens or hidden sensitive values from memory.
${memory.prompt}

${buildNonRepetitionDirective(activeSession)}

RUNTIME RULES:
1. Founder authority is supreme. Never silently expand authority.
2. Truth before appearance. Never claim LIVE, completed, connected, revenue, health or external success without verified evidence.
3. AI/provider is reasoning only. It cannot rewrite Founder authority, locked objectives, security, cost rules or validators.
4. Telegram itself does not execute consequential department/external side effects. A separately governed diagnostic bridge may communicate with a department for status/report/evidence without granting production authority.
5. For normal knowledge questions answer naturally. For system questions ground answers in the resolved target, truth snapshot and canonical context.
6. Respond in the user's language/style, concise by default. Never reveal secrets.
7. TELEGRAM FORMAT IS PLAIN TEXT ONLY. No Markdown syntax, markdown tables, headings, blockquotes or code fences.
8. Prefer direct executive answers. Conclusion first; minimum supporting facts only.

CANONICAL VICTOR CONTEXT:
${core.context}
`;
  let reply = await askModel(env, system, userMessage);
  let validation = validateVictorReply(reply, intent, truthSnapshot);
  if (!validation.ok) {
    const correction = buildCorrectionPrompt(validation.violations, intent, truthSnapshot);
    reply = await askModel(env, `${system}
${correction}`, userMessage);
    validation = validateVictorReply(reply, intent, truthSnapshot);
  }
  if (!validation.ok) {
    const rejectedViolations = [...validation.violations];
    const fallback = buildTruthGuardFallback(intent, truthSnapshot, userMessage);
    const fallbackValidation = validateVictorReply(fallback, intent, truthSnapshot);
    if (fallbackValidation.ok) {
      console.warn(JSON.stringify({
        event: "VICTOR_TRUTH_GUARD_SAFE_FALLBACK",
        rejected_violations: rejectedViolations,
        fallback_source: "DETERMINISTIC_CANONICAL_FACTS",
        secrets_exposed: false
      }));
      return fallback;
    }
    throw codedError("TRUTH_GUARD_REJECTED", `Victor truth guard rejected reply: ${rejectedViolations.join(",")}`);
  }
  return reply;
}
__name(callVictorCore, "callVictorCore");
function buildTruthGuardFallback(intent, truthSnapshot = {}, userMessage = "") {
  const requestFacts = truthSnapshot?.request_facts || {};
  const resolved = truthSnapshot?.resolved_department;
  if (String(intent || "").startsWith("SYSTEM_QUERY") && resolved?.id) {
    const status = resolved.registry_status || "UNKNOWN";
    const connection = resolved.victor_connection || "NOT_VERIFIED";
    return `${resolved.name || resolved.id} ka canonical status ${status} hai. Victor connection evidence: ${connection}. Ye answer canonical records se deterministic tarike se bana hai.`;
  }
  if (String(intent || "").startsWith("SYSTEM_QUERY")) {
    const asksOrganizationStatus = /\b(sab(?:ka|ki|ke)?|all|system|organization|organisation|department|status)\b/i.test(userMessage);
    const departments = Array.isArray(truthSnapshot?.departments) ? truthSnapshot.departments : [];
    if (asksOrganizationStatus && departments.length) {
      const priorityIds = ["rio", "aura3", "aura2", "tony_stark", "hulk"];
      const names = { rio: "RIO", aura3: "AURA3", aura2: "AURA2", tony_stark: "Tony", hulk: "HULK" };
      const parts = priorityIds.map((id) => {
        const department = departments.find((item) => item.id === id);
        return department ? `${names[id]} ${department.registry_status || "UNKNOWN"}` : null;
      }).filter(Boolean);
      const remainingUnverified = departments.filter((item) => !priorityIds.includes(item.id) && item.registry_status === "UNVERIFIED").length;
      const suffix = remainingUnverified ? `; baaki ${remainingUnverified} departments UNVERIFIED hain` : "";
      return `Victor READY hai. ${parts.join(", ")}${suffix}. Ye canonical status hai; fresh business results alag evidence se verify honge.`;
    }
    const telegramFact = requestFacts.telegram_message_received_now ? "Telegram request abhi receive hui hai" : "Telegram request evidence available nahi hai";
    return `Victor online hai. ${telegramFact}, canonical core context loaded hai, aur AI provider ne response diya. Truth guard active hai.`;
  }
  return "Request receive hui, lekin generated draft truth verification pass nahi kar saka. Main unsupported claim nahi karunga; request ko specific status ya department ke saath dobara bhejiye.";
}
__name(buildTruthGuardFallback, "buildTruthGuardFallback");
function isNaturalConversationIntent(intent, text3) {
  const value = String(text3 || "").trim();
  if (intent === "GENERAL_CONVERSATION" || intent === "IDENTITY_QUERY") return true;
  const explanatory = /\b(kya\s+karta|kya\s+karti|kaun\s+kya|role|roles|kaam\s+kya|kya\s+kaam|about|bare\s+me\s+batao|baare\s+me\s+batao|samjhao|explain)\b/i.test(value);
  const operational = /\b(status|current|latest|fresh|live|health|healthy|check|verify|evidence|issue|problem|blocker|fix|repair|recover|thik|theek|execute|run|deploy|publish|start|stop|pause|resume|revenue|progress)\b/i.test(value);
  return String(intent || "").startsWith("SYSTEM_QUERY") && explanatory && !operational;
}
__name(isNaturalConversationIntent, "isNaturalConversationIntent");
async function callVictorNatural(env, userMessage, sourceRecords = []) {
  const registry = sourceRecords.find((record) => record?.name === "DEPARTMENT_REGISTRY" && record?.ok)?.text || "";
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
${registry.slice(0, 14e3)}
`;
  return askModel(env, system, userMessage);
}
__name(callVictorNatural, "callVictorNatural");
async function askModel(env, system, userMessage) {
  const integritySystem = `${system}

INDEPENDENT RESPONSE INTEGRITY LOCK \u2014 MANDATORY:
- Report evidence exactly as observed; never change, soften, amplify, or reframe evidence to make an outcome look better or worse.
- Never turn an assumption, absence of an error, configured credential, empty target list, cached state, historical record, or model-generated statement into PASS/SUCCESS/ACTIVE/VERIFIED.
- If a requested fact was not independently observed, say UNVERIFIED / NOT OBSERVED / UNKNOWN.
- Keep raw evidence and interpretation separate. If they conflict, raw fresh evidence wins.
- Never invent a selected model, response, 2xx status, timestamp, target, receipt, heartbeat, deployment state, or business outcome.
- A self-report by Victor, a department, memory, or another model is not independent proof of external runtime state.
- If something is wrong, state what is wrong; do not cosmetically rewrite the result. Fixing happens as a separate action, never by manipulating the report.
- Never expose credentials or secrets.

${buildNaturalReplyDirective()}`;
  const verifyEvidenceIntegrity = /* @__PURE__ */ __name((content) => {
    const claimsSuccess = /\b(pass|passed|success|successful|verified|active|healthy|live)\b/i.test(content);
    const assumptionEvidence = /\b(assum(?:e|ed|ing)|assume kiya|no error|error nahi|error not seen|error nahi dikh)\b/i.test(content);
    const nullEvidence = /\b(?:selected model|model|result|inference result)\s*:\s*(?:null|unknown|not specified|none)\b/i.test(content);
    if (claimsSuccess && (assumptionEvidence || nullEvidence)) {
      throw Object.assign(new Error("Success claim is not independently supported by observed evidence"), {
        code: "INDEPENDENT_EVIDENCE_REQUIRED"
      });
    }
  }, "verifyEvidenceIntegrity");
  try {
    let result = await callVictorModel(env, integritySystem, userMessage);
    let content = String(result.content || "").trim();
    verifyEvidenceIntegrity(content);
    let style = assessReplyNaturalness(content, userMessage);
    let styleRetry = false;
    if (!style.ok) {
      styleRetry = true;
      const retrySystem = `${integritySystem}

The previous draft was rejected for scripted/template style only. Generate a fresh answer from the same evidence and the Founder message. Do not copy the rejected structure. No Note:, Summary:, Current state:, Next step:, generic CTA, follow-up offer, checklist, or status-dump wrapper unless explicitly requested. Preserve factual evidence exactly.`;
      result = await callVictorModel(env, retrySystem, userMessage, {
        task: result.task,
        temperature: 0.05
      });
      content = String(result.content || "").trim();
      verifyEvidenceIntegrity(content);
      style = assessReplyNaturalness(content, userMessage);
      if (!style.ok) {
        const error = new Error(`Scripted reply style remained after regeneration: ${style.violations.join(",")}`);
        error.code = "SCRIPTED_REPLY_BLOCKED";
        error.replyStyleViolations = style.violations;
        throw error;
      }
    }
    console.log(JSON.stringify({
      event: "VICTOR_MODEL_ROUTE",
      task: result.task,
      model: result.model,
      discovery_status: result.discovery_status,
      fallback_attempts: result.failures?.length || 0,
      response_integrity: "INDEPENDENT_EVIDENCE_LOCK_V1",
      reply_style_guard: "NATURAL_DIRECT_V1",
      style_retry: styleRetry,
      secrets_exposed: false
    }));
    return content;
  } catch (error) {
    if (error?.code === "AI_CREDENTIAL_MISSING") throw codedError("AI_CREDENTIAL_MISSING", "API_VICTOR is not configured");
    if (error?.code === "INDEPENDENT_EVIDENCE_REQUIRED") {
      throw codedError("INDEPENDENT_EVIDENCE_REQUIRED", "Victor draft blocked because the claimed outcome was not independently supported by observed evidence");
    }
    if (error?.code === "SCRIPTED_REPLY_BLOCKED") {
      const blocked = codedError("SCRIPTED_REPLY_BLOCKED", "Victor draft blocked because it remained scripted/template-style after one clean regeneration");
      blocked.replyStyleViolations = error.replyStyleViolations || [];
      throw blocked;
    }
    const routed = codedError(error?.code || "AI_MODEL_ROUTER_EXHAUSTED", "Victor specialist model router could not obtain a verified response");
    if (Array.isArray(error?.modelFailures)) routed.modelFailures = error.modelFailures;
    throw routed;
  }
}
__name(askModel, "askModel");
function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
__name(codedError, "codedError");
function buildTraceId(updateId, messageId) {
  const updatePart = Number.isInteger(updateId) ? updateId : "na";
  const messagePart = Number.isInteger(messageId) ? messageId : "na";
  return `tg-${updatePart}-${messagePart}`;
}
__name(buildTraceId, "buildTraceId");
function classifyProcessingError(error, stage = "UNKNOWN") {
  const knownCode = typeof error?.code === "string" ? error.code : "";
  let category = knownCode || "PROCESSING_FAILED";
  if (!knownCode && stage === "TELEGRAM_DELIVERY") category = "TELEGRAM_DELIVERY_FAILED";
  else if (!knownCode && stage === "MEMORY_WRITE") category = "MEMORY_PROCESSING_FAILED";
  else if (!knownCode && ["DEPARTMENT_ROUTING", "DEPARTMENT_EXECUTION"].includes(stage)) category = "DEPARTMENT_ROUTING_FAILED";
  const messages = {
    AI_CREDENTIAL_MISSING: "Victor ki AI credential configuration missing hai.",
    CORE_CONTEXT_UNAVAILABLE: "Victor ka canonical core context load nahi ho pa raha.",
    AI_UPSTREAM_TIMEOUT: "Victor ka AI provider time par response nahi de raha.",
    AI_UPSTREAM_UNREACHABLE: "Victor ka AI provider abhi reachable nahi hai.",
    AI_UPSTREAM_HTTP_ERROR: `Victor ke AI provider ne request reject ki${error?.upstreamHttpStatus ? ` (HTTP ${error.upstreamHttpStatus})` : ""}.`,
    AI_UPSTREAM_INVALID_RESPONSE: "Victor ke AI provider se invalid response mila.",
    AI_UPSTREAM_EMPTY_RESPONSE: "Victor ke AI provider se blank response mila.",
    AI_MODEL_ROUTER_EXHAUSTED: "Victor ne available specialist models try kiye, lekin koi verified compatible response nahi mila.",
    INDEPENDENT_EVIDENCE_REQUIRED: "Victor ka draft block hua kyunki claimed result independent fresh evidence se prove nahi tha.",
    SCRIPTED_REPLY_BLOCKED: "Victor ka reply scripted/template-style raha, isliye delivery block kar di gayi.",
    TRUTH_GUARD_REJECTED: "Victor ka generated reply truth verification pass nahi kar saka.",
    TELEGRAM_DELIVERY_FAILED: "Victor reply bana chuka tha, lekin Telegram delivery fail hui.",
    MEMORY_PROCESSING_FAILED: "Victor memory processing stage par error aaya.",
    DEPARTMENT_ROUTING_FAILED: "Victor department routing stage par error aaya.",
    PROCESSING_FAILED: "Victor processing me unexpected error aaya."
  };
  return {
    category,
    stage,
    upstreamHttpStatus: Number.isInteger(error?.upstreamHttpStatus) ? error.upstreamHttpStatus : null,
    founderMessage: /* @__PURE__ */ __name((traceId) => `${messages[category] || messages.PROCESSING_FAILED} Main guess nahi karunga. Diagnostic code: ${category}; Trace: ${traceId}.`, "founderMessage")
  };
}
__name(classifyProcessingError, "classifyProcessingError");
function safeErrorMessage(error) {
  return String(error?.message || "unknown").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 300);
}
__name(safeErrorMessage, "safeErrorMessage");
function normalizeTelegramText(value) {
  let text3 = String(value || "");
  text3 = text3.replace(/```[a-zA-Z0-9_-]*\n?/g, "");
  text3 = text3.replace(/```/g, "");
  text3 = text3.replace(/\*\*(.*?)\*\*/gs, "$1");
  text3 = text3.replace(/__(.*?)__/gs, "$1");
  text3 = text3.replace(/`([^`]+)`/g, "$1");
  text3 = text3.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  text3 = text3.replace(/^\s*>\s?/gm, "");
  text3 = text3.replace(/^\s*[-*_]{3,}\s*$/gm, "");
  text3 = text3.replace(/\n{3,}/g, "\n\n");
  return text3.trim();
}
__name(normalizeTelegramText, "normalizeTelegramText");
async function sendTelegramMessage(env, chatId, text3, replyToMessageId) {
  if (!env.TELEGRAM_BOT_TOKEN_VICTOR) throw new Error("TELEGRAM_BOT_TOKEN_VICTOR is not configured");
  const cleanText = normalizeTelegramText(text3);
  const body = { chat_id: chatId, text: cleanText.slice(0, 4096), allow_sending_without_reply: true };
  if (replyToMessageId) body.reply_parameters = { message_id: replyToMessageId };
  const response = await fetch(`${TELEGRAM_API2}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Telegram sendMessage HTTP ${response.status}`);
  try {
    const current = await readConversationSession(chatId, env);
    const withReply = appendRecentTurn({ ...current, last_victor_reply: cleanText.slice(0, 1200) }, "victor", cleanText.slice(0, 1200));
    await writeConversationSession(chatId, withReply, env);
  } catch (_) {
  }
}
__name(sendTelegramMessage, "sendTelegramMessage");
function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
function isAuthorizedFounderMessage(env, chatId, senderId) {
  const founderChatId = String(env?.VICTOR_FOUNDER_CHAT_ID || "");
  const managementChatId = String(env?.TELEGRAM_MANAGEMENT_CHAT_ID || "");
  if (!founderChatId) return false;
  if (String(chatId) === founderChatId) return true;
  return Boolean(managementChatId) && String(chatId) === managementChatId && String(senderId) === founderChatId;
}
__name(isAuthorizedFounderMessage, "isAuthorizedFounderMessage");
function shouldRunDeadEndRecovery(memoryDirective, explicitExecutiveGoalCommand, deadEnd) {
  return !memoryDirective && !explicitExecutiveGoalCommand && deadEnd?.matched === true && ["rio", "tony_stark", "aura3"].includes(deadEnd.target);
}
__name(shouldRunDeadEndRecovery, "shouldRunDeadEndRecovery");
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
__name(json, "json");
export {
  buildTruthGuardFallback,
  classifyProcessingError,
  worker_default as default,
  isAuthorizedFounderMessage,
  shouldRunDeadEndRecovery
};
//# sourceMappingURL=worker.js.map
