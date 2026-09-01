#!/usr/bin/env python3
from pathlib import Path

p = Path('brain/fact_runtime.mjs')
s = p.read_text(encoding='utf-8')

imp = "import { attachResolvedTruth } from './fact_evidence_resolver.mjs';\n\n"
if imp not in s:
    s = imp + s

old = "  return evidence;\n}\n\nexport function buildFactAnswerPrompt"
new = "  return attachResolvedTruth(evidence);\n}\n\nexport function buildFactAnswerPrompt"
if old in s:
    s = s.replace(old, new, 1)
elif "return attachResolvedTruth(evidence);" not in s:
    raise SystemExit('truth resolver return anchor missing')

needle = "    'Give exact numbers/timestamps/commit dates when present. If a requested number is not supported by the fetched scope, say exactly what was counted and what remains unknown.',"
addition = needle + "\n    'Use resolved_truth as the authoritative reconciliation output. If it reports a conflict, explain which receipt won and why using truth precedence/freshness. If status is RESOLVED_STALE_ONLY, label the fact stale instead of presenting it as current.',"
if "Use resolved_truth as the authoritative reconciliation output" not in s:
    if needle not in s:
        raise SystemExit('fact prompt anchor missing')
    s = s.replace(needle, addition, 1)

p.write_text(s, encoding='utf-8')
print('truth resolver integrated')
