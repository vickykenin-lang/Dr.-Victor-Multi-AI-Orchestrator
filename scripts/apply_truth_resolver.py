#!/usr/bin/env python3
from pathlib import Path

p = Path('brain/fact_runtime.mjs')
s = p.read_text(encoding='utf-8')

# Semantic convergence guard for the evolved fact runtime. The historical
# migration looked for the import plus two newlines, which could prepend a
# duplicate import when the same import was already followed immediately by
# another import.
import_line = "import { attachResolvedTruth } from './fact_evidence_resolver.mjs';"
return_marker = "return attachResolvedTruth(evidence);"
prompt_marker = "Use resolved_truth as the authoritative reconciliation output"

if all(marker in s for marker in (import_line, return_marker, prompt_marker)):
    print('NO_CHANGES_ALREADY_APPLIED:TRUTH_RESOLVER_CONVERGED')
    raise SystemExit(0)

if import_line not in s:
    s = import_line + "\n" + s

old = "  return evidence;\n}\n\nexport function buildFactAnswerPrompt"
new = "  return attachResolvedTruth(evidence);\n}\n\nexport function buildFactAnswerPrompt"
if old in s:
    s = s.replace(old, new, 1)
elif return_marker not in s:
    raise SystemExit('truth resolver return anchor missing')

needle = "    'Give exact numbers/timestamps/commit dates when present. If a requested number is not supported by the fetched scope, say exactly what was counted and what remains unknown.',"
addition = needle + "\n    'Use resolved_truth as the authoritative reconciliation output. If it reports a conflict, explain which receipt won and why using truth precedence/freshness. If status is RESOLVED_STALE_ONLY, label the fact stale instead of presenting it as current.',"
if prompt_marker not in s:
    if needle not in s:
        raise SystemExit('fact prompt anchor missing')
    s = s.replace(needle, addition, 1)

# Fail closed if this migration itself ever creates duplicate resolver imports.
if s.count(import_line) != 1:
    raise SystemExit('TRUTH_RESOLVER_IMPORT_NOT_UNIQUE')

p.write_text(s, encoding='utf-8')
print('truth resolver integrated')
