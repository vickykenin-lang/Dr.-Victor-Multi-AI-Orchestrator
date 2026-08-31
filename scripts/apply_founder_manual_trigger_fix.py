from pathlib import Path

RUNTIME = Path('victor-telegram-worker/autonomy_runtime.mjs')
TEST = Path('victor-telegram-worker/autonomy_runtime.test.mjs')

runtime = RUNTIME.read_text(encoding='utf-8')
old = "  if (controller.cron !== SUPERVISION_CRON) return { status: 'IGNORED_UNKNOWN_CRON', cron: controller.cron };\n"
new = "  const manualFounderTrigger = controller?.cron === 'founder-command';\n  if (controller.cron !== SUPERVISION_CRON && !manualFounderTrigger) return { status: 'IGNORED_UNKNOWN_CRON', cron: controller.cron };\n"
if new not in runtime:
    if old not in runtime:
        raise SystemExit('PATCH_ANCHOR_NOT_FOUND:manual_founder_trigger')
    runtime = runtime.replace(old, new, 1)
    RUNTIME.write_text(runtime, encoding='utf-8')

text = TEST.read_text(encoding='utf-8')
marker = "test('cron remains watchdog plus 10 PM IST report', () => {\n"
addition = "test('Founder manual executive trigger is a supported execution trigger', async () => {\n  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./autonomy_runtime.mjs', import.meta.url), 'utf8'));\n  assert.match(source, /manualFounderTrigger = controller\\?\\.cron === 'founder-command'/);\n  assert.match(source, /controller\\.cron !== SUPERVISION_CRON && !manualFounderTrigger/);\n});\n\n"
if addition not in text:
    if marker not in text:
        raise SystemExit('PATCH_ANCHOR_NOT_FOUND:manual_trigger_test')
    text = text.replace(marker, addition + marker, 1)
    TEST.write_text(text, encoding='utf-8')

print('FOUNDER_MANUAL_TRIGGER_FIX_APPLIED')
