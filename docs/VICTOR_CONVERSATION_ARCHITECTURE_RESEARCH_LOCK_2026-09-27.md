# Victor Conversation Architecture Research Lock — 2026-09-27

Status: RESEARCH DECISION LOCKED FOR IMPLEMENTATION PLANNING

## Research question
How should Victor handle Telegram conversation, LLM reasoning, tools, multi-agent orchestration, governance, memory and routine actions without making normal Founder interaction slow, blocked or over-governed?

## Main researched topics

1. Conversation-first vs orchestration-first architecture
- Normal conversation should not traverse the full orchestration/governance stack.
- Founder-facing conversation should be handled by an LLM-first path.
- Heavy orchestration should activate only when the request actually needs tools, evidence, agents or execution.

2. LLM as conversational brain; Victor as governed backend
- Recommended target architecture: Telegram -> LLM conversational brain -> Victor tools/backend when needed.
- LLM owns natural-language understanding, context, reasoning and final Founder-facing synthesis.
- Victor owns governed execution, evidence, state, bridges, tools, auditability and security boundaries.

3. Tool-use architecture
- RIO, AURA3, Tony Stark, GitHub, memory, reminders, evidence and deployment should be exposed as bounded capabilities/tools.
- LLM selects a tool when required; runtime/tool layer performs the real action.
- Tool execution remains deterministic and auditable.

4. Risk-based governance instead of governance on every message
- Casual chat and explanations: no execution gate.
- Read-only/status/routine low-risk actions: lightweight path.
- Normal governed actions: existing runtime policy.
- Sensitive/RED actions: explicit approval and strict controls.
- Governance belongs at the action boundary, not at the start of every conversation turn.

5. Multi-agent orchestration only when justified
- Single-agent/direct tool call is preferred for simple tasks.
- Multi-agent collaboration is appropriate for genuinely complex cross-domain work, verification, critique or synthesis.
- Do not invoke multi-agent orchestration for a simple status query or casual conversation.

6. Reminder/scheduler separation
- LLM should interpret natural-language time and reminder intent.
- A real durable scheduler must create and deliver the reminder.
- LLM must not claim a reminder exists unless the scheduler/tool confirms persistence.

7. Conversation-path simplification
- Current layered path has become over-constrained through repeated intent, planner, fact, recovery, governance and reply gates.
- These components should not be deleted wholesale; they should be invoked only when relevant.
- Normal chat requires a fast path.

8. Model-routing contamination and latency
- Task routing must primarily use the Founder’s actual request.
- Large system prompts must not contaminate task classification and incorrectly route normal chat to coding/reasoning specialists.
- Fast conversational turns should use a suitable low-latency model; specialist models should be selected only when the task requires them.

9. Timeout/fallback role
- Telegram timeout protection is transport safety, not normal conversational behavior.
- A timeout guard should prevent silence and retry loops, but the target architecture should make the guard rarely trigger.

10. Memory and adaptive learning
- Bedrock/LLM may learn Founder phrasing, preferences and intent patterns during the authorized learning period.
- Learning can improve interpretation and routing.
- Learning must never autonomously expand security authority or bypass RED boundaries.

11. Existing END GAME/V2 assets to preserve
- Experience Ledger
- Cognee memory
- Procedure Registry
- RIO/AURA3/Tony bridges
- evidence verification
- durable state
- reverse proxy and Telegram authentication
- security boundaries
- deployment system
- truthful telemetry
- task/result receipts

12. Anti-patterns to stop
- Do not add more regex exceptions as the primary cure.
- Do not add more approval exceptions on top of the same overloaded flow.
- Do not add another global classifier/gate before normal conversation.
- Do not treat DISPATCHED as COMPLETED.
- Do not fabricate background tracking or automatic future updates.

## Locked target architecture

Telegram
  -> LLM conversational brain
      -> natural reply when no tool is needed
      -> Victor tool/backend call when action/evidence is needed
          -> risk-based governance at action boundary
          -> execution/evidence/result
      -> LLM Founder-facing synthesis

## Desired behavior examples

- “Hi” -> fast natural LLM reply.
- “Victor, mujhe tumse kuch important kaam hai” -> fast natural conversation, no coding/governance route.
- “Kal subah 7 baje remind karna” -> LLM parses reminder -> scheduler tool persists -> confirmation only after persistence.
- “AURA3 status check karo” -> status tool/bridge -> verified result -> natural answer.
- “Victor repo ka bug fix karo” -> coding/tool path -> governed execution.
- “Production credentials delete karo” -> sensitive/RED approval path.
- “RIO revenue zero kyun hai aur AURA3 content performance compare karo” -> complex evidence + multi-agent/reasoning path.

## Locked implementation principle
Conversation first. Governance on action, not on every sentence.

## Change-control note
This document locks the research conclusions and target direction. It does not by itself authorize destructive changes, security weakening, credential mutation, or universal autonomy. Implementation must preserve existing evidence and security boundaries while simplifying the Founder-facing path.
