from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

# Later consolidation layers may replace legacy cache/session helpers. Treat
# the natural-conversation semantic end-state as authoritative instead of
# trying to reinsert obsolete helper code.
if (
    "from '../brain/founder_conversation.mjs'" in text
    and "naturalDispatchAcknowledgement('rio', text)" in text
    and "naturalDispatchAcknowledgement('tony_stark', text)" in text
    and "naturalDispatchAcknowledgement('aura3', text)" in text
    and "async function sendNaturalDepartmentResult" in text
    and "naturalPendingReply(target)" in text
):
    print('NATURAL_FOUNDER_CONVERSATION_ALREADY_APPLIED')
    raise SystemExit(0)

raise SystemExit('natural Founder conversation semantic end-state missing; manual integration review required')
