import {
  PRECEDENCE_VERSION,
  RESOLVED_RUNTIME_RULES,
  buildPrecedenceDirective,
  buildTruthContract,
  buildTruthSnapshot,
  buildCorrectionPrompt,
  classifyFounderMessage,
  validateVictorReply,
} from './core_rules.mjs';
import {
  buildMemoryContext,
  isExplicitMemoryDirective,
  persistExplicitFounderMemory,
  resolveFounderEntityQuery,
} from './memory_runtime.mjs';
import {
  aura3BridgeConfigured,
  shouldContactAura3,
  dispatchAura3Task,
  waitForAura3Result,
  verifyAura3Result,
  formatAura3ResultForFounder,
  tonyBridgeConfigured,
  shouldContactTony,
  dispatchTonyTask,
  waitForTonyResult,
  verifyTonyResult,
  formatTonyResultForFounder,
  rioBridgeConfigured,
  shouldContactRio,
  dispatchRioTask,
  waitForRioResult,
  verifyRioResult,
  formatRioResultForFounder,
} from './department_bridge.mjs';

import { autonomyConfigured, persistAutonomyEvidence, runAutonomousCycle } from './autonomy_runtime.mjs';
import { parseEmergencyCommand, applyEmergencyCommand, isExecutionPaused } from './emergency_pause_runtime.mjs';
import { resolveFounderIntent, founderDirectionReply, clarificationFallback } from '../brain/founder_intent.mjs';
import { classifyConversationFollowUp, buildInvestigationTaskText, formatPendingTaskStatus } from '../brain/conversation_runtime.mjs';
import { buildActiveContext, appendRecentTurn, formatActiveContextForPrompt } from '../brain/active_context.mjs';
import { naturalDispatchAcknowledgement, naturalInvestigationAcknowledgement, naturalPendingReply, buildNaturalResultPrompt, naturalResultFallback } from '../brain/founder_conversation.mjs';
import { classifyOwnedProblem, buildOwnedProblemPrompt, naturalOwnedProblemAck } from '../brain/problem_ownership.mjs';
import { classifyFactRequest, collectFactEvidence, buildFactAnswerPrompt } from '../brain/fact_runtime.mjs';
import { classifyHulkRequest, hulkActionBlockedReply, hulkStatusReply, isCasualWellbeing, casualWellbeingReply } from '../brain/hulk_guard.mjs';

const TELEGRAM_API = 'https://api.telegram.org';
const BEDROCK_BASE = 'https://bedrock-mantle.us-east-1.api.aws/v1';
const DEFAULT_MODEL = 'qwen.qwen3-coder-next';
const AI_REQUEST_TIMEOUT_MS = 25_000;
const RAW_BASE = 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main';

const CORE_SOURCES = [
  ['ARCHITECTURE_LOCK', 'docs/VICTOR_ARCHITECTURE_LOCK_INDEX.md', true],
  ['MASTER_RULE_BOOK', 'VICTOR_MASTER_RULE_BOOK.md', true],
  ['SOUL', 'VICTOR_SOUL.md', true],
  ['EXECUTIVE_CHARTER', 'VICTOR_EXECUTIVE_CHARTER.md', true],
  ['BUSINESS_PLAN', 'BUSINESS_PLAN.md', false],
  ['SYSTEM_STATE', 'data/system_state.json', false],
  ['DEPARTMENT_REGISTRY', 'data/department_registry.json', false],
  ['REPORT_CARD_POLICY', 'data/victor_report_card_policy.json', false],
  ['RUNTIME_OWNERSHIP', 'data/runtime_ownership.json', false],
  ['REVENUE_OUTCOMES', 'data/revenue_outcomes.json', false],
  ['AI_RUNTIME_STATUS', 'data/ai_runtime_status.json', false],
  ['TELEGRAM_RUNTIME_STATUS', 'data/telegram_runtime_status.json', false],
  ['FOUNDER_MEMORY', 'memory/founder_memory.json', false],
  ['DECISIONS', 'memory/decisions.jsonl', false],
  ['LONG_TERM_MEMORY', 'memory/MEMORY.md', false],
  ['ACTIVE_PROJECTS_MEMORY', 'memory/ACTIVE_PROJECTS.md', false],
  ['WORKING_MEMORY', 'memory/WORKING_MEMORY.md', false],
  ['LEARNINGS_MEMORY', 'memory/LEARNINGS.md', false],
  ['OPERATIONAL_MEMORY', 'memory/operational_memory.jsonl', false],
  ['ACTIVITY_MEMORY', 'memory/ACTIVITY_LOG.md', false],
  ['MEMORY_INDEX_MD', 'memory/INDEX.md', false],
  ['MEMORY_INDEX', 'memory/memory_index.json', false],
];

