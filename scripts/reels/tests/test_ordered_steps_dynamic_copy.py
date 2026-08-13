from __future__ import annotations

import sys
import unittest
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from layouts import _intro_folio, _steps_eyebrow, _warning_folio


class OrderedStepsDynamicCopyTests(unittest.TestCase):
    def test_titulo_diferente_no_folio_da_introducao(self):
        data = {
            "template": "ordered_steps",
            "category": "CASA",
            "intro": {"title": "Vizinho barulhento"},
        }
        self.assertEqual(_intro_folio(data), "01  •  VIZINHO BARULHENTO")

    def test_eyebrow_reflete_tres_passos(self):
        data = {"steps": [{}, {}, {}]}
        self.assertEqual(_steps_eyebrow(data), "3 passos, por ordem")

    def test_warning_usa_eyebrow_do_json(self):
        data = {"warning": {"eyebrow": "Aviso jurídico"}}
        self.assertEqual(_warning_folio(data), "03  •  AVISO JURÍDICO")

    def test_herdei_uma_casa_mantem_os_textos_visuais_anteriores(self):
        data = {
            "template": "ordered_steps",
            "category": "VENDER CASA",
            "intro": {"title": "Herdei uma casa"},
            "steps": [{}, {}, {}, {}, {}],
            "warning": {"eyebrow": "Evite o bloqueio"},
        }
        self.assertEqual(_intro_folio(data), "01  •  HERDEI UMA CASA")
        self.assertEqual(_steps_eyebrow(data), "5 passos, por ordem")
        self.assertEqual(_warning_folio(data), "03  •  EVITE O BLOQUEIO")


if __name__ == "__main__":
    unittest.main()
