from pathlib import Path

PATH = Path('victor-telegram-worker/department_bridge.mjs')
text = PATH.read_text(encoding='utf-8')
original = text


def replace_once(old: str, new: str, label: str):
    global text
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'PATCH_ANCHOR_NOT_FOUND:{label}')
    text = text.replace(old, new, 1)


replace_once(
    "  return /status|report|check|pucho|pooch|baat|connect|bridge|communication|certif|supervision|round.?trip|progress|objective|govern|priority|next|plan|agenda|activat|start|resume|kaam par|self.?mode|approval/.test(value);\n",
    "  return /status|report|check|pucho|pooch|batao|baat|connect|bridge|communication|certif|supervision|round.?trip|progress|objective|govern|priority|next|plan|agenda|activat|start|shuru|resume|kaam par|self.?mode|approval|post|ready|publish|published|design|creative|kitne|banaya|banana/.test(value);\n",
    'rio_fact_query_routing',
)

replace_once(
    "    message_type: result?.message_type === 'TASK_RESULT', no_public_action: result?.public_action_performed === false,\n",
    "    message_type: result?.message_type === 'TASK_RESULT', public_action_authorized: result?.public_action_performed === false || (result?.task_type === 'GOAL_EXECUTE' && result?.governed_business_cycle_performed === true && result?.external_action_authorized === true),\n",
    'rio_goal_public_action_verification',
)

old_format = "export function formatRioResultForFounder(result) {\n  const strict = result?.strict_supervision || {};\n  return ['RIO se fresh revert aa gaya.', `Status: ${strict.status || result?.execution_status || 'UNKNOWN'}`, `Objective alignment: ${strict.objective_alignment || 'UNKNOWN'}`, `Error/Blocker: ${strict.error_or_blocker || 'none reported'}`, `Solution: ${strict.solution || 'NOT_PROVIDED'}`, `Next action: ${strict.next_action || 'NOT_PROVIDED'}`, `Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(', ') : 'NOT_PROVIDED'}`].join('\\n');\n}\n"
new_format = "export function formatRioResultForFounder(result) {\n  const strict = result?.strict_supervision || {};\n  const content = strict?.outcome_progress?.content || result?.snapshot?.content || null;\n  const lines = [\n    'RIO se fresh verified revert aa gaya.',\n    `Status: ${strict.status || result?.execution_status || 'UNKNOWN'}`,\n    `Objective alignment: ${strict.objective_alignment || 'UNKNOWN'}`,\n  ];\n  if (content) {\n    lines.push(`Ready-to-post promos: ${Number(content.ready_to_post_count) || 0}${Array.isArray(content.ready_to_post_ids) && content.ready_to_post_ids.length ? ` (${content.ready_to_post_ids.join(', ')})` : ''}`);\n    lines.push(`Actually published posts: ${Number(content.actually_published_count) || 0}`);\n    if (content.new_design_started_verified === true) lines.push('New-design creative: verified started');\n    else if (content.new_design_started_verified === false) lines.push('New-design creative: verified not started');\n    else lines.push('New-design creative: fresh verified evidence unavailable; no absolute claim.');\n  }\n  lines.push(`Error/Blocker: ${strict.error_or_blocker || 'none reported'}`);\n  lines.push(`Solution: ${strict.solution || 'NOT_PROVIDED'}`);\n  lines.push(`Next action: ${strict.next_action || 'NOT_PROVIDED'}`);\n  lines.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(', ') : 'NOT_PROVIDED'}`);\n  return lines.join('\\n');\n}\n"
replace_once(old_format, new_format, 'rio_founder_fact_format')

if text == original:
    print('NO_CHANGES_ALREADY_APPLIED')
else:
    PATH.write_text(text, encoding='utf-8')
    print('VICTOR_RIO_BRIDGE_FIXES_APPLIED')
