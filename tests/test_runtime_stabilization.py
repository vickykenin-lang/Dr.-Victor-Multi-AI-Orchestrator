import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class RuntimeStabilizationTests(unittest.TestCase):
    def test_end_game_execution_is_manual_only(self):
        autonomy = load("data/autonomy_policy.json")
        wrangler = (ROOT / "wrangler.toml").read_text(encoding="utf-8")
        heartbeat = (ROOT / ".github/workflows/victor_heartbeat.yml").read_text(encoding="utf-8")
        self.assertEqual(autonomy["execution_trigger"]["mode"], "FOUNDER_MANUAL_ONLY")
        self.assertNotIn("[triggers]", wrangler)
        self.assertNotIn("crons =", wrangler)
        self.assertNotIn("schedule:", heartbeat)
        self.assertIn("workflow_dispatch:", heartbeat)

    def test_production_control_plane_has_single_owner(self):
        ownership = load("data/runtime_ownership.json")
        self.assertTrue(ownership["no_duplicate_production_controller"])
        self.assertEqual(
            ownership["production_control_plane"]["owner"],
            "CLOUDFLARE_VICTOR_TELEGRAM_WORKER",
        )
        self.assertFalse(ownership["python_orchestrator"]["production_controller"])

    def test_report_card_target_is_ten_and_outcome_only(self):
        policy = load("data/victor_report_card_policy.json")
        self.assertEqual(policy["scale"]["target"], 10)
        self.assertEqual(policy["basis"], "VERIFIED_DEPARTMENT_FINAL_OUTCOMES_ONLY")
        self.assertIn("SYSTEM_GREEN", policy["zero_mark_inputs"])
        self.assertIn("FINAL_OUTCOME_VERIFIED", policy["ten_requirements"])
        self.assertIn("PAYMENT_RECEIVED", policy["revenue_outcome_requirement"])


if __name__ == "__main__":
    unittest.main()
