from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[3]
AUTO_WORKFLOW = (ROOT / ".github/workflows/generate-reel-on-publish.yml").read_text(encoding="utf-8")
PUBLISH_WORKFLOW = (ROOT / ".github/workflows/publicar-artigos.yml").read_text(encoding="utf-8")
GENERATOR_WORKFLOW = (ROOT / ".github/workflows/generate-reel-ai.yml").read_text(encoding="utf-8")
RECONCILE_WORKFLOW = (ROOT / ".github/workflows/reconcile-reels.yml").read_text(encoding="utf-8")
PRUNE_WORKFLOW = (ROOT / ".github/workflows/prune-pages-queue-and-deploy-latest.yml").read_text(encoding="utf-8")


class WorkflowWiringTests(unittest.TestCase):
    def test_workflows_continuam_yaml_valido(self):
        for source in (AUTO_WORKFLOW, PUBLISH_WORKFLOW, RECONCILE_WORKFLOW, PRUNE_WORKFLOW):
            with self.subTest(source=source[:40]):
                self.assertIsInstance(yaml.safe_load(source), dict)

    def test_automatico_recebe_repository_dispatch(self):
        self.assertIn("repository_dispatch:", AUTO_WORKFLOW)
        self.assertIn("types: [reel_publish_candidate]", AUTO_WORKFLOW)
        self.assertNotIn("check_run:", AUTO_WORKFLOW)

    def test_feature_flag_so_desliga_quando_explicitamente_false(self):
        self.assertIn("vars.REELS_AUTO_PUBLISH_ENABLED != 'false'", AUTO_WORKFLOW)
        self.assertIn("vars.REELS_AUTO_PUBLISH_ENABLED != 'false'", RECONCILE_WORKFLOW)

    def test_publicador_dispara_deploy_e_reel_diretamente(self):
        self.assertIn("PUBLISHED_SHA=\"$(git rev-parse HEAD)\"", PUBLISH_WORKFLOW)
        self.assertIn("event_type='deploy_portal'", PUBLISH_WORKFLOW)
        self.assertIn("event_type='reel_publish_candidate'", PUBLISH_WORKFLOW)
        self.assertIn("REEL_DISPATCHED=false", PUBLISH_WORKFLOW)
        self.assertNotRegex(PUBLISH_WORKFLOW, r"client_payload\[(slug|path|template|generation_id)\]")

    def test_reconciliador_tem_tres_janelas_e_so_reenvia_o_mais_recente(self):
        self.assertIn("cron: '15 8,10,12 * * *'", RECONCILE_WORKFLOW)
        self.assertIn("--since='48 hours ago'", RECONCILE_WORKFLOW)
        self.assertIn("print $1; exit", RECONCILE_WORKFLOW)
        self.assertIn("LATEST_SHA", RECONCILE_WORKFLOW)
        self.assertIn("event_type='reel_publish_candidate'", RECONCILE_WORKFLOW)
        self.assertIn("client_payload[sha]", RECONCILE_WORKFLOW)
        self.assertNotIn("mapfile -t SHAS", RECONCILE_WORKFLOW)
        self.assertNotRegex(RECONCILE_WORKFLOW, r"client_payload\[(slug|path|template|generation_id)\]")

    def test_validador_recebe_evento_sem_slug(self):
        command = re.search(
            r"python scripts/reels/validate_publish_check\.py(?P<body>.*?)--activation-sha",
            AUTO_WORKFLOW,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(command)
        self.assertNotIn("slug", command.group("body"))

    def test_pages_watcher_tem_folga_para_builds_lentos(self):
        self.assertIn("timeout-minutes: 40", PRUNE_WORKFLOW)
        self.assertIn("35 * 60 * 1000", PRUNE_WORKFLOW)

    def test_regenerar_manual_permanece_independente(self):
        self.assertIn("workflow_dispatch:", GENERATOR_WORKFLOW)
        self.assertIn("slug:", GENERATOR_WORKFLOW)
        self.assertIn("publication_sha:", GENERATOR_WORKFLOW)
        self.assertIn("default: \"\"", GENERATOR_WORKFLOW)


if __name__ == "__main__":
    unittest.main()
