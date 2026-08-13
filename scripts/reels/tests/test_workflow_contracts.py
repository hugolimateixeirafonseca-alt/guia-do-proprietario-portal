from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


class WorkflowContractTests(unittest.TestCase):
    def test_dispatch_manual_continua_a_expor_apenas_slug(self):
        source = (ROOT / ".github/workflows/generate-reel-ai.yml").read_text(encoding="utf-8")
        dispatch = source.split("workflow_dispatch:", 1)[1].split("workflow_call:", 1)[0]
        inputs = re.findall(r"^\s{6}([a-z_]+):\s*$", dispatch, flags=re.MULTILINE)
        self.assertEqual(inputs, ["slug"])
        self.assertNotIn("publication_sha", dispatch)

    def test_automatico_esta_desativado_por_defeito_e_nao_e_preview(self):
        source = (ROOT / ".github/workflows/generate-reel-on-publish.yml").read_text(encoding="utf-8")
        self.assertIn("vars.REELS_AUTO_PUBLISH_ENABLED == 'true'", source)
        self.assertIn("validate_publish_check.py", source)
        self.assertIn("CLOUDFLARE_PAGES_READ_TOKEN", source)
        self.assertIn("REELS_AUTO_PUBLISH_ACTIVATION_SHA", source)

    def test_cada_slug_usa_o_gerador_existente_sem_fail_fast(self):
        source = (ROOT / ".github/workflows/generate-reel-on-publish.yml").read_text(encoding="utf-8")
        self.assertIn("fail-fast: false", source)
        self.assertIn("needs.detect.result == 'success'", source)
        self.assertIn("uses: ./.github/workflows/generate-reel-ai.yml", source)
        self.assertIn("slug: ${{ matrix.slug }}", source)


if __name__ == "__main__":
    unittest.main()
