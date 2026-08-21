from __future__ import annotations

import sys
import unittest
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
ROOT = REELS_DIR.parents[1]
sys.path.insert(0, str(REELS_DIR))

from ai.openai_client import create_openai_client


class FailureObservabilityTests(unittest.TestCase):
    def test_openai_client_retries_transient_failures_twice(self):
        captured: dict[str, object] = {}

        def factory(**kwargs):
            captured.update(kwargs)
            return object()

        client = create_openai_client(api_key="test-key", client_factory=factory)
        self.assertIsNotNone(client)
        self.assertEqual(captured["api_key"], "test-key")
        self.assertEqual(captured["max_retries"], 2)

    def test_workflow_records_specific_failure_stages(self):
        workflow = (ROOT / ".github" / "workflows" / "generate-reel-ai.yml").read_text(encoding="utf-8")
        for code in (
            "generate_json_failed",
            "render_failed",
            "video_validation_failed",
            "review_publish_failed",
            "trigger_complete_failed",
        ):
            with self.subTest(code=code):
                self.assertIn(code, workflow)
        self.assertIn('ERROR_CODE="${REEL_FAILURE_STAGE:-workflow_failed}"', workflow)
        self.assertIn("env.REEL_REVIEW_SAVED != 'true'", workflow)


if __name__ == "__main__":
    unittest.main()
