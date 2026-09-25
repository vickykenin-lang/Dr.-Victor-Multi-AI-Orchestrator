#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / 'data' / 'revenue_outcomes.json'
OUT = ROOT / 'data' / 'package8_commercial_status.json'


def main() -> int:
    ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
    totals = ledger.get('verified_totals') or {}
    events = ledger.get('events') or []
    payments = int(totals.get('payments_received') or 0)
    revenue = float(totals.get('collected_revenue_inr') or 0.0)
    verified_payment_events = [
        e for e in events
        if str(e.get('event_type', '')).upper() == 'PAYMENT_RECEIVED'
        and e.get('verified') is True
        and e.get('evidence')
    ]
    complete = payments > 0 and revenue > 0 and len(verified_payment_events) >= payments
    record = {
        'schema_version': 1,
        'package': 8,
        'status': 'PASS' if complete else 'PENDING_REAL_BUSINESS_OUTCOME',
        'canonical_revenue_status': ledger.get('status', 'UNKNOWN'),
        'payments_received': payments,
        'collected_revenue_inr': revenue,
        'verified_payment_event_count': len(verified_payment_events),
        'required_chain': [
            'ASSET_OR_OFFER',
            'TRAFFIC_OR_LEAD',
            'ATTRIBUTED_ACTION',
            'QUALIFYING_ORDER_OR_CLOSED_WON',
            'PAYMENT_OR_APPROVED_COMMISSION',
            'SETTLEMENT_EVIDENCE',
        ],
        'truth_rule': 'Engineering activity, clicks, orders, estimates or workflow success are not revenue unless independently verified payment/commission evidence exists.',
        'secrets_exposed': False,
    }
    OUT.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(record, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
