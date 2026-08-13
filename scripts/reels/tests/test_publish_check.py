from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from validate_publish_check import extract_check, validate_production_deployment, validate_sha


SHA = "a" * 40
DEPLOYMENT_ID = "8b485b5f-cf7f-4ea2-a573-81706dfb4f16"
PROJECT = "guia-do-proprietario-portal"


def event(*, conclusion: str = "success", app: str = "cloudflare-workers-and-pages") -> dict:
    return {
        "action": "completed",
        "check_run": {
            "name": "Cloudflare Pages",
            "conclusion": conclusion,
            "head_sha": SHA,
            "app": {"slug": app},
            "check_suite": {"head_branch": "main"},
            "details_url": (
                "https://dash.cloudflare.com/?to="
                f"/0123456789abcdef0123456789abcdef/pages/view/{PROJECT}/{DEPLOYMENT_ID}"
            ),
        },
    }


def deployment(*, environment: str = "production", status: str = "success", sha: str = SHA) -> dict:
    return {
        "project_name": PROJECT,
        "environment": environment,
        "is_skipped": False,
        "latest_stage": {"status": status},
        "deployment_trigger": {"metadata": {"branch": "main", "commit_hash": sha}},
        "source": {"config": {"production_branch": "main"}},
    }


class PublishCheckTests(unittest.TestCase):
    def test_aceita_check_cloudflare_externo(self):
        self.assertEqual(
            extract_check(event()),
            (SHA, "0123456789abcdef0123456789abcdef", PROJECT, DEPLOYMENT_ID),
        )

    def test_production_falhado_ou_cancelado(self):
        for conclusion in ("failure", "cancelled"):
            with self.subTest(conclusion=conclusion), self.assertRaises(ValueError):
                extract_check(event(conclusion=conclusion))
        for status in ("failure", "canceled"):
            with self.subTest(status=status), self.assertRaises(ValueError):
                validate_production_deployment(deployment(status=status), sha=SHA, project_name=PROJECT)

    def test_preview_e_rejeitado(self):
        with self.assertRaisesRegex(ValueError, "Preview"):
            validate_production_deployment(deployment(environment="preview"), sha=SHA, project_name=PROJECT)

    def test_sha_anterior_igual_e_fora_de_main(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "-C", str(root), "init", "-b", "main"], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Tests"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "tests@example.com"], check=True)
            (root / "file").write_text("base", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "file"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "base"], check=True, capture_output=True)
            base = subprocess.run(
                ["git", "-C", str(root), "rev-parse", "HEAD"], check=True, capture_output=True, text=True,
            ).stdout.strip()
            subprocess.run(["git", "-C", str(root), "branch", "origin/main"], check=True)
            with self.assertRaisesRegex(ValueError, "anterior ou igual"):
                validate_sha(root, sha=base, activation_sha=base)

            subprocess.run(["git", "-C", str(root), "checkout", "-b", "other"], check=True, capture_output=True)
            (root / "other").write_text("other", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "other"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "other"], check=True, capture_output=True)
            other = subprocess.run(
                ["git", "-C", str(root), "rev-parse", "HEAD"], check=True, capture_output=True, text=True,
            ).stdout.strip()
            with self.assertRaisesRegex(ValueError, "história atual de main"):
                validate_sha(root, sha=other, activation_sha=base)


if __name__ == "__main__":
    unittest.main()
