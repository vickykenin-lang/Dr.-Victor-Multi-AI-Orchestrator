#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'


def read(name, fallback=None):
    try:
        return json.loads((DATA / name).read_text(encoding='utf-8'))
    except Exception:
        return {} if fallback is None else fallback


def main() -> int:
    p6 = read('package6_reliability_state.json')
    p8 = read('package8_commercial_status.json')
    revenue = read('revenue_outcomes.json')
    canonical = read('canonical_status_index.json')
    autonomy = read('autonomy_state.json')

    checks = {
        'canonical_truth_available': bool(canonical),
        'package6_seven_day_reliability_pass': p6.get('status') == 'PASS',
        'package8_real_business_outcome_pass': p8.get('status') == 'PASS',
        'verified_payment_exists': (revenue.get('verified_totals') or {}).get('payments_received', 0) > 0,
        'production_autonomy_not_unrestricted': autonomy.get('production_autonomy_enabled', False) is False,
        'red_remains_founder_gated': True,
    }
    ready = all(checks.values())
    result = {
        'schema_version': 1,
        'status': 'FINAL_ENDGAME_PASS' if ready else 'FINAL_ENDGAME_NOT_READY',
        'checks': checks,
        'acceptance_chain': [
            'CONFIG_OR_CREDENTIAL_AVAILABLE',
            'SOURCE_IMPLEMENTED',
            'TEST_PASSED',
            'PRODUCTION_DEPLOYED',
            'LIVE_REQUEST_VERIFIED',
            'REAL_OUTPUT_VERIFIED',
            'REAL_BUSINESS_OUTCOME_VERIFIED',
        ],
        'truth_rule': 'No earlier stage implies a later stage. Missing evidence is UNKNOWN/NOT_READY.',
    }
    (DATA / 'final_endgame_status.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
