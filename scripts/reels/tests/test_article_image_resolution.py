from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


REELS_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = REELS_DIR.parents[1]
sys.path.insert(0, str(REELS_DIR))

from ai.article import read_article
from ai.schema import OrderedStepsOutput, build_final_reel
from content import load_content
from layouts import render_intro


def ordered_editorial() -> OrderedStepsOutput:
    return OrderedStepsOutput.model_validate(
        {
            "intro": {
                "title": "Limpar o sofá",
                "accent": "Por onde começar?",
                "label": "GUIA PRÁTICO",
                "subtitle": "Veja quando limpar e quando pedir ajuda.",
            },
            "steps": [
                {"title": "Identifique o tecido"},
                {"title": "Teste a limpeza"},
                {"title": "Avalie as manchas"},
            ],
            "warning": {
                "eyebrow": "Atenção",
                "title": "Teste primeiro",
                "body": "Evite estragar o tecido.",
                "secondary": "Em caso de dúvida, peça ajuda.",
            },
            "outro": {"title": "Escolha a limpeza certa para o seu sofá."},
        }
    )


class ArticleImageResolutionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / "src" / "content" / "artigos").mkdir(parents=True)

    def tearDown(self):
        self.temporary.cleanup()

    def write_article(self, image: str = "/imagens/artigos/teste.avif") -> None:
        path = self.root / "src" / "content" / "artigos" / "teste.mdx"
        path.write_text(
            "---\n"
            'titulo: "Artigo de teste"\n'
            'descricao: "Descrição factual."\n'
            "pilar: manutencao\n"
            f'imagem_capa: "{image}"\n'
            "---\n\n"
            "Conteúdo factual do artigo.\n",
            encoding="utf-8",
        )

    def write_image(self, relative: str, *, valid: bool = False) -> Path:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if valid:
            Image.new("RGB", (1200, 800), "#94aa9d").save(path)
        else:
            path.write_bytes(b"image")
        return path

    def test_public_avif_exists_and_remains_preferred(self):
        self.write_article()
        expected = self.write_image("public/imagens/artigos/teste.avif")
        self.write_image("imagens/artigos/teste.png")

        article = read_article(self.root, "teste")

        self.assertEqual(article.hero_image, "public/imagens/artigos/teste.avif")
        self.assertEqual(article.hero_path, expected)

    def test_missing_avif_uses_source_png(self):
        self.write_article()
        expected = self.write_image("imagens/artigos/teste.png")

        article = read_article(self.root, "teste")

        self.assertEqual(article.hero_image, "imagens/artigos/teste.png")
        self.assertEqual(article.hero_path, expected)

    def test_missing_avif_uses_source_jpg(self):
        self.write_article()
        expected = self.write_image("imagens/artigos/teste.jpg")

        article = read_article(self.root, "teste")

        self.assertEqual(article.hero_image, "imagens/artigos/teste.jpg")
        self.assertEqual(article.hero_path, expected)

    def test_missing_avif_uses_source_jpeg(self):
        self.write_article()
        expected = self.write_image("imagens/artigos/teste.jpeg")

        article = read_article(self.root, "teste")

        self.assertEqual(article.hero_image, "imagens/artigos/teste.jpeg")
        self.assertEqual(article.hero_path, expected)

    def test_missing_published_and_source_images_fails(self):
        self.write_article()

        with self.assertRaisesRegex(FileNotFoundError, "A imagem de capa não existe"):
            read_article(self.root, "teste")

    def test_invalid_or_traversal_path_is_rejected(self):
        for image in (
            "C:/ficheiro.avif",
            "/externo/ficheiro.avif",
            "/imagens/../segredo.avif",
            "/imagens/artigos/../../segredo.avif",
            "/imagens\\artigos\\teste.avif",
        ):
            with self.subTest(image=image):
                self.write_article(image)
                with self.assertRaisesRegex(ValueError, "imagem_capa"):
                    read_article(self.root, "teste")

    def test_final_json_and_renderer_use_real_fallback_png(self):
        self.write_article()
        expected = self.write_image("imagens/artigos/teste.png", valid=True)
        article = read_article(self.root, "teste")
        final = build_final_reel(
            ordered_editorial(),
            template="ordered_steps",
            slug=article.slug,
            category=article.category,
            hero_image=article.hero_image,
        )
        json_path = self.root / "reel.json"
        json_path.write_text(json.dumps(final, ensure_ascii=False), encoding="utf-8")

        loaded = load_content(json_path, self.root)
        frame = render_intro(loaded)

        self.assertEqual(final["heroImage"], "imagens/artigos/teste.png")
        self.assertEqual(loaded["_hero_path"], expected)
        self.assertEqual(frame.size, (1080, 1920))

    def test_approved_articles_keep_using_published_avif(self):
        for slug in (
            "herdei-uma-casa",
            "ar-condicionado-quanto-custa",
            "vizinho-barulhento",
        ):
            with self.subTest(slug=slug):
                article = read_article(REPOSITORY_ROOT, slug)
                self.assertEqual(article.hero_image, f"public/imagens/artigos/{slug}.avif")
                self.assertTrue(article.hero_path.is_file())


if __name__ == "__main__":
    unittest.main()
