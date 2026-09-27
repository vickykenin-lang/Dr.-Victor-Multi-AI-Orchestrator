import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'


class ControlRoomLiveEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'build_control_room_snapshot.py')], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'apply_control_room_live_evidence.py')], cwd=ROOT, check=True)
        cls.record = json.loads((DATA / 'control_room_snapshot.json').read_text(encoding='utf-8'))
        cls.live = json.loads((DATA / 'control_room_live_evidence.json').read_text(encoding='utf-8'))

    def test_live_receipt_has_explicit_boundaries(self):
        boundary = self.live['evidence_boundary']
        self.assertFalse(boundary['action_contract_instance_verified'])
        self.assertFalse(boundary['procedure_use_verified'])
        self.assertFalse(boundary['memory_engine_read_write_verified'])
        self.assertTrue(boundary['department_result_verified'])
        self.assertFalse(boundary['commercial_outcome_upgraded'])

    def test_fresh_live_dispatch_overlays_historical_repository_state(self):
        f = self.record['live_evidence']['conversation_state_freshness']
        if f['state'] == 'FRESH':
            dispatch = self.record['department_execution']['dispatch']
            self.assertEqual(dispatch['status'], 'CURRENT')
            self.assertEqual(dispatch['target'], 'rio')
            self.assertEqual(dispatch['task_id'], 'victor-rio-1790482538790-1467')
            self.assertNotIn('CURRENT_DEPARTMENT_DISPATCH_NOT_VERIFIED', self.record['truthfulness']['unresolved_surfaces'])

    def test_verified_external_result_is_promoted_only_when_explicitly_verified(self):
        result = self.record['department_execution']['result']
        if self.record['live_evidence']['conversation_state_freshness']['state'] == 'FRESH':
            self.assertEqual(result['status'], 'CURRENT')
            self.assertTrue(result['verified'])
            self.assertEqual(result['result']['task_id'], 'victor-rio-1790482538790-1467')
            self.assertEqual(result['result']['execution_status'], 'COMPLETED_READ_ONLY_DIAGNOSTIC')
            self.assertFalse(result['result']['public_action_performed'])
            self.assertFalse(result['result']['credential_transfer_performed'])
            self.assertNotIn('CURRENT_DEPARTMENT_RESULT_NOT_VERIFIED', self.record['truthfulness']['unresolved_surfaces'])

    def test_fresh_heartbeat_surfaces_watchdog_and_authority_without_expansion(self):
        f = self.record['live_evidence']['heartbeat_freshness']
        if f['state'] == 'FRESH':
            watchdog = self.record['watchdog_retry']['watchdog']
            authority = self.record['autonomy_authority']
            self.assertEqual(watchdog['current_runtime_state'], 'PASS')
            self.assertTrue(watchdog['runtime_ready'])
            self.assertFalse(authority['production_autonomy_enabled'])
            self.assertEqual(authority['allowed_trigger'], 'founder-command')
            self.assertTrue(authority['live_boundary_verified'])

    def test_missing_action_contract_procedure_and_memory_stay_unverified(self):
        self.assertEqual(self.record['action_contract']['current_instance_status'], 'NOT_VERIFIED')
        self.assertEqual(self.record['procedure_use']['current_procedure_status'], 'NOT_VERIFIED')
        self.assertEqual(self.record['memory_state']['current_runtime_read_or_write'], 'NOT_VERIFIED')

    def test_step14_still_cannot_close(self):
        self.assertFalse(self.record['acceptance']['closure_claimed'])
        self.assertFalse(self.record['acceptance']['step14_ready_for_final_acceptance'])
        self.assertTrue(self.record['truthfulness']['unresolved_surfaces'])


if __name__ == '__main__':
    unittest.main()
