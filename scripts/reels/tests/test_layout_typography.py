from __future__ import annotations

import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from layouts import _fit_text, _normalise_text, _title_size_cap


class ReelTitleTypographyTests(unittest.TestCase):
    def setUp(self):
        self.draw = ImageDraw.Draw(Image.new("RGB", (1080, 1920), "white"))

    def test_tamanho_reduz_gradualmente_com_o_comprimento(self):
        short = _title_size_cap("Título curto", 64, 40)
        medium = _title_size_cap("Um título principal um pouco mais comprido", 64, 40)
        long = _title_size_cap("Um título principal bastante mais comprido que precisa de várias linhas", 64, 40)

        self.assertEqual(short, 64)
        self.assertGreater(short, medium)
        self.assertGreaterEqual(medium, long)
        self.assertGreaterEqual(long, 40)

    def test_titulo_longo_preserva_palavras_e_fica_ate_quatro_linhas(self):
        text = "Como preparar todos os documentos antes de colocar a sua casa à venda"
        chosen_font, wrapped, spacing = _fit_text(
            self.draw,
            text,
            (0, 0, 470, 360),
            64,
            40,
            title=True,
            max_lines=4,
        )

        self.assertEqual(wrapped.replace("\n", " "), _normalise_text(text))
        self.assertLessEqual(len(wrapped.splitlines()), 4)
        self.assertGreaterEqual(spacing, round(chosen_font.size * 0.22))

    def test_wrapping_nunca_hifeniza_nem_parte_palavras(self):
        text = "Documentação indispensável para vender sem bloqueios"
        _, wrapped, _ = _fit_text(
            self.draw,
            text,
            (0, 0, 360, 360),
            58,
            36,
            title=True,
            max_lines=4,
        )

        self.assertEqual(wrapped.split(), text.split())
        self.assertFalse(any(line.endswith("-") for line in wrapped.splitlines()))

    def test_palavra_que_nao_cabe_falha_em_vez_de_ser_partida(self):
        with self.assertRaisesRegex(ValueError, "não cabe"):
            _fit_text(
                self.draw,
                "Supercalifragilisticamente",
                (0, 0, 80, 300),
                58,
                36,
                title=True,
                max_lines=4,
            )


if __name__ == "__main__":
    unittest.main()
