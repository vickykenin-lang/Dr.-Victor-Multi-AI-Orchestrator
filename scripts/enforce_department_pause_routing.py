#!/usr/bin/env python3
# Deterministic integration patch for pause-aware Victor department routing.
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
autonomy = ROOT / 'victor-telegram-worker/autonomy_runtime.mjs'
worker = ROOT / 'victor-telegram-worker/worker.js'

a = autonomy.read_text(encoding='utf-8')
old_available = """function availableDepartments(env) {
  const out = [];
  if (rioBridgeConfigured(env)) out.push('rio');
  if (tonyBridgeConfigured(env)) out.push('tony_stark');
  if (aura3BridgeConfigured(env)) out.push('aura3');
  return out;
}
"""
new_available = """async function availableDepartments(env) {
  const configured = [];
  if (rioBridgeConfigured(env)) configured.push('rio');
  if (tonyBridgeConfigured(env)) configured.push('tony_stark');
  if (aura3BridgeConfigured(env)) configured.push('aura3');
  const checks = await Promise.all(configured.map(async department => ({
    department,
    pause: await isExecutionPaused(env, department),
  })));
  return checks.filter(item => item.pause.paused !== true).map(item => item.department);
}
"""
if old_available not in a:
    raise SystemExit('AUTONOMY_AVAILABLE_DEPARTMENTS_ANCHOR_NOT_FOUND')
a = a.replace(old_available, new_available, 1)

old_selection = """  const registry = await loadGoalRegistry(env);
  let state = await loadGoalRuntimeState(env);
  let selection = selectAutonomyGoal(registry, state, availableDepartments(env), controller.scheduledTime);
  if (!selection) {
    const available = availableDepartments(env);
"""
new_selection = """  const registry = await loadGoalRegistry(env);
  let state = await loadGoalRuntimeState(env);
  const available = await availableDepartments(env);
  let selection = selectAutonomyGoal(registry, state, available, controller.scheduledTime);
  if (!selection) {
"""
if old_selection not in a:
    raise SystemExit('AUTONOMY_SELECTION_ANCHOR_NOT_FOUND')
a = a.replace(old_selection, new_selection, 1)

old_replan = """    const nextRuntimeGoal = state.goals?.[selection.goal.goal_id] || {};
    const nextTarget = chooseGoalDepartment(selection.goal, nextRuntimeGoal, availableDepartments(env));
"""
new_replan = """    const nextRuntimeGoal = state.goals?.[selection.goal.goal_id] || {};
    const nextTarget = chooseGoalDepartment(selection.goal, nextRuntimeGoal, available);
"""
if old_replan not in a:
    raise SystemExit('AUTONOMY_REPLAN_ANCHOR_NOT_FOUND')
a = a.replace(old_replan, new_replan, 1)
autonomy.write_text(a, encoding='utf-8')

w = worker.read_text(encoding='utf-8')
old_import = "import { parseEmergencyCommand, applyEmergencyCommand } from './emergency_pause_runtime.mjs';"
new_import = "import { parseEmergencyCommand, applyEmergencyCommand, isExecutionPaused } from './emergency_pause_runtime.mjs';"
if old_import not in w:
    raise SystemExit('WORKER_PAUSE_IMPORT_ANCHOR_NOT_FOUND')
w = w.replace(old_import, new_import, 1)

routing_specs = [
    (
        """      if (!memoryDirective && shouldContactRio(text, entity)) {
        if (!rioBridgeConfigured(env)) {
""",
        """      if (!memoryDirective && shouldContactRio(text, entity)) {
        const rioPause = await isExecutionPaused(env, 'rio');
        if (rioPause.paused) {
          const reason = rioPause.global_pause_active ? 'SYSTEM PAUSE active hai.' : 'RIO department PAUSED hai; Victor aur baaki departments running reh sakte hain.';
          await sendTelegramMessage(env, chatId, `RIO dispatch refused: ${reason}`, message.message_id);
          return json({ ok: true, rio_bridge: 'PAUSED', pause: rioPause });
        }
        if (!rioBridgeConfigured(env)) {
""",
        'WORKER_RIO_ROUTING_ANCHOR_NOT_FOUND',
    ),
    (
        """      if (!memoryDirective && shouldContactTony(text, entity)) {
        if (!tonyBridgeConfigured(env)) {
""",
        """      if (!memoryDirective && shouldContactTony(text, entity)) {
        const tonyPause = await isExecutionPaused(env, 'tony_stark');
        if (tonyPause.paused) {
          const reason = tonyPause.global_pause_active ? 'SYSTEM PAUSE active hai.' : 'Tony Stark department PAUSED hai; Victor aur baaki departments running reh sakte hain.';
          await sendTelegramMessage(env, chatId, `Tony Stark dispatch refused: ${reason}`, message.message_id);
          return json({ ok: true, tony_bridge: 'PAUSED', pause: tonyPause });
        }
        if (!tonyBridgeConfigured(env)) {
""",
        'WORKER_TONY_ROUTING_ANCHOR_NOT_FOUND',
    ),
    (
        """      if (!memoryDirective && shouldContactAura3(text, entity)) {
        if (!aura3BridgeConfigured(env)) {
""",
        """      if (!memoryDirective && shouldContactAura3(text, entity)) {
        const aura3Pause = await isExecutionPaused(env, 'aura3');
        if (aura3Pause.paused) {
          const reason = aura3Pause.global_pause_active ? 'SYSTEM PAUSE active hai.' : 'AURA3 department PAUSED hai; Victor aur baaki departments running reh sakte hain.';
          await sendTelegramMessage(env, chatId, `AURA3 dispatch refused: ${reason}`, message.message_id);
          return json({ ok: true, aura3_bridge: 'PAUSED', pause: aura3Pause });
        }
        if (!aura3BridgeConfigured(env)) {
""",
        'WORKER_AURA3_ROUTING_ANCHOR_NOT_FOUND',
    ),
]
for old, new, error in routing_specs:
    if old not in w:
        raise SystemExit(error)
    w = w.replace(old, new, 1)
worker.write_text(w, encoding='utf-8')

a2 = autonomy.read_text(encoding='utf-8')
w2 = worker.read_text(encoding='utf-8')
assert "await isExecutionPaused(env, department)" in a2
assert "const available = await availableDepartments(env);" in a2
assert "selectAutonomyGoal(registry, state, available" in a2
assert "chooseGoalDepartment(selection.goal, nextRuntimeGoal, available)" in a2
assert "isExecutionPaused(env, 'rio')" in w2
assert "rio_bridge: 'PAUSED'" in w2
assert "isExecutionPaused(env, 'tony_stark')" in w2
assert "isExecutionPaused(env, 'aura3')" in w2
print('DEPARTMENT_PAUSE_ROUTING_PATCHED')
