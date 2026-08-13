from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from validate_publish_check import (
    PagesReadConfig,
    extract_candidate_sha,
    validate_production_deployment,
    validate_sha,
    wait_for_production_deployment,
)


SHA = "a" * 40
OTHER_SHA = "b" * 40
DEPLOYMENT_ID = "8b485b5f-cf7f-4ea2-a573-81706dfb4f16"
PROJECT = "guia-do-proprietario-portal"
CONFIG = PagesReadConfig("0" * 32, PROJECT, "secret")


def dispatch_event(*, sha: str = SHA, extra: dict | None = None) -> dict:
    client_payload = {"sha": sha}
    client_payload.update(extra or {})
    return {"action": "reel_publish_candidate", "client_payload": client_payload}


def push_event(*, sha: str = SHA, ref: str = "refs/heads/main") -> dict:
    return {"after": sha, "ref": ref}


def deployment(
    *,
    environment: str = "production",
    status: str = "success",
    sha: str = SHA,
    skipped: bool = False,
    project: str = PROJECT,
) -> dict:
    return {
        "id": DEPLOYMENT_ID,
        "project_name": project,
        "environment": environment,
        "is_skipped": skipped,
        "latest_stage": {"status": status},
        "deployment_trigger": {"metadata": {"branch": "main", "commit_hash": sha}},
        "source": {"config": {"production_branch": "main"}},
    }


def wait_with(responses: list[list[dict]], *, timeout: float = 10) -> dict:
    pending = iter(responses)
    ticks = iter([0, 1, 2, timeout + 1])
    return wait_for_production_deployment(
        CONFIG,
        sha=SHA,
        timeout_seconds=timeout,
        poll_interval_seconds=0,
        fetcher=lambda _config: next(pending),
        sleeper=lambda _seconds: None,
        monotonic=lambda: next(ticks),
    )


class PublishCheckTests(unittest.TestCase):
    def test_repository_dispatch_valido(self):
        self.assertEqual(extract_candidate_sha(dispatch_event(), "repository_dispatch"), SHA)

    def test_payload_sem_sha(self):
        with self.assertRaisesRegex(ValueError, "exclusivamente"):
            extract_candidate_sha(
                {"action": "reel_publish_candidate", "client_payload": {}},
                "repository_dispatch",
            )

    def test_sha_invalido(self):
        with self.assertRaisesRegex(ValueError, "SHA completo"):
            extract_candidate_sha(dispatch_event(sha="abc"), "repository_dispatch")

    def test_dispatch_nao_aceita_slug_nem_outros_campos(self):
        with self.assertRaisesRegex(ValueError, "exclusivamente"):
            extract_candidate_sha(
                dispatch_event(extra={"slug": "nao-confiar"}),
                "repository_dispatch",
            )

    def test_push_main_valido(self):
        self.assertEqual(extract_candidate_sha(push_event(), "push"), SHA)
        with self.assertRaisesRegex(ValueError, "branch main"):
            extract_candidate_sha(push_event(ref="refs/heads/feature"), "push")

    def test_deployment_ainda_em_curso_e_depois_success(self):
        result = wait_with([[deployment(status="active")], [deployment()]])
        self.assertEqual(result["id"], DEPLOYMENT_ID)

    def test_deployment_production_success(self):
        validate_production_deployment(deployment(), sha=SHA, project_name=PROJECT)

    def test_deployment_failure_e_canceled(self):
        for status in ("failure", "canceled"):
            with self.subTest(status=status), self.assertRaisesRegex(ValueError, status):
                wait_with([[deployment(status=status)]])

    def test_deployment_skipped(self):
        with self.assertRaisesRegex(ValueError, "ignorado"):
            wait_with([[deployment(skipped=True)]])

    def test_deployment_preview_ignorado(self):
        result = wait_with([[deployment(environment="preview")], [deployment()]])
        self.assertEqual(result["id"], DEPLOYMENT_ID)

    def test_deployment_com_sha_diferente_ignorado(self):
        result = wait_with([[deployment(sha=OTHER_SHA)], [deployment()]])
        self.assertEqual(result["id"], DEPLOYMENT_ID)

    def test_timeout_sem_deployment(self):
        ticks = iter([0, 11])
        with self.assertRaisesRegex(RuntimeError, "Timeout"):
            wait_for_production_deployment(
                CONFIG,
                sha=SHA,
                timeout_seconds=10,
                poll_interval_seconds=0,
                fetcher=lambda _config: [],
                sleeper=lambda _seconds: None,
                monotonic=lambda: next(ticks),
            )

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
