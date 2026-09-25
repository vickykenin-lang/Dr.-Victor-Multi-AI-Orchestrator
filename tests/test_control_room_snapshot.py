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
        self.assertIn('Missing evidence is UNKNOWN', self.record['truth_policy'])
        self.assertTrue(self.record['acceptance']['unknown_when_missing'])
        self.assertTrue(self.record['acceptance']['business_success_must_be_independently_verified'])

    def test_required_surfaces(self):
        for key in ('canonical', 'objective', 'autonomy', 'safety', 'departments', 'business_outcome'):
            self.assertIn(key, self.record)

    def test_autonomy_boundaries_are_explicit(self):
        a = self.record['autonomy']
        self.assertFalse(a['production_autonomy_enabled'])
        self.assertEqual(a['amber_mode'], 'GOVERNED_REVERSIBLE_ONLY')
        self.assertEqual(a['red_mode'], 'FOUNDER_GATED')
        self.assertEqual(a['green_unattended_scope'], ['repo.read', 'evidence.read', 'sandbox.execute'])

    def test_zero_revenue_is_not_success(self):
        b = self.record['business_outcome']
        if b['payments_received'] == 0:
            self.assertFalse(b['verified'])


if __name__ == '__main__':
    unittest.main()
