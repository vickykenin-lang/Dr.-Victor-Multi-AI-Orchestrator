import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ControlRoomSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'build_control_room_snapshot.py')], cwd=ROOT, check=True)
        cls.record = json.loads((ROOT / 'data' / 'control_room_snapshot.json').read_text(encoding='utf-8'))

    def test_truth_policy(self):
        self.assertIn('Missing evidence is UNKNOWN/NOT_VERIFIED', self.record['truth_policy'])
        self.assertTrue(self.record['acceptance']['unknown_when_missing'])
        self.assertTrue(self.record['acceptance']['business_success_must_be_independently_verified'])
        self.assertFalse(self.record['acceptance']['closure_claimed'])

    def test_all_step14_required_surfaces_exist(self):
        required = (
            'objective', 'task', 'blocker', 'action_contract', 'department_execution',
            'evidence_freshness', 'watchdog_retry', 'procedure_use', 'memory_state',
            'autonomy_authority', 'commercial_outcome',
        )
        for key in required:
            self.assertIn(key, self.record, key)

    def test_missing_current_action_contract_is_not_inferred(self):
        contract = self.record['action_contract']
        self.assertTrue(contract['schema_source_present'])
        self.assertEqual(contract['current_instance_status'], 'NOT_VERIFIED')
        self.assertIsNone(contract['current_instance'])

    def test_historical_dispatch_and_result_are_labelled(self):
        dispatch = self.record['department_execution']['dispatch']
        result = self.record['department_execution']['result']
        self.assertIn(dispatch['status'], ('CURRENT', 'HISTORICAL', 'UNKNOWN'))
        self.assertIn(result['status'], ('CURRENT', 'HISTORICAL', 'UNKNOWN'))
        if dispatch['freshness']['state'] == 'STALE':
            self.assertEqual(dispatch['status'], 'HISTORICAL')
        if result['freshness']['state'] == 'STALE':
            self.assertEqual(result['status'], 'HISTORICAL')

    def test_watchdog_and_retry_are_separate(self):
        wr = self.record['watchdog_retry']
        self.assertIn('watchdog', wr)
        self.assertIn('retry', wr)
        self.assertEqual(wr['watchdog']['current_runtime_state'], 'NOT_VERIFIED')
        self.assertNotEqual(wr['watchdog']['fail_closed_action'], '')

    def test_procedure_and_memory_do_not_claim_runtime_use(self):
        self.assertTrue(self.record['procedure_use']['registry_source_present'])
        self.assertEqual(self.record['procedure_use']['current_procedure_status'], 'NOT_VERIFIED')
        self.assertEqual(self.record['memory_state']['current_runtime_read_or_write'], 'NOT_VERIFIED')
        self.assertFalse(self.record['memory_state']['memory_is_business_evidence'])
        self.assertTrue(self.record['memory_state']['fresh_evidence_required_for_external_claims'])

    def test_autonomy_authority_does_not_expand_from_observability(self):
        a = self.record['autonomy_authority']
        self.assertFalse(a['production_autonomy_enabled'])
        self.assertEqual(a['allowed_trigger'], 'founder-command')
        self.assertEqual(a['red'], 'FOUNDER_GATED')

    def test_zero_revenue_is_not_business_success(self):
        b = self.record['commercial_outcome']
        if b['payments_received'] == 0:
            self.assertFalse(b['verified_business_outcome'])
            self.assertEqual(b['collected_revenue_inr'], 0.0)

    def test_step14_pre_audit_cannot_close_while_required_truth_is_missing(self):
        truth = self.record['truthfulness']
        self.assertTrue(truth['step14_pre_audit_only'])
        self.assertTrue(truth['step13_final_certification_required_before_step14_closure'])
        self.assertTrue(truth['unknown_is_not_pass'])
        if truth['unresolved_surfaces']:
            self.assertFalse(self.record['acceptance']['step14_ready_for_final_acceptance'])


if __name__ == '__main__':
    unittest.main()
