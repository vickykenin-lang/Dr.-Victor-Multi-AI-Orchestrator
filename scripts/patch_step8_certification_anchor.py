from pathlib import Path

path = Path('scripts/apply_step8_certification_safehold.py')
text = path.read_text(encoding='utf-8')
old = "const v2Watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });"
new = "const v2Watchdog = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 0 });"
if old in text:
    text = text.replace(old, new)
elif new not in text:
    raise SystemExit('STEP8_CERT_WATCHDOG_ANCHOR_NOT_FOUND')
path.write_text(text, encoding='utf-8')
print('STEP8_CERT_WATCHDOG_ANCHOR_CONVERGED')