export default {
  async scheduled(controller, env, ctx) {
    let result;
    try {
      result = await runAutonomousCycle(controller, env);
    } catch (error) {
      result = {
        status: 'SAFE_STOP',
        target: null,
        error_code: sanitizeRuntimeError(error),
      };
    }
    await persistAutonomyEvidence(env, controller, result);
    console.log(JSON.stringify({
      event: 'VICTOR_AUTONOMOUS_CYCLE',
      cron: controller.cron,
      status: result.status,
      target: result.target || null,
      secrets_exposed: false,
    }));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        service: 'victor-telegram-webhook',
        status: 'READY',
        core_mode: 'GOVERNED_CANONICAL_CONTEXT',
        precedence_mode: PRECEDENCE_VERSION,
        truth_guard: 'DETERMINISTIC_V3',
        telegram_diagnostics: 'ACTIONABLE_V4_GROUP_STATUS_FIX',
        operating_mode: 'GOVERNED_SELF_MODE',
        founder_approval_gate: 'CREDENTIAL_ADMINISTRATION_ONLY',
        memory_recall_mode: 'LAYERED_REPO_MEMORY_V3',
        active_thread_memory: 'BEST_EFFORT_WORKING_CONTEXT_V1',
        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',
        fact_evidence_runtime: 'FRESH_GITHUB_FACTS_V1',
        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',
        memory_write_configured: Boolean(env.GITHUB_MEMORY_TOKEN),
        aura3_bridge_configured: aura3BridgeConfigured(env),
        tony_bridge_configured: tonyBridgeConfigured(env),
        tony_task_request_supported: true,
        tony_assignment_routing: 'EXPLICIT_TONY_PRIORITY_V2',
        tony_payload_contract: 'STRUCTURED_V5_REPO_NORMALIZED',
        rio_bridge_configured: rioBridgeConfigured(env),
        telegram_token_configured: Boolean(env.TELEGRAM_BOT_TOKEN_VICTOR),
        webhook_secret_configured: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
        founder_chat_configured: Boolean(env.VICTOR_FOUNDER_CHAT_ID),
        management_chat_configured: Boolean(env.TELEGRAM_MANAGEMENT_CHAT_ID),
        ai_inference_enabled: env.ENABLE_AI_INFERENCE === 'true',
        autonomy_requested_mode: 'AUTONOMOUS_MANAGED_ORCHESTRATOR',
        autonomy_runtime_configured: autonomyConfigured(env),
        autonomy_scheduler_bound: true,
        autonomy_supervision_interval_minutes: 15,
        autonomy_evidence_persistence: 'GITHUB_CANONICAL_STATE_V1',
        autonomy_reporting: 'ESCALATIONS_VERIFIED_SUCCESS_AND_DAILY_SUMMARY',
        telegram_brain_gateway: 'BRAIN_FIRST_FOR_EXECUTIVE_AND_CROSS_DEPARTMENT_COMMANDS_V1',
        victor_report_card_target: '10/10',
        victor_report_card_basis: 'VERIFIED_DEPARTMENT_FINAL_OUTCOMES_ONLY',
        direct_consequential_department_execution: false,
        governed_diagnostic_department_bridge: true,
      });
    }

    if (request.method === 'GET' && ['/aura3-bridge-health', '/aura3-bridge-health/', '/aura3-health', '/aura3-health/'].includes(url.pathname)) {
      if (!aura3BridgeConfigured(env)) {
        return json({ service: 'aura3-bridge', status: 'PENDING_CONFIGURATION', token_present: false }, 503);
      }
      const headers = {
        Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Dr-Victor-AURA3-Bridge-Health/1.0',
      };
      const repoUrl = 'https://api.github.com/repos/vickykenin-lang/aura-3.0';
      const workflowUrl = 'https://api.github.com/repos/vickykenin-lang/aura-3.0/actions/workflows/victor-aura3-transport.yml';
      const [repoResponse, workflowResponse] = await Promise.all([
        fetch(repoUrl, { headers }),
        fetch(workflowUrl, { headers }),
      ]);
      return json({
        service: 'aura3-bridge',
        status: repoResponse.ok && workflowResponse.ok ? 'READ_PATH_VERIFIED' : 'BLOCKED',
        token_present: true,
        repository_access_http: repoResponse.status,
        workflow_access_http: workflowResponse.status,
        workflow_dispatch_write: 'NOT_TESTED_BY_READ_ONLY_HEALTH_CHECK',
        expected_actions_permission: 'READ_AND_WRITE',
        expected_contents_permission: 'READ_ONLY_OR_HIGHER',
        secrets_exposed: false,
      }, repoResponse.ok && workflowResponse.ok ? 200 : 503);
    }

    if (request.method === 'GET' && ['/tony-bridge-health', '/tony-bridge-health/', '/tony-health', '/tony-health/'].includes(url.pathname)) {
      if (!tonyBridgeConfigured(env)) {
        return json({ service: 'tony-bridge', status: 'PENDING_CONFIGURATION', token_present: false }, 503);
      }
      const headers = {
        Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Dr-Victor-Tony-Bridge-Health/1.0',
      };
      const repoUrl = 'https://api.github.com/repos/vickykenin-lang/tony-stark-engineering';
      const workflowUrl = 'https://api.github.com/repos/vickykenin-lang/tony-stark-engineering/actions/workflows/victor_tony_transport.yml';
      const [repoResponse, workflowResponse] = await Promise.all([
        fetch(repoUrl, { headers }),
        fetch(workflowUrl, { headers }),
      ]);
      return json({
        service: 'tony-bridge',
        status: repoResponse.ok && workflowResponse.ok ? 'READ_PATH_VERIFIED' : 'BLOCKED',
        token_present: true,
        repository_access_http: repoResponse.status,
        workflow_access_http: workflowResponse.status,
        workflow_dispatch_write: 'NOT_TESTED_BY_READ_ONLY_HEALTH_CHECK',
        expected_actions_permission: 'READ_AND_WRITE',
        expected_contents_permission: 'READ_ONLY_OR_HIGHER',
        secrets_exposed: false,
      }, repoResponse.ok && workflowResponse.ok ? 200 : 503);
    }

    if (request.method === 'GET' && url.pathname === '/core-health') {
      const core = await loadVictorCore();
      return json({
        service: 'victor-core-context',
        status: core.ready ? 'READY' : 'SAFE_STOP',
        required_sources_ok: core.requiredSourcesOk,
        precedence_mode: PRECEDENCE_VERSION,
        truth_guard: 'DETERMINISTIC_V3',
        memory_sources: core.sourceStatus.filter(x => ['FOUNDER_MEMORY','DECISIONS','LONG_TERM_MEMORY','ACTIVE_PROJECTS_MEMORY','WORKING_MEMORY','LEARNINGS_MEMORY','OPERATIONAL_MEMORY','ACTIVITY_MEMORY','MEMORY_INDEX_MD','MEMORY_INDEX'].includes(x.name)),
        resolved_runtime_rules: RESOLVED_RUNTIME_RULES,
        sources: core.sourceStatus,
      }, core.ready ? 200 : 503);
    }

    if (request.method !== 'POST' || url.pathname !== '/telegram') return json({ error: 'not_found' }, 404);
    if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'webhook_secret_not_configured' }, 503);

    const suppliedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (!constantTimeEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET)) return json({ error: 'unauthorized' }, 401);

    let update;
    try { update = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

    const message = update?.message;
    if (!message || typeof message?.text !== 'string') return json({ ok: true, ignored: true });

    const chatId = String(message?.chat?.id ?? '');
    if (!chatId) return json({ ok: true, ignored: true });
    const senderId = String(message?.from?.id ?? '');
    if (!isAuthorizedFounderMessage(env, chatId, senderId)) {
      return json({ ok: true, ignored: true, reason: 'chat_not_authorized' });
    }

    const text = message.text.trim();
    if (!text) return json({ ok: true, ignored: true });

    const traceId = buildTraceId(update?.update_id, message.message_id);
    const emergencyCommand = parseEmergencyCommand(text);
    if (emergencyCommand) {
      try {
        const pauseResult = await applyEmergencyCommand(env, emergencyCommand, { chatId, messageId: message.message_id });
        const label = pauseResult.status === 'PAUSE_UNCONFIRMED'
          ? 'Emergency pause requested but RIO acknowledgement failed. Victor remains fail-closed for new dispatch; check RIO mirror before assuming organization-wide pause.'
          : `${pauseResult.status}: ${emergencyCommand.scope === 'system' ? 'SYSTEM' : emergencyCommand.department}. RIO mirror: ${pauseResult.rio_mirror}.`;
        await sendTelegramMessage(env, chatId, label, message.message_id);
        return json({ ok: true, emergency_pause: pauseResult.status, rio_mirror: pauseResult.rio_mirror });
      } catch (pauseError) {
        await sendTelegramMessage(env, chatId, 'Emergency pause command failed to persist. Treat execution state as unconfirmed; no success claimed.', message.message_id);
        return json({ ok: false, emergency_pause: 'FAILED' }, 503);
      }
    }
    let processingStage = 'REQUEST_ACCEPTED';

    try {
      processingStage = 'MEMORY_WRITE';
      let memoryWrite = { status: 'NOT_REQUESTED' };
      const memoryDirective = isExplicitMemoryDirective(text);
      if (memoryDirective) {
        try {
          memoryWrite = await persistExplicitFounderMemory(env, text, {
            chatId,
            messageId: message.message_id,
          });
        } catch (memoryError) {
          console.error('Victor memory persistence failed:', memoryError?.message || 'unknown');
          memoryWrite = { status: 'FAILED' };
        }
      }

      processingStage = 'REQUEST_PLANNING';
      const replyContext = message?.reply_to_message?.text || '';
      const session = await readConversationSession(chatId);
      const activePatch = buildActiveContext(session, { founderText: text, replyContext, messageId: message.message_id });
      const sessionWithFounderTurn = appendRecentTurn({ ...session, ...activePatch }, 'founder', text);
      await writeConversationSession(chatId, sessionWithFounderTurn);
      const deterministicIntent = resolveFounderIntent(text, replyContext);
      const contextualFollowUp = classifyConversationFollowUp(text, sessionWithFounderTurn);
      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);
      const factRequest = classifyFactRequest(text);
      const hulkRequest = classifyHulkRequest(text);

      if (!memoryDirective && isCasualWellbeing(text)) {
        await sendTelegramMessage(env, chatId, casualWellbeingReply(), message.message_id);
        return json({ ok: true, mode: 'CASUAL_WELLBEING' });
      }

      if (!memoryDirective && hulkRequest.matched) {
        await writeConversationSession(chatId, { last_target: 'hulk', last_founder_text: text, task_state: 'NO_VERIFIED_BRIDGE' });
        const reply = hulkRequest.mode === 'HULK_ACTION' ? hulkActionBlockedReply() : hulkStatusReply();
        await sendTelegramMessage(env, chatId, reply, message.message_id);
        return json({ ok: true, mode: hulkRequest.mode, target: 'hulk', dispatch: 'NOT_ATTEMPTED_BRIDGE_UNVERIFIED' });
      }

      if (!memoryDirective && factRequest.matched) {
        processingStage = 'FACT_RETRIEVAL';
        try {
          const evidence = await collectFactEvidence(env, text, factRequest);
          let reply;
          if (env.ENABLE_AI_INFERENCE === 'true' && env.API_VICTOR) {
            reply = await askModel(
              env,
              'Answer from fresh GitHub evidence only. Cover every sub-question. Be natural and concise; never replace facts with reassurance or a status template.',
              buildFactAnswerPrompt(text, evidence),
            );
          } else {
            reply = `Fresh evidence fetched at ${evidence.fetched_at_utc}. AI synthesis unavailable; raw fact retrieval succeeded.`;
          }
          await sendTelegramMessage(env, chatId, reply, message.message_id);
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY', targets: factRequest.targets });
        } catch (error) {
          console.error('Fresh fact retrieval failed:', safeErrorMessage(error));
          await sendTelegramMessage(env, chatId, 'Fresh evidence read fail hua. Main generic status line se gap cover nahi karunga; exact GitHub fact abhi verify nahi hua.', message.message_id);
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY_FAILED' });
        }
      }

      if (!memoryDirective && ownedProblem.matched) {
        const recoveryText = buildOwnedProblemPrompt(ownedProblem.target, text);
        const dispatch = await dispatchContextualInvestigation(env, ownedProblem.target, recoveryText, { messageId: message.message_id });
        await writeConversationSession(chatId, {
          last_target: ownedProblem.target,
          last_task_id: dispatch.taskId,
          last_task_type: 'OWNED_PROBLEM_RECOVERY',
          active_issue: text,
          unresolved_question: text,
          task_state: 'OWNED_RECOVERY_RUNNING',
        });
        await sendTelegramMessage(env, chatId, naturalOwnedProblemAck(ownedProblem.target), message.message_id);
        if (ownedProblem.target === 'rio') ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        else if (ownedProblem.target === 'tony_stark') ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        else if (ownedProblem.target === 'aura3') ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        return json({ ok: true, mode: ownedProblem.mode, target: ownedProblem.target, task_id: dispatch.taskId });
      }

      if (!memoryDirective && contextualFollowUp.mode === 'CONTEXTUAL_INVESTIGATION') {
        const investigationText = buildInvestigationTaskText(contextualFollowUp, sessionWithFounderTurn);
        const dispatch = await dispatchContextualInvestigation(env, contextualFollowUp.target, investigationText, { messageId: message.message_id });
        await writeConversationSession(chatId, {
          last_target: contextualFollowUp.target,
          last_task_id: dispatch.taskId,
          parent_task_id: contextualFollowUp.parent_task_id || contextualFollowUp.task_id || null,
          last_task_type: 'CONTEXTUAL_INVESTIGATION',
          active_issue: contextualFollowUp.query || text,
          unresolved_question: contextualFollowUp.query || text,
          task_state: 'PENDING_INVESTIGATION',
        });
        await sendTelegramMessage(env, chatId, naturalInvestigationAcknowledgement(contextualFollowUp.target, contextualFollowUp.query || text), message.message_id);
        if (contextualFollowUp.target === 'rio') ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        else if (contextualFollowUp.target === 'tony_stark') ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        else if (contextualFollowUp.target === 'aura3') ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, parent_task_id: contextualFollowUp.parent_task_id || null, task_id: dispatch.taskId });
      }

      if (!memoryDirective && contextualFollowUp.mode) {
        const handled = await answerExistingDepartmentTask(env, chatId, contextualFollowUp, sessionWithFounderTurn, message.message_id);
        if (handled) return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, task_id: contextualFollowUp.task_id });
      }

      if (!memoryDirective && deterministicIntent.mode === 'FOUNDER_DIRECTION') {
        await sendTelegramMessage(env, chatId, founderDirectionReply(), message.message_id);
        return json({ ok: true, mode: deterministicIntent.mode, reason: deterministicIntent.reason });
      }

      if (!memoryDirective && deterministicIntent.mode === 'CLARIFICATION') {
        let clarification = clarificationFallback(replyContext);
        if (replyContext && env.ENABLE_AI_INFERENCE === 'true') {
          clarification = await askModel(
            env,
            'Explain the immediately previous Victor reply to the Founder. Use the supplied previous reply as context. Do not greet, reintroduce yourself, change topic, or execute a new task. Answer concisely in the Founder language.',
            `Previous Victor reply: ${replyContext}\nFounder clarification: ${text}`,
          );
        }
        await sendTelegramMessage(env, chatId, clarification, message.message_id);
        return json({ ok: true, mode: deterministicIntent.mode, reason: deterministicIntent.reason });
      }

      const plan = await planFounderRequest(env, text, replyContext, sessionWithFounderTurn);

      if (!memoryDirective && plan.mode === 'EXECUTIVE_GOAL') {
        processingStage = 'EXECUTIVE_EXECUTION';
        const controller = { cron: 'founder-command', scheduledTime: Date.now() };
        const result = await runAutonomousCycle(controller, env);
        await persistAutonomyEvidence(env, controller, result);
        const assessment = result?.result?.assessment || {};
        const summary = [
          assessment.rootCause ? `Root cause: ${assessment.rootCause}` : null,
          assessment.solution ? `Decision: ${assessment.solution}` : null,
          assessment.nextAction ? `Next: ${assessment.nextAction}` : null,
          result?.result?.taskId ? `Task: ${result.result.taskId}` : null,
        ].filter(Boolean).join('\n');
        await sendTelegramMessage(env, chatId, summary || `Victor ne objective par executive cycle chala diya. Status: ${result.status}.`, message.message_id);
        return json({ ok: true, mode: plan.mode, result });
      }

      if (!memoryDirective && (plan.mode === 'DEPARTMENT_STATUS' || plan.mode === 'DEPARTMENT_ACTION')) {
        processingStage = 'DEPARTMENT_EXECUTION';
        const target = plan.target;

        if (plan.mode === 'DEPARTMENT_STATUS' && sessionWithFounderTurn?.last_target === target && sessionWithFounderTurn?.last_task_id) {
          const handled = await answerExistingDepartmentTask(env, chatId, { mode: 'TASK_STATUS_FOLLOWUP', target, task_id: sessionWithFounderTurn.last_task_id }, sessionWithFounderTurn, message.message_id);
          if (handled) return json({ ok: true, mode: 'DEPARTMENT_STATUS_REUSED', target, task_id: sessionWithFounderTurn.last_task_id });
        }

        if (target === 'rio') {
          const pause = await isExecutionPaused(env, 'rio');
          if (pause.paused) {
            await sendTelegramMessage(env, chatId, 'RIO paused hai; task dispatch nahi kiya.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, paused: true });
          }
          if (!rioBridgeConfigured(env)) {
            await sendTelegramMessage(env, chatId, 'RIO bridge configured nahi hai.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, configured: false });
          }
          let dispatch;
          try {
            dispatch = await dispatchRioTask(env, text, { messageId: message.message_id });
          } catch (error) {
            console.error('RIO dispatch failed:', safeErrorMessage(error));
            await sendTelegramMessage(env, chatId, 'RIO ko task dispatch nahi hua. Victor ne failure record kiya hai; duplicate retry nahi karega.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, dispatch: 'FAILED' });
          }
          await writeConversationSession(chatId, { last_target: 'rio', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' });
          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement('rio', text), message.message_id);
          ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
          return json({ ok: true, mode: plan.mode, target, task_id: dispatch.taskId });
        }

        if (target === 'tony_stark') {
          const pause = await isExecutionPaused(env, 'tony_stark');
          if (pause.paused) {
            await sendTelegramMessage(env, chatId, 'Tony paused hai; task dispatch nahi kiya.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, paused: true });
          }
          if (!tonyBridgeConfigured(env)) {
            await sendTelegramMessage(env, chatId, 'Tony bridge configured nahi hai.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, configured: false });
          }
          let dispatch;
          try {
            dispatch = await dispatchTonyTask(env, text, { messageId: message.message_id });
          } catch (error) {
            console.error('Tony dispatch failed:', safeErrorMessage(error));
            await sendTelegramMessage(env, chatId, 'Tony ko task dispatch nahi hua. Victor ne failure record kiya hai; duplicate retry nahi karega.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, dispatch: 'FAILED' });
          }
          await writeConversationSession(chatId, { last_target: 'tony_stark', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' });
          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement('tony_stark', text), message.message_id);
          ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
          return json({ ok: true, mode: plan.mode, target, task_id: dispatch.taskId });
        }

        if (target === 'aura3') {
          const pause = await isExecutionPaused(env, 'aura3');
          if (pause.paused) {
            await sendTelegramMessage(env, chatId, 'AURA3 paused hai; task dispatch nahi kiya.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, paused: true });
          }
          if (!aura3BridgeConfigured(env)) {
            await sendTelegramMessage(env, chatId, 'AURA3 bridge configured nahi hai.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, configured: false });
          }
          let dispatch;
          try {
            dispatch = await dispatchAura3Task(env, text, { messageId: message.message_id });
          } catch (error) {
            console.error('AURA3 dispatch failed:', safeErrorMessage(error));
            await sendTelegramMessage(env, chatId, 'AURA3 ko task dispatch nahi hua. Victor ne failure record kiya hai; duplicate retry nahi karega.', message.message_id);
            return json({ ok: true, mode: plan.mode, target, dispatch: 'FAILED' });
          }
          await writeConversationSession(chatId, { last_target: 'aura3', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' });
          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement('aura3', text), message.message_id);
          ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
          return json({ ok: true, mode: plan.mode, target, task_id: dispatch.taskId });
        }
      }

      let reply;
      processingStage = 'REPLY_GENERATION';
      if (memoryDirective) {
        reply = memoryAcknowledgement(memoryWrite.status);
      } else if (isGreeting(text)) {
        reply = 'Hi Vicky. Victor online hai. Bataiye, aap kya discuss karna chahte hain?';
      } else if (env.ENABLE_AI_INFERENCE === 'true') {
        processingStage = 'AI_INFERENCE';
        reply = await callVictorCore(env, text, {
          telegramWebhookAuthenticated: true,
          telegramMessageReceivedNow: true,
          diagnosticDepartmentBridgeAvailable: aura3BridgeConfigured(env) || tonyBridgeConfigured(env) || rioBridgeConfigured(env),
        }, sessionWithFounderTurn);
      } else {
        reply = 'Victor Telegram gateway connected hai, lekin AI inference disabled hai. Main paid inference Founder approval ke bina enable nahi karunga.';
      }

      processingStage = 'TELEGRAM_DELIVERY';
      await sendTelegramMessage(env, chatId, reply, message.message_id);
      console.log(JSON.stringify({
        event: 'VICTOR_TELEGRAM_PROCESSED',
        trace_id: traceId,
        status: 'SUCCESS',
        secrets_exposed: false,
      }));
      return json({ ok: true, memory_write: memoryWrite.status });
    } catch (error) {
      const diagnostic = classifyProcessingError(error, processingStage);
      console.error(JSON.stringify({
        event: 'VICTOR_TELEGRAM_PROCESSING_FAILED',
        trace_id: traceId,
        stage: diagnostic.stage,
        category: diagnostic.category,
        upstream_http_status: diagnostic.upstreamHttpStatus,
        error_name: error?.name || 'Error',
        error_message: safeErrorMessage(error),
        secrets_exposed: false,
      }));
      try {
        await sendTelegramMessage(env, chatId, diagnostic.founderMessage(traceId), message.message_id);
      } catch (_) {}
      return json({ ok: false, error: diagnostic.category, trace_id: traceId, acknowledged: true }, 200);
    }
  },
};

function sanitizeRuntimeError(error) {
  const value = String(error?.message || 'AUTONOMOUS_CYCLE_FAILED').toUpperCase();
  return value.replace(/[^A-Z0-9_:-]/g, '_').slice(0, 120);
}

async function handleAura3RoundTrip(env, chatId, dispatch, replyToMessageId) {
  try {
    const received = await waitForAura3Result(dispatch.taskId);
    if (received.status !== 'RESULT_RECEIVED') {
      await sendTelegramMessage(env, chatId, 'AURA3 ka fresh result abhi verify nahi ho paya. Main same check ko track kar raha hoon; unverified result ko final nahi maanunga.', replyToMessageId);
      return;
    }

    const verification = verifyAura3Result(received.result, dispatch.taskId);
    if (!verification.ok) {
      await sendTelegramMessage(env, chatId, 'AURA3 se result mila, lekin verification pass nahi hui. Main ise reliable final result nahi maan raha.', replyToMessageId);
      return;
    }

    const report = formatAura3ResultForFounder(received.result);
    await sendNaturalDepartmentResult(env, chatId, 'aura3', report, replyToMessageId);
  } catch (error) {
    console.error('AURA3 round-trip failed:', error?.message || 'unknown');
    try {
      await sendTelegramMessage(env, chatId, 'AURA3 ka fresh check verify nahi ho paya. Main success claim nahi kar raha; issue internally track ho raha hai.', replyToMessageId);
    } catch (_) {}
  }
}

async function handleRioRoundTrip(env, chatId, dispatch, replyToMessageId) {
  try {
    const received = await waitForRioResult(dispatch.taskId);
    if (received.status !== 'RESULT_RECEIVED') {
      await sendTelegramMessage(env, chatId, 'RIO ka fresh result abhi verify nahi ho paya. Main ise success ya connected result claim nahi kar raha; same check ko track karunga.', replyToMessageId);
      return;
    }
    const verification = verifyRioResult(received.result, dispatch.taskId);
    if (!verification.ok) {
      await sendTelegramMessage(env, chatId, 'RIO se result mila, lekin verification pass nahi hui. Isliye main us result ko reliable fact ke roop me use nahi karunga.', replyToMessageId);
      return;
    }
    const report = formatRioResultForFounder(received.result);
    await sendNaturalDepartmentResult(env, chatId, 'rio', report, replyToMessageId);
  } catch (error) {
    console.error('RIO round-trip failed:', error?.message || 'unknown');
    try { await sendTelegramMessage(env, chatId, 'RIO ka fresh check verify nahi ho paya. Main success claim nahi kar raha; exact failure ko internally track kar raha hoon.', replyToMessageId); } catch (_) {}
  }
}

async function handleTonyRoundTrip(env, chatId, dispatch, replyToMessageId) {
  try {
    const received = await waitForTonyResult(dispatch.taskId, env);
    if (received.status !== 'RESULT_RECEIVED') {
      await sendTelegramMessage(env, chatId, 'Tony ka fresh result abhi verify nahi ho paya. Main same check ko track kar raha hoon aur unverified result ko final nahi maanunga.', replyToMessageId);
      return;
    }

    const verification = verifyTonyResult(received.result, dispatch.taskId);
    if (!verification.ok) {
      await sendTelegramMessage(env, chatId, 'Tony se result mila, lekin verification pass nahi hui. Main ise reliable final result nahi maan raha.', replyToMessageId);
      return;
    }

    const report = formatTonyResultForFounder(received.result);
    const verificationNote = dispatch.taskType === 'TASK_REQUEST'
      ? 'Victor verification: governed TASK_REQUEST envelope ka fresh round-trip VERIFIED. Isse task execution complete prove nahi hota; changed files aur tests ka evidence alag verify hoga.'
      : 'Victor verification: fresh round-trip evidence VERIFIED for this task. Ye diagnostic communication verification hai; Tony LIVE certification alag gate hai.';
    await sendNaturalDepartmentResult(env, chatId, 'tony_stark', `${report}\n\n${verificationNote}`, replyToMessageId);
  } catch (error) {
    console.error('Tony round-trip failed:', error?.message || 'unknown');
    try {
      await sendTelegramMessage(env, chatId, 'Tony ka fresh check verify nahi ho paya. Main success claim nahi kar raha; issue internally track ho raha hai.', replyToMessageId);
    } catch (_) {}
  }
}

async function sendNaturalDepartmentResult(env, chatId, target, rawReport, replyToMessageId) {
  const session = await readConversationSession(chatId);
  const founderQuestion = session?.unresolved_question || session?.active_issue || session?.last_founder_text || '';
  let reply = naturalResultFallback(target, rawReport);
  if (env.ENABLE_AI_INFERENCE === 'true') {
    try {
      reply = await askModel(
        env,
        'Rewrite verified department evidence into a natural Founder-facing answer. Follow the supplied rules exactly; never invent or upgrade evidence.',
        buildNaturalResultPrompt(target, founderQuestion, rawReport),
      );
    } catch (error) {
      console.error('Natural Founder result synthesis failed:', safeErrorMessage(error));
    }
  }
  await writeConversationSession(chatId, {
    last_victor_reply: reply,
    unresolved_question: null,
    task_state: 'RESULT_VERIFIED',
  });
  await sendTelegramMessage(env, chatId, reply, replyToMessageId);
}

async function readConversationSession(chatId) {
  try {
    const cache = caches.default;
    const key = new Request(`https://victor.internal/conversation/${encodeURIComponent(String(chatId))}`);
    const hit = await cache.match(key);
    return hit ? await hit.json() : {};
  } catch (_) {
    return {};
  }
}

async function writeConversationSession(chatId, next) {
  try {
    const cache = caches.default;
    const key = new Request(`https://victor.internal/conversation/${encodeURIComponent(String(chatId))}`);
    const current = await readConversationSession(chatId);
    const payload = { ...current, ...next, updated_at: new Date().toISOString() };
    await cache.put(key, new Response(JSON.stringify(payload), { headers: { 'Cache-Control': 'public, max-age=7200', 'Content-Type': 'application/json' } }));
  } catch (_) {}
}

async function dispatchContextualInvestigation(env, target, investigationText, metadata = {}) {
  if (target === 'rio') {
    if (!rioBridgeConfigured(env)) throw new Error('RIO_BRIDGE_NOT_CONFIGURED');
    return dispatchRioTask(env, investigationText, metadata);
  }
  if (target === 'tony_stark') {
    if (!tonyBridgeConfigured(env)) throw new Error('TONY_BRIDGE_NOT_CONFIGURED');
    return dispatchTonyTask(env, investigationText, metadata);
  }
  if (target === 'aura3') {
    if (!aura3BridgeConfigured(env)) throw new Error('AURA3_BRIDGE_NOT_CONFIGURED');
    return dispatchAura3Task(env, investigationText, metadata);
  }
  throw new Error('CONTEXTUAL_INVESTIGATION_TARGET_UNSUPPORTED');
}

async function answerExistingDepartmentTask(env, chatId, followUp, session, replyToMessageId) {
  const target = followUp?.target || session?.last_target;
  const taskId = followUp?.task_id || session?.last_task_id;
  if (!target || !taskId) return false;
  try {
    let received;
    let verification;
    let report;
    if (target === 'rio') {
      received = await waitForRioResult(taskId, { attempts: 1, delayMs: 0 });
      if (received.status === 'RESULT_RECEIVED') {
        verification = verifyRioResult(received.result, taskId);
        if (verification.ok) report = formatRioResultForFounder(received.result);
      }
    } else if (target === 'tony_stark') {
      received = await waitForTonyResult(taskId, env, { attempts: 1, delayMs: 0 });
      if (received.status === 'RESULT_RECEIVED') {
        verification = verifyTonyResult(received.result, taskId);
        if (verification.ok) report = formatTonyResultForFounder(received.result);
      }
    } else if (target === 'aura3') {
      received = await waitForAura3Result(taskId, { attempts: 1, delayMs: 0 });
      if (received.status === 'RESULT_RECEIVED') {
        verification = verifyAura3Result(received.result, taskId);
        if (verification.ok) report = formatAura3ResultForFounder(received.result);
      }
    } else {
      return false;
    }

    if (report) {
      await writeConversationSession(chatId, { last_target: target, last_task_id: taskId, task_state: 'RESULT_VERIFIED' });
      await sendNaturalDepartmentResult(env, chatId, target, report, replyToMessageId);
      return true;
    }

    await sendTelegramMessage(env, chatId, naturalPendingReply(target), replyToMessageId);
    return true;
  } catch (error) {
    console.error('Existing task status lookup failed:', safeErrorMessage(error));
    await sendTelegramMessage(env, chatId, `Existing task ${taskId} ka fresh status abhi verify nahi hua. Victor naya duplicate task dispatch nahi karega; same task ko track karega.`, replyToMessageId);
    return true;
  }
}

function memoryAcknowledgement(status) {
  if (status === 'PERSISTED') return 'Record ho gaya. Founder instruction permanent memory mein save kar diya gaya hai.';
  if (status === 'ALREADY_PRESENT') return 'Ye instruction permanent memory mein already recorded hai.';
  if (status === 'PENDING_CONFIGURATION') return 'Record nahi hua. Permanent memory write configuration complete nahi hai.';
  if (status === 'CONFLICT_RETRY_REQUIRED') return 'Record abhi confirm nahi hua. Memory write conflict aaya hai; retry required hai.';
  if (status === 'FAILED') return 'Record nahi hua. Memory persistence fail hui hai; main ise saved claim nahi karunga.';
  return 'Memory write request process nahi hui.';
}

function isGreeting(text) {
  const normalized = text.toLowerCase().replace(/[!.?,]+/g, '').trim();
  return new Set(['hi','hello','hey','hii','hiii','namaste','namaskar','good morning','good afternoon','good evening']).has(normalized);
}

async function loadVictorCore() {
  const cache = caches.default;
  const cacheKey = new Request('https://victor.internal/core-context-v7-bridge');
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const results = await Promise.all(CORE_SOURCES.map(async ([name, path, required]) => {
    try {
      const res = await fetch(`${RAW_BASE}/${path}`, { headers: { 'User-Agent': 'Dr-Victor-Telegram-Core/7.0' } });
      if (!res.ok) return { name, path, required, ok: false, status: res.status, text: '' };
      const text = await res.text();
      return { name, path, required, ok: Boolean(text.trim()), status: res.status, text };
    } catch (error) {
      return { name, path, required, ok: false, status: 0, text: '', error: error?.name || 'FetchError' };
    }
  }));

  const requiredSourcesOk = results.filter(r => r.required).every(r => r.ok);
  const byName = Object.fromEntries(results.map(r => [r.name, r]));
  const payload = {
    ready: requiredSourcesOk,
    requiredSourcesOk,
    sourceStatus: results.map(({ name, path, required, ok, status }) => ({ name, path, required, ok, status })),
    sourceRecords: results,
    context: results
      .filter(r => r.ok && !['FOUNDER_MEMORY','DECISIONS','LONG_TERM_MEMORY','ACTIVE_PROJECTS_MEMORY','WORKING_MEMORY','LEARNINGS_MEMORY','OPERATIONAL_MEMORY','ACTIVITY_MEMORY','MEMORY_INDEX_MD','MEMORY_INDEX'].includes(r.name))
      .map(r => `\n===== ${r.name} :: ${r.path} =====\n${r.text}`).join('\n'),
    architectureLockLoaded: Boolean(byName.ARCHITECTURE_LOCK?.ok),
  };

  const response = new Response(JSON.stringify(payload), { headers: { 'Cache-Control': 'public, max-age=120' } });
  await cache.put(cacheKey, response.clone());
  return payload;
}

async function planFounderRequest(env, text, replyContext = '', activeSession = {}) {
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
  const content = await askModel(env, system, `${replyContext ? `Previous message: ${replyContext}\n` : ''}Founder: ${text}`);
  const cleaned = content.replace(/```json|```/gi, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch (_) { parsed = null; }
  const allowedModes = new Set(['CHAT', 'DEPARTMENT_STATUS', 'DEPARTMENT_ACTION', 'EXECUTIVE_GOAL']);
  const allowedTargets = new Set(['rio', 'tony_stark', 'aura3', 'hulk', null]);
  if (!parsed || !allowedModes.has(parsed.mode) || !allowedTargets.has(parsed.target ?? null)) {
    const entity = resolveFounderEntityQuery(text);
    const target = ['rio', 'tony_stark', 'aura3'].includes(entity?.entity_id) ? entity.entity_id : null;
    return { mode: target ? 'DEPARTMENT_STATUS' : 'CHAT', target, reason: 'planner_fallback' };
  }
  return { mode: parsed.mode, target: parsed.target ?? null, reason: String(parsed.reason || '').slice(0, 160) };
}

async function callVictorCore(env, userMessage, requestFacts, activeSession = {}) {
  if (!env.API_VICTOR) throw codedError('AI_CREDENTIAL_MISSING', 'API_VICTOR is not configured');

  const core = await loadVictorCore();
  if (!core.ready || !core.architectureLockLoaded) throw codedError('CORE_CONTEXT_UNAVAILABLE', 'Victor canonical governance context unavailable');

  const intent = classifyFounderMessage(userMessage);

  // Conversation-first: casual talk and explanations behave like a normal AI.
  // Operational/status/action requests continue through the governed evidence path.
  if (isNaturalConversationIntent(intent, userMessage)) {
    return callVictorNatural(env, userMessage, core.sourceRecords);
  }

  const entity = resolveFounderEntityQuery(userMessage);
  const facts = {
    ...requestFacts,
    resolvedDepartmentId: entity.entity_id,
    resolvedDepartmentName: entity.canonical_name,
    entityResolutionReason: entity.reason,
  };
  const truthSnapshot = buildTruthSnapshot(core.sourceRecords, facts);
  const memory = buildMemoryContext(userMessage, core.sourceRecords, 6);
  const entityDirective = entity.matched
    ? `FOUNDER ENTITY RESOLUTION: The message target is ${entity.canonical_name} (${entity.entity_id}) because ${entity.reason}. Answer for this target only. If target is AURA3, do not mention AURA2 unless Founder explicitly asked for comparison.`
    : 'FOUNDER ENTITY RESOLUTION: no special alias matched.';

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
    reply = await askModel(env, `${system}\n${correction}`, userMessage);
    validation = validateVictorReply(reply, intent, truthSnapshot);
  }

  if (!validation.ok) {
    const rejectedViolations = [...validation.violations];
    const fallback = buildTruthGuardFallback(intent, truthSnapshot, userMessage);
    const fallbackValidation = validateVictorReply(fallback, intent, truthSnapshot);
    if (fallbackValidation.ok) {
      console.warn(JSON.stringify({
        event: 'VICTOR_TRUTH_GUARD_SAFE_FALLBACK',
        rejected_violations: rejectedViolations,
        fallback_source: 'DETERMINISTIC_CANONICAL_FACTS',
        secrets_exposed: false,
      }));
      return fallback;
    }
    throw codedError('TRUTH_GUARD_REJECTED', `Victor truth guard rejected reply: ${rejectedViolations.join(',')}`);
  }
  return reply;
}

export function buildTruthGuardFallback(intent, truthSnapshot = {}, userMessage = '') {
  const requestFacts = truthSnapshot?.request_facts || {};
  const resolved = truthSnapshot?.resolved_department;

  if (String(intent || '').startsWith('SYSTEM_QUERY') && resolved?.id) {
    const status = resolved.registry_status || 'UNKNOWN';
    const connection = resolved.victor_connection || 'NOT_VERIFIED';
    return `${resolved.name || resolved.id} ka canonical status ${status} hai. Victor connection evidence: ${connection}. Ye answer canonical records se deterministic tarike se bana hai.`;
  }

  if (String(intent || '').startsWith('SYSTEM_QUERY')) {
    const asksOrganizationStatus = /\b(sab(?:ka|ki|ke)?|all|system|organization|organisation|department|status)\b/i.test(userMessage);
    const departments = Array.isArray(truthSnapshot?.departments) ? truthSnapshot.departments : [];
    if (asksOrganizationStatus && departments.length) {
      const priorityIds = ['rio', 'aura3', 'aura2', 'tony_stark', 'hulk'];
      const names = { rio: 'RIO', aura3: 'AURA3', aura2: 'AURA2', tony_stark: 'Tony', hulk: 'HULK' };
      const parts = priorityIds.map(id => {
        const department = departments.find(item => item.id === id);
        return department ? `${names[id]} ${department.registry_status || 'UNKNOWN'}` : null;
      }).filter(Boolean);
      const remainingUnverified = departments.filter(item => !priorityIds.includes(item.id) && item.registry_status === 'UNVERIFIED').length;
      const suffix = remainingUnverified ? `; baaki ${remainingUnverified} departments UNVERIFIED hain` : '';
      return `Victor READY hai. ${parts.join(', ')}${suffix}. Ye canonical status hai; fresh business results alag evidence se verify honge.`;
    }
    const telegramFact = requestFacts.telegram_message_received_now
      ? 'Telegram request abhi receive hui hai'
      : 'Telegram request evidence available nahi hai';
    return `Victor online hai. ${telegramFact}, canonical core context loaded hai, aur AI provider ne response diya. Truth guard active hai.`;
  }

  return 'Request receive hui, lekin generated draft truth verification pass nahi kar saka. Main unsupported claim nahi karunga; request ko specific status ya department ke saath dobara bhejiye.';
}

function isNaturalConversationIntent(intent, text) {
  const value = String(text || '').trim();
  if (intent === 'GENERAL_CONVERSATION' || intent === 'IDENTITY_QUERY') return true;

  const explanatory = /\b(kya\s+karta|kya\s+karti|kaun\s+kya|role|roles|kaam\s+kya|kya\s+kaam|about|bare\s+me\s+batao|baare\s+me\s+batao|samjhao|explain)\b/i.test(value);
  const operational = /\b(status|current|latest|fresh|live|health|healthy|check|verify|evidence|issue|problem|blocker|fix|repair|recover|thik|theek|execute|run|deploy|publish|start|stop|pause|resume|revenue|progress)\b/i.test(value);
  return String(intent || '').startsWith('SYSTEM_QUERY') && explanatory && !operational;
}

async function callVictorNatural(env, userMessage, sourceRecords = []) {
  const registry = sourceRecords.find(record => record?.name === 'DEPARTMENT_REGISTRY' && record?.ok)?.text || '';
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
${registry.slice(0, 14000)}
`;
  return askModel(env, system, userMessage);
}

async function askModel(env, system, userMessage) {
  const model = env.VICTOR_MODEL || DEFAULT_MODEL;
  let response;
  try {
    response = await fetch(`${BEDROCK_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.API_VICTOR}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
        temperature: 0.15,
        max_tokens: 700,
      }),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const code = error?.name === 'TimeoutError' ? 'AI_UPSTREAM_TIMEOUT' : 'AI_UPSTREAM_UNREACHABLE';
    throw codedError(code, `Victor AI request failed: ${error?.name || 'FetchError'}`);
  }
  if (!response.ok) {
    const error = codedError('AI_UPSTREAM_HTTP_ERROR', `Victor AI upstream HTTP ${response.status}`);
    error.upstreamHttpStatus = response.status;
    throw error;
  }
  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw codedError('AI_UPSTREAM_INVALID_RESPONSE', 'Victor AI returned invalid JSON');
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw codedError('AI_UPSTREAM_EMPTY_RESPONSE', 'Victor AI returned no text');
  return content.trim();
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildTraceId(updateId, messageId) {
  const updatePart = Number.isInteger(updateId) ? updateId : 'na';
  const messagePart = Number.isInteger(messageId) ? messageId : 'na';
  return `tg-${updatePart}-${messagePart}`;
}

export function classifyProcessingError(error, stage = 'UNKNOWN') {
  const knownCode = typeof error?.code === 'string' ? error.code : '';
  let category = knownCode || 'PROCESSING_FAILED';

  if (!knownCode && stage === 'TELEGRAM_DELIVERY') category = 'TELEGRAM_DELIVERY_FAILED';
  else if (!knownCode && stage === 'MEMORY_WRITE') category = 'MEMORY_PROCESSING_FAILED';
  else if (!knownCode && ['DEPARTMENT_ROUTING', 'DEPARTMENT_EXECUTION'].includes(stage)) category = 'DEPARTMENT_ROUTING_FAILED';

  const messages = {
    AI_CREDENTIAL_MISSING: 'Victor ki AI credential configuration missing hai.',
    CORE_CONTEXT_UNAVAILABLE: 'Victor ka canonical core context load nahi ho pa raha.',
    AI_UPSTREAM_TIMEOUT: 'Victor ka AI provider time par response nahi de raha.',
    AI_UPSTREAM_UNREACHABLE: 'Victor ka AI provider abhi reachable nahi hai.',
    AI_UPSTREAM_HTTP_ERROR: `Victor ke AI provider ne request reject ki${error?.upstreamHttpStatus ? ` (HTTP ${error.upstreamHttpStatus})` : ''}.`,
    AI_UPSTREAM_INVALID_RESPONSE: 'Victor ke AI provider se invalid response mila.',
    AI_UPSTREAM_EMPTY_RESPONSE: 'Victor ke AI provider se blank response mila.',
    TRUTH_GUARD_REJECTED: 'Victor ka generated reply truth verification pass nahi kar saka.',
    TELEGRAM_DELIVERY_FAILED: 'Victor reply bana chuka tha, lekin Telegram delivery fail hui.',
    MEMORY_PROCESSING_FAILED: 'Victor memory processing stage par error aaya.',
    DEPARTMENT_ROUTING_FAILED: 'Victor department routing stage par error aaya.',
    PROCESSING_FAILED: 'Victor processing me unexpected error aaya.',
  };

  return {
    category,
    stage,
    upstreamHttpStatus: Number.isInteger(error?.upstreamHttpStatus) ? error.upstreamHttpStatus : null,
    founderMessage: traceId => `${messages[category] || messages.PROCESSING_FAILED} Main guess nahi karunga. Diagnostic code: ${category}; Trace: ${traceId}.`,
  };
}

function safeErrorMessage(error) {
  return String(error?.message || 'unknown').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 300);
}

function normalizeTelegramText(value) {
  let text = String(value || '');
  text = text.replace(/```[a-zA-Z0-9_-]*\n?/g, '');
  text = text.replace(/```/g, '');
  text = text.replace(/\*\*(.*?)\*\*/gs, '$1');
  text = text.replace(/__(.*?)__/gs, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

async function sendTelegramMessage(env, chatId, text, replyToMessageId) {
  if (!env.TELEGRAM_BOT_TOKEN_VICTOR) throw new Error('TELEGRAM_BOT_TOKEN_VICTOR is not configured');
  const cleanText = normalizeTelegramText(text);
  const body = { chat_id: chatId, text: cleanText.slice(0, 4096), allow_sending_without_reply: true };
  if (replyToMessageId) body.reply_parameters = { message_id: replyToMessageId };
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Telegram sendMessage HTTP ${response.status}`);
  try {
    const current = await readConversationSession(chatId);
    const withReply = appendRecentTurn({ ...current, last_victor_reply: cleanText.slice(0, 1200) }, 'victor', cleanText.slice(0, 1200));
    await writeConversationSession(chatId, withReply);
  } catch (_) {}
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}

export function isAuthorizedFounderMessage(env, chatId, senderId) {
  const founderChatId = String(env?.VICTOR_FOUNDER_CHAT_ID || '');
  const managementChatId = String(env?.TELEGRAM_MANAGEMENT_CHAT_ID || '');
  if (!founderChatId) return false;
  if (String(chatId) === founderChatId) return true;
  return Boolean(managementChatId)
    && String(chatId) === managementChatId
    && String(senderId) === founderChatId;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
