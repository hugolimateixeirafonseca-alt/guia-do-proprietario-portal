from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


REELS_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = REELS_DIR.parents[1]
sys.path.insert(0, str(REELS_DIR))

from ai.article import Article, read_article
from ai.openai_client import generate_editorial
from ai.schema import FINAL_REEL_ADAPTER, GeneratedResponse, build_final_reel, parse_generated_json
from ai.semantic import validate_semantics
from pydantic import ValidationError


def valid_ordered() -> dict:
    return {
        "reel": {
            "template": "ordered_steps",
            "intro": {"title": "Herdei uma casa", "accent": "E agora?", "label": "5 PASSOS", "subtitle": "Comece pela ordem certa."},
            "steps": [{"title": "Participar o óbito"}, {"title": "Habilitar herdeiros"}, {"title": "Registar o imóvel"}],
            "warning": {"eyebrow": "Atenção", "title": "Não comece pela venda", "body": "Há passos a tratar primeiro.", "secondary": "A ordem evita bloqueios."},
            "outro": {"title": "Primeiro trate da ordem. Depois decida."},
        }
    }


class FakeResponses:
    def __init__(self, parsed: GeneratedResponse):
        self.parsed = parsed

    def parse(self, **kwargs):
        return SimpleNamespace(
            output_parsed=self.parsed,
            model=kwargs["model"],
            id="resp_test",
            usage=SimpleNamespace(input_tokens=10, output_tokens=20, total_tokens=30),
        )


class AIGenerationTests(unittest.TestCase):
    def test_slug_inexistente(self):
        with self.assertRaises(FileNotFoundError):
            read_article(REPOSITORY_ROOT, "slug-que-nao-existe")

    def test_api_key_ausente(self):
        with self.assertRaisesRegex(ValueError, "OPENAI_API_KEY"):
            generate_editorial({}, api_key="")

    def test_template_invalido(self):
        payload = valid_ordered()
        payload["reel"]["template"] = "novo_template"
        with self.assertRaises(ValidationError):
            GeneratedResponse.model_validate(payload)

    def test_steps_a_mais(self):
        payload = valid_ordered()
        payload["reel"]["steps"] *= 2
        with self.assertRaises(ValidationError):
            GeneratedResponse.model_validate(payload)

    def test_campo_obrigatorio_ausente(self):
        payload = valid_ordered()
        del payload["reel"]["intro"]["title"]
        with self.assertRaises(ValidationError):
            GeneratedResponse.model_validate(payload)

    def test_campo_extra_inesperado(self):
        payload = valid_ordered()
        payload["reel"]["campo_extra"] = "não permitido"
        with self.assertRaises(ValidationError):
            GeneratedResponse.model_validate(payload)

    def test_json_malformado(self):
        with self.assertRaisesRegex(ValueError, "JSON inválida"):
            parse_generated_json('{"reel":')

    def test_hero_image_inexistente(self):
        generated = GeneratedResponse.model_validate(valid_ordered())
        final = build_final_reel(generated.reel, slug="teste", category="CASA", hero_image="public/inexistente.avif")
        article = Article("teste", Path("teste.mdx"), "public/inexistente.avif", Path("inexistente"), "CASA", {}, "5")
        with self.assertRaisesRegex(ValueError, "heroImage não existe"):
            validate_semantics(final, article, REPOSITORY_ROOT)

    def test_valor_monetario_inventado(self):
        payload = {
            "version": 1,
            "template": "cost_highlight",
            "slug": "teste",
            "category": "CASA",
            "heroImage": "public/imagens/artigos/ar-condicionado-quanto-custa.avif",
            "intro": {"title": "Quanto custa?", "accent": "Veja o essencial", "label": "CUSTOS", "subtitle": "Prepare o orçamento."},
            "highlight": {"amount": "999 €", "caption": "Para uma divisão"},
            "progress": {"eyebrow": "O que pesa", "title": "A casa conta", "itemLabel": "fatores"},
            "steps": [{"number": 1, "title": "Tubagem"}, {"number": 2, "title": "Acesso"}, {"number": 3, "title": "Instalação"}],
            "warning": {"eyebrow": "Atenção", "title": "Compare", "body": "Peça orçamento.", "secondary": "Confirme o que está incluído."},
            "outro": {"title": "O preço não conta tudo.", "label": "Artigo completo no", "brand": "Guia do Proprietário", "domain": "guiadoproprietario.pt"},
        }
        article = read_article(REPOSITORY_ROOT, "ar-condicionado-quanto-custa")
        with self.assertRaisesRegex(ValueError, "valor monetário ausente"):
            validate_semantics(payload, article, REPOSITORY_ROOT)

    def test_api_mockada(self):
        parsed = GeneratedResponse.model_validate(valid_ordered())
        result, metadata = generate_editorial({}, api_key="teste", model="gpt-5-mini", client=SimpleNamespace(responses=FakeResponses(parsed)))
        self.assertEqual(result.reel.template, "ordered_steps")
        self.assertEqual(metadata.total_tokens, 30)

    def test_fixtures_aprovadas_cumprem_schema_e_semantica(self):
        for slug, template in (
            ("herdei-uma-casa", "ordered_steps"),
            ("ar-condicionado-quanto-custa", "cost_highlight"),
            ("vizinho-barulhento", "problem_solution"),
        ):
            with self.subTest(slug=slug):
                fixture_path = REELS_DIR / "data" / f"{slug}.json"
                fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
                fixture.setdefault("template", template)
                validated = FINAL_REEL_ADAPTER.validate_python(fixture).model_dump()
                validate_semantics(validated, read_article(REPOSITORY_ROOT, slug), REPOSITORY_ROOT)


if __name__ == "__main__":
    unittest.main()
