from __future__ import annotations

import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from layouts import MARGIN, WIDTH, _draw_intro_headline, _draw_label_chip, _fit_text, _normalise_text, _title_size_cap


class ReelTitleTypographyTests(unittest.TestCase):
    def setUp(self):
        self.image = Image.new("RGB", (1080, 1920), "white")
        self.draw = ImageDraw.Draw(self.image)

    def test_titulo_e_destaque_do_reel_reportado_nao_se_sobrepoem(self):
        box = (MARGIN, 1030, WIDTH - MARGIN, 1305)
        title_bbox, accent_bbox = _draw_intro_headline(
            self.image,
            "Aquecimento: o custo real",
            "Compare por kW e horas",
            box,
        )

        self.assertLess(title_bbox[3], accent_bbox[1])
        self.assertGreaterEqual(title_bbox[0], box[0])
        self.assertLessEqual(title_bbox[2], box[2])
        self.assertLessEqual(accent_bbox[2], box[2])
        self.assertLessEqual(accent_bbox[3], box[3])

    def test_etiqueta_da_imagem_cresce_com_o_texto_sem_sair_da_margem(self):
        chip = _draw_label_chip(
            self.draw,
            "Não se deixe enganar pelo preço",
            (MARGIN + 32, 885),
            WIDTH - MARGIN,
        )

        self.assertGreater(chip[2], MARGIN + 342)
        self.assertLessEqual(chip[2], WIDTH - MARGIN)

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
