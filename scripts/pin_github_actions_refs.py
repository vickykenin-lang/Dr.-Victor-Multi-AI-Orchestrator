#!/usr/bin/env python3
from pathlib import Path

ROOT = Path('.github/workflows')
PINS = {
    'actions/checkout@v4': 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@v4': 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    'actions/setup-python@v5': 'actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065',
    'actions/upload-artifact@v4': 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
}

changed = []
remaining = []
for path in sorted([*ROOT.glob('*.yml'), *ROOT.glob('*.yaml')]):
    text = path.read_text(encoding='utf-8')
    original = text
    for mutable, immutable in PINS.items():
        text = text.replace(mutable, immutable)
    if text != original:
        path.write_text(text, encoding='utf-8')
        changed.append(str(path))
    for line_no, line in enumerate(text.splitlines(), 1):
        if 'uses: actions/' in line and '@v' in line:
            remaining.append(f'{path}:{line_no}:{line.strip()}')

print(f'PINNED_WORKFLOW_FILES={len(changed)}')
for path in changed:
    print(f'PINNED:{path}')
if remaining:
    print('UNPINNED_ACTION_REFS_REMAIN')
    for item in remaining:
        print(item)
    raise SystemExit(1)
print('ALL_KNOWN_ACTION_REFS_IMMUTABLE')
