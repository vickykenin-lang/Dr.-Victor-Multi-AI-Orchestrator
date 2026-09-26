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
    p7 = read('package7_control_room_status.json')
    p8 = read('package8_commercial_status.json')
    p9 = read('package9_security_status.json')
    revenue = read('revenue_outcomes.json')
    canonical = read('canonical_status_index.json')
    autonomy = read('autonomy_state.json')
    founder = read('founder_action_batch.json')

    p6_prequalified = (p6.get('prequalification') or {}).get('status') == 'PASS_FOR_FORWARD_EXECUTION_ONLY'

    checks = {
        'canonical_truth_available': bool(canonical),
        'package6_seven_day_reliability_pass': p6.get('status') == 'PASS',
        'package7_truthful_control_room_pass': p7.get('status') == 'PASS',
        'package8_real_business_outcome_pass': p8.get('status') == 'PASS',
        'package9_security_pass_without_admin_carry_forward': p9.get('status') == 'PASS',
        'verified_payment_exists': (revenue.get('verified_totals') or {}).get('payments_received', 0) > 0,
        'production_autonomy_not_unrestricted': autonomy.get('production_autonomy_enabled', False) is False,
        'red_remains_founder_gated': (autonomy.get('autonomy_rollout_state') or {}).get('red') == 'FOUNDER_GATED',
    }
    ready = all(checks.values())
    pending = [k for k, v in checks.items() if not v]

    forward_execution_allowed = all([
        bool(canonical),
        p6_prequalified or p6.get('status') == 'PASS',
        p7.get('status') == 'PASS',
        autonomy.get('production_autonomy_enabled', False) is False,
        (autonomy.get('autonomy_rollout_state') or {}).get('red') == 'FOUNDER_GATED',
    ])

    result = {
        'schema_version': 3,
        'status': 'FINAL_ENDGAME_PASS' if ready else 'FINAL_ENDGAME_NOT_READY',
        'forward_execution': {
            'allowed': forward_execution_allowed,
            'package6_prequalified_only': p6_prequalified and p6.get('status') != 'PASS',
            'constraint': 'Forward execution does not convert Package 6 into final PASS; seven-day recertification remains mandatory.',
        },
        'checks': checks,
        'pending_checks': pending,
        'package_states': {
            'package6': p6.get('status', 'UNKNOWN'),
            'package7': p7.get('status', 'UNKNOWN'),
            'package8': p8.get('status', 'UNKNOWN'),
            'package9': p9.get('status', 'UNKNOWN'),
        },
        'founder_action_batch_status': founder.get('status', 'UNKNOWN'),
        'acceptance_chain': [
            'CONFIG_OR_CREDENTIAL_AVAILABLE',
            'SOURCE_IMPLEMENTED',
            'TEST_PASSED',
            'PRODUCTION_DEPLOYED',
            'LIVE_REQUEST_VERIFIED',
            'REAL_OUTPUT_VERIFIED',
            'REAL_BUSINESS_OUTCOME_VERIFIED',
        ],
        'truth_rule': 'Prequalification may permit downstream work but never substitutes for final certification. No earlier stage implies a later stage. Missing evidence is UNKNOWN/NOT_READY.',
    }
    (DATA / 'final_endgame_status.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
