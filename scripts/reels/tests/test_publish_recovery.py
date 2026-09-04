from __future__ import annotations

import sys
import unittest
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from validate_publish_check import PagesReadConfig, wait_for_production_deployment


SHA = "a" * 40
DESCENDANT_SHA = "b" * 40
PROJECT = "guia-do-proprietario-portal"
CONFIG = PagesReadConfig("0" * 32, PROJECT, "secret")


def deployment(*, sha: str, status: str = "success", skipped: bool = False) -> dict:
    return {
        "id": f"deployment-{sha[:7]}-{status}",
        "project_name": PROJECT,
        "environment": "production",
        "is_skipped": skipped,
        "latest_stage": {"status": status},
        "deployment_trigger": {"metadata": {"branch": "main", "commit_hash": sha}},
        "source": {"config": {"production_branch": "main"}},
    }


class PublishRecoveryTests(unittest.TestCase):
    def _recover_after_terminal_exact(self, exact: dict) -> dict:
        responses = iter([
            [exact],
            [exact, deployment(sha=DESCENDANT_SHA, status="success")],
        ])
        ticks = iter([0, 1, 2])
        return wait_for_production_deployment(
            CONFIG,
            sha=SHA,
            timeout_seconds=10,
            poll_interval_seconds=0,
            fetcher=lambda _config, _sha: next(responses),
            sleeper=lambda _seconds: None,
            monotonic=lambda: next(ticks),
            ancestor_checker=lambda _repo, ancestor, descendant: (
                ancestor == SHA and descendant == DESCENDANT_SHA
            ),
            wait_after_terminal_failure=True,
        )

    def test_failed_exact_waits_for_later_successful_descendant(self):
        result = self._recover_after_terminal_exact(
            deployment(sha=SHA, status="failure")
        )
        self.assertEqual(
            result["deployment_trigger"]["metadata"]["commit_hash"],
            DESCENDANT_SHA,
        )

    def test_skipped_exact_waits_for_later_successful_descendant(self):
        result = self._recover_after_terminal_exact(
            deployment(sha=SHA, status="skipped", skipped=True)
        )
        self.assertEqual(
            result["deployment_trigger"]["metadata"]["commit_hash"],
            DESCENDANT_SHA,
        )


if __name__ == "__main__":
    unittest.main()
