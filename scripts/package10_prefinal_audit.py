#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rev=json.loads((ROOT/'data/revenue_outcomes.json').read_text())
auto=json.loads((ROOT/'data/autonomy_state.json').read_text())
checks={
 'package7_control_room_source': (ROOT/'scripts/build_control_room_snapshot.py').exists(),
 'package8_revenue_validator': (ROOT/'scripts/validate_revenue_outcomes.py').exists(),
 'package9_security_inventory': (ROOT/'scripts/package9_security_audit.py').exists(),
 'production_autonomy_off': auto.get('production_autonomy_enabled') is False,
 'red_founder_gated': (auto.get('autonomy_rollout_state') or {}).get('red')=='FOUNDER_GATED',
 'business_outcome_verified': (rev.get('verified_totals') or {}).get('payments_received',0)>0 and (rev.get('verified_totals') or {}).get('collected_revenue_inr',0)>0,
}
founder_dependencies=[]
if not checks['business_outcome_verified']:
    founder_dependencies.append('Provide/authorize external merchant-affiliate PAYMENT_RECEIVED evidence when a real event exists; no synthetic revenue allowed.')
founder_dependencies += ['Enable main-branch protection / required checks using repository admin control.','Approve credential rotation only if final security audit still requires it.']
status='PREFINAL_READY_WITH_EXTERNAL_AND_ADMIN_DEPENDENCIES' if all(v for k,v in checks.items() if k!='business_outcome_verified') else 'PREFINAL_BLOCKED_TECHNICALLY'
print(json.dumps({'schema_version':1,'status':status,'checks':checks,'founder_action_batch':founder_dependencies,'package6_note':'Seven-day reliability certification must mature before final END GAME PASS.'},indent=2))
raise SystemExit(0 if status.startswith('PREFINAL_READY') else 1)
