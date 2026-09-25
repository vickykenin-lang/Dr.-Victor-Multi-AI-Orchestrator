#!/usr/bin/env python3
import json
from pathlib import Path
from orchestrator.revenue import summarize
ROOT=Path(__file__).resolve().parents[1]
ledger=json.loads((ROOT/'data/revenue_outcomes.json').read_text())
computed=summarize(ledger.get('events',[]))
status={
 'schema_version':1,
 'technical_validation':'PASS' if computed['invalid_event_count']==0 else 'FAIL',
 'verified_business_outcome': computed['payments_received']>0 and computed['collected_revenue_inr']>0,
 'payments_received':computed['payments_received'],
 'collected_revenue_inr':computed['collected_revenue_inr'],
 'external_dependency_required': not (computed['payments_received']>0 and computed['collected_revenue_inr']>0),
 'required_external_proof':['LEAD_CAPTURE','CONTACT','QUALIFICATION','CLOSE','PAYMENT'] if computed['payments_received']==0 else [],
 'truth_rule':'No engineering activity, traffic, clicks, orders, estimates, or workflow success count as revenue without independently verified PAYMENT_RECEIVED evidence.'
}
print(json.dumps(status,indent=2))
raise SystemExit(0 if status['technical_validation']=='PASS' else 1)
