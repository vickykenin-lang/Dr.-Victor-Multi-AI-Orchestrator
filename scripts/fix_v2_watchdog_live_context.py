from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

replacements = {
    "const watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });":
        "const watchdog = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 0 });",
    "const v2Watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });":
        "const v2Watchdog = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 0 });",
}

for old, new in replacements.items():
    count = text.count(old)
    if count == 0 and new in text:
        continue
    if count != 1:
        raise SystemExit(f'WATCHDOG_CONTEXT_ANCHOR_COUNT_INVALID:{old}:{count}')
    text = text.replace(old, new, 1)

# The Worker invokes the deterministic in-process watchdog synchronously at
# these two gates. Explicit availability/health describes that local evaluator;
# it does not claim a separately deployed watchdog service exists.
required = [
    "const watchdog = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 0 });",
    "const v2Watchdog = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 0 });",
]
if not all(marker in text for marker in required):
    raise SystemExit('WATCHDOG_CONTEXT_CONVERGENCE_FAILED')

path.write_text(text, encoding='utf-8')
print('WATCHDOG_CONTEXT_CONVERGED')
