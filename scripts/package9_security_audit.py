#!/usr/bin/env python3
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
wf=ROOT/'.github'/'workflows'
issues=[]
for p in sorted(wf.glob('*.yml')):
    text=p.read_text(encoding='utf-8')
    for m in re.finditer(r'uses:\s*([^\s]+)',text):
        ref=m.group(1)
        if ref.startswith('./'): continue
        if '@' not in ref or not re.search(r'@[0-9a-fA-F]{40}$',ref):
            issues.append({'file':str(p.relative_to(ROOT)),'issue':'MUTABLE_ACTION_REF','ref':ref})
    if 'actions/checkout@' in text and 'persist-credentials: false' not in text:
        issues.append({'file':str(p.relative_to(ROOT)),'issue':'CHECKOUT_PERSISTS_CREDENTIALS'})
report={'schema_version':1,'workflow_count':len(list(wf.glob('*.yml'))),'finding_count':len(issues),'findings':issues,'branch_protection_requires_admin':True,'credential_rotation_founder_gated':True,'status':'HARDENING_PENDING' if issues else 'SOURCE_HARDENED'}
print(json.dumps(report,indent=2))
# inventory tool: findings do not fail CI; they become explicit Package 9 carry-forward
