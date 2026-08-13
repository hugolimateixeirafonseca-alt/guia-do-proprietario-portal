from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[3]
AUTO_WORKFLOW = (ROOT / ".github/workflows/generate-reel-on-publish.yml").read_text(encoding="utf-8")
PUBLISH_WORKFLOW = (ROOT / ".github/workflows/publicar-artigos.yml").read_text(encoding="utf-8")
GENERATOR_WORKFLOW = (ROOT / ".github/workflows/generate-reel-ai.yml").read_text(encoding="utf-8")


class WorkflowWiringTests(unittest.TestCase):
    def test_workflows_continuam_yaml_valido(self):
        self.assertIsInstance(yaml.safe_load(AUTO_WORKFLOW), dict)
        self.assertIsInstance(yaml.safe_load(PUBLISH_WORKFLOW), dict)

    def test_repository_dispatch_e_push_relevante(self):
        self.assertIn("repository_dispatch:", AUTO_WORKFLOW)
        self.assertIn("types: [reel_publish_candidate]", AUTO_WORKFLOW)
        self.assertIn("push:", AUTO_WORKFLOW)
        self.assertIn("branches: [main]", AUTO_WORKFLOW)
        self.assertIn("src/content/artigos/**", AUTO_WORKFLOW)
        self.assertNotIn("check_run:", AUTO_WORKFLOW)

    def test_feature_flag_desligada_bloqueia_o_job(self):
        self.assertIn("vars.REELS_AUTO_PUBLISH_ENABLED == 'true'", AUTO_WORKFLOW)
        self.assertIn('if [[ "$REELS_AUTO_PUBLISH_ENABLED" == "true" ]]', PUBLISH_WORKFLOW)

    def test_dispatch_envia_apenas_sha(self):
        self.assertIn("PUBLISHED_SHA=\"$(git rev-parse HEAD)\"", PUBLISH_WORKFLOW)
        self.assertIn("client_payload[sha]", PUBLISH_WORKFLOW)
        self.assertNotRegex(PUBLISH_WORKFLOW, r"client_payload\[(slug|path|template|generation_id)\]")

    def test_validador_recebe_evento_sem_slug(self):
        command = re.search(
            r"python scripts/reels/validate_publish_check\.py(?P<body>.*?)--activation-sha",
            AUTO_WORKFLOW,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(command)
        self.assertNotIn("slug", command.group("body"))

    def test_regenerar_manual_permanece_independente(self):
        self.assertIn("workflow_dispatch:", GENERATOR_WORKFLOW)
        self.assertIn("slug:", GENERATOR_WORKFLOW)
        self.assertIn("publication_sha:", GENERATOR_WORKFLOW)
        self.assertIn("default: \"\"", GENERATOR_WORKFLOW)


if __name__ == "__main__":
    unittest.main()
