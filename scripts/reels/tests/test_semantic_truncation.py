from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from pydantic import ValidationError


REELS_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = REELS_DIR.parents[1]
sys.path.insert(0, str(REELS_DIR))

from ai.article import read_article
from ai.schema import FINAL_REEL_ADAPTER
from ai.semantic import validate_semantics


class SemanticTruncationTests(unittest.TestCase):
    def setUp(self):
        fixture_path = REELS_DIR / "data" / "herdei-uma-casa.json"
        self.payload = json.loads(fixture_path.read_text(encoding="utf-8"))
        self.article = read_article(REPOSITORY_ROOT, "herdei-uma-casa")

    def test_texto_natural_exatamente_no_limite_e_aceite(self):
        value = "Prepare a herança com mais calma"
        self.assertEqual(len(value), 32)
        self.payload["intro"]["title"] = value

        validate_semantics(self.payload, self.article, REPOSITORY_ROOT)

    def test_trailing_fragment_continua_rejeitado(self):
        self.payload["warning"]["body"] = "A frase termina para"

        with self.assertRaisesRegex(ValueError, "termina de forma fragmentada"):
            validate_semantics(self.payload, self.article, REPOSITORY_ROOT)

    def test_texto_acima_do_limite_continua_rejeitado_estruturalmente(self):
        self.payload["intro"]["title"] = "x" * 33

        with self.assertRaises(ValidationError):
            FINAL_REEL_ADAPTER.validate_python(self.payload)


if __name__ == "__main__":
    unittest.main()
