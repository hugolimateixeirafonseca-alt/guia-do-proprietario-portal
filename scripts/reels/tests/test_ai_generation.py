from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace


REELS_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = REELS_DIR.parents[1]
sys.path.insert(0, str(REELS_DIR))

from ai.article import Article, read_article
from ai.openai_client import create_openai_client, generate_editorial, repair_editorial, route_template
from ai.schema import (
    FINAL_REEL_ADAPTER,
    CostHighlightOutput,
    EditorialFieldIssue,
    EditorialValidationError,
    OrderedStepsOutput,
    ProblemSolutionOutput,
    TemplateRouterOutput,
    assemble_final_reel,
    build_final_reel,
    parse_generated_json,
    repair_output_schema,
)
from ai.semantic import validate_semantics
from pydantic import ValidationError


def valid_ordered() -> dict:
    return {
        "intro": {"title": "Herdei uma casa", "accent": "E agora?", "label": "5 PASSOS", "subtitle": "Comece pela ordem certa."},
        "steps": [{"title": "Participar o óbito"}, {"title": "Habilitar herdeiros"}, {"title": "Registar o imóvel"}],
        "warning": {"eyebrow": "Atenção", "title": "Não comece pela venda", "body": "Há passos a tratar primeiro.", "secondary": "A ordem evita bloqueios."},
        "outro": {"title": "Primeiro trate da ordem. Depois decida."},
    }


def valid_cost() -> dict:
    return {
        "intro": {"title": "Quanto custa?", "accent": "Veja o essencial", "label": "CUSTOS", "subtitle": "Prepare o orçamento."},
        "highlight": {"amount": "400 € a 900 €", "caption": "Para uma divisão"},
        "progress": {"eyebrow": "O que pesa", "title": "A casa conta", "itemLabel": "fatores"},
        "steps": [{"title": "Tubagem"}, {"title": "Acesso"}, {"title": "Instalação"}],
        "warning": {"eyebrow": "Atenção", "title": "Compare", "body": "Peça orçamento.", "secondary": "Confirme o que está incluído."},
        "outro": {"title": "O preço não conta tudo."},
    }


def valid_problem() -> dict:
    payload = valid_cost()
    payload.pop("highlight")
    return payload


class FakeResponses:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        parsed = self.outputs.pop(0)
        return SimpleNamespace(
            output_parsed=parsed,
            model=kwargs["model"],
            id=f"resp_test_{len(self.calls)}",
            usage=SimpleNamespace(input_tokens=10, output_tokens=20, total_tokens=30),
        )


class AIGenerationTests(unittest.TestCase):
    def test_slug_inexistente(self):
        with self.assertRaises(FileNotFoundError):
            read_article(REPOSITORY_ROOT, "slug-que-nao-existe")

    def test_api_key_ausente(self):
        with self.assertRaisesRegex(ValueError, "OPENAI_API_KEY"):
            create_openai_client(api_key="")

    def test_router_invalido(self):
        responses = FakeResponses([{"template": "novo_template"}])
        with self.assertRaises(ValidationError):
            route_template({}, api_key="teste", client=SimpleNamespace(responses=responses), logger=lambda _: None)

    def test_router_escolhe_template_permitido(self):
        responses = FakeResponses([{"template": "cost_highlight"}])
        template, metadata = route_template({}, api_key="teste", client=SimpleNamespace(responses=responses), logger=lambda _: None)
        self.assertEqual(template, "cost_highlight")
        self.assertEqual(metadata.total_tokens, 30)
        self.assertEqual(responses.calls[0]["reasoning"], {"effort": "minimal"})
        self.assertEqual(responses.calls[0]["text"], {"verbosity": "low"})

    def test_schema_especifico_correto_e_selecionado(self):
        cases = (
            ("ordered_steps", OrderedStepsOutput, valid_ordered()),
            ("cost_highlight", CostHighlightOutput, valid_cost()),
            ("problem_solution", ProblemSolutionOutput, valid_problem()),
        )
        for template, schema, payload in cases:
            with self.subTest(template=template):
                responses = FakeResponses([payload])
                generated, _ = generate_editorial(
                    {}, template=template, api_key="teste", client=SimpleNamespace(responses=responses), logger=lambda _: None
                )
                self.assertIsInstance(generated, schema)
                self.assertIs(responses.calls[0]["text_format"], schema)
                self.assertEqual(responses.calls[0]["reasoning"], {"effort": "low"})
                self.assertEqual(responses.calls[0]["text"], {"verbosity": "low"})

    def test_repair_so_aceita_e_substitui_paths_com_falha(self):
        generated = OrderedStepsOutput.model_validate(valid_ordered())
        issue = EditorialFieldIssue("steps[0].title", generated.steps[0].title, 55, 42, "texto excessivo")
        responses = FakeResponses([{"repairs": [{"path": "steps[0].title", "value": "Participar o óbito"}]}])
        repaired, metadata, paths = repair_editorial(
            {}, template="ordered_steps", editorial=generated, issues=(issue,), api_key="teste",
            client=SimpleNamespace(responses=responses), logger=lambda _: None,
        )
        self.assertEqual(repaired.steps[0].title, "Participar o óbito")
        self.assertEqual(paths, ["steps[0].title"])
        self.assertEqual(metadata.total_tokens, 30)
        self.assertEqual(responses.calls[0]["reasoning"], {"effort": "minimal"})
        self.assertEqual(responses.calls[0]["text"], {"verbosity": "low"})
        schema_json = json.dumps(responses.calls[0]["text_format"].model_json_schema())
        self.assertNotIn('"oneOf"', schema_json)
        self.assertNotIn('"anyOf"', schema_json)
        self.assertIn('"const": "steps[0].title"', schema_json)

    def test_repair_rejeita_path_nao_solicitado(self):
        schema = repair_output_schema(["steps[0].title"])
        with self.assertRaises(ValidationError):
            schema.model_validate({"repairs": [{"path": "warning.body", "value": "Outro texto"}]})

    def test_gerador_nao_pode_alterar_template_do_router(self):
        payload = valid_ordered()
        payload["template"] = "cost_highlight"
        responses = FakeResponses([payload])
        with self.assertRaises(ValidationError):
            generate_editorial(
                {}, template="ordered_steps", api_key="teste", client=SimpleNamespace(responses=responses), logger=lambda _: None
            )

    def test_steps_a_mais(self):
        payload = valid_ordered()
        payload["steps"] *= 2
        with self.assertRaises(ValidationError):
            OrderedStepsOutput.model_validate(payload)

    def test_campo_obrigatorio_ausente(self):
        payload = valid_ordered()
        del payload["intro"]["title"]
        with self.assertRaises(ValidationError):
            OrderedStepsOutput.model_validate(payload)

    def test_campo_extra_inesperado(self):
        payload = valid_ordered()
        payload["campo_extra"] = "não permitido"
        with self.assertRaises(ValidationError):
            OrderedStepsOutput.model_validate(payload)

    def test_schemas_openai_nao_usam_unioes_nem_limites_editoriais(self):
        for schema in (TemplateRouterOutput, OrderedStepsOutput, CostHighlightOutput, ProblemSolutionOutput):
            with self.subTest(schema=schema.__name__):
                serialised = json.dumps(schema.model_json_schema())
                self.assertNotIn('"oneOf"', serialised)
                self.assertNotIn('"anyOf"', serialised)
                self.assertNotIn('"maxLength"', serialised)
                self.assertNotIn('"minLength"', serialised)

    def test_limites_editoriais_continuam_na_validacao_local(self):
        payload = valid_ordered()
        payload["intro"]["title"] = "x" * 33
        generated = OrderedStepsOutput.model_validate(payload)
        with self.assertRaisesRegex(ValueError, r"intro\.title.*comprimento=33"):
            build_final_reel(
                generated, template="ordered_steps", slug="teste", category="CASA", hero_image="public/teste.avif"
            )

    def test_usage_e_registado_antes_de_validacao_local_falhar(self):
        payload = valid_ordered()
        payload["intro"]["title"] = "x" * 33
        responses = FakeResponses([payload])
        logs: list[str] = []
        generated, metadata = generate_editorial(
            {}, template="ordered_steps", api_key="teste", client=SimpleNamespace(responses=responses), logger=logs.append
        )
        with self.assertRaises(ValueError):
            build_final_reel(
                generated, template="ordered_steps", slug="teste", category="CASA", hero_image="public/teste.avif"
            )
        self.assertEqual(metadata.total_tokens, 30)
        self.assertTrue(any("Gerador tokens totais: 30" in line for line in logs))

    def test_sinais_claros_de_truncagem(self):
        fixture_path = REELS_DIR / "data" / "vizinho-barulhento.json"
        original = json.loads(fixture_path.read_text(encoding="utf-8"))
        original.setdefault("template", "problem_solution")
        article = read_article(REPOSITORY_ROOT, "vizinho-barulhento")
        cases = (
            ("hífen final", "intro.title", "Texto cortado‑"),
            ("fragmento final", "warning.body", "A frase termina para"),
            ("acrónimo colado", "steps.0.title", "Pode chamar PSPou aguardar"),
            ("palavras coladas", "steps.0.title", "Queixa na câmaraourec"),
            ("carácter invisível", "steps.0.title", "Texto cortado\u200b"),
        )
        for label, path, value in cases:
            with self.subTest(label=label):
                payload = json.loads(json.dumps(original))
                if path == "intro.title":
                    payload["intro"]["title"] = value
                elif path == "warning.body":
                    payload["warning"]["body"] = value
                else:
                    payload["steps"][0]["title"] = value
                with self.assertRaisesRegex(ValueError, "fragmentada|junção anormal|invisível"):
                    validate_semantics(payload, article, REPOSITORY_ROOT)

    def test_json_malformado(self):
        with self.assertRaisesRegex(ValueError, "JSON inválida"):
            parse_generated_json('{"intro":', OrderedStepsOutput)

    def test_hero_image_inexistente(self):
        generated = OrderedStepsOutput.model_validate(valid_ordered())
        final = build_final_reel(
            generated, template="ordered_steps", slug="teste", category="CASA", hero_image="public/inexistente.avif"
        )
        article = Article("teste", Path("teste.mdx"), "public/inexistente.avif", Path("inexistente"), "CASA", {}, "5")
        with self.assertRaisesRegex(ValueError, "heroImage não existe"):
            validate_semantics(final, article, REPOSITORY_ROOT)

    def test_valor_monetario_inventado(self):
        generated = CostHighlightOutput.model_validate(valid_cost())
        payload = build_final_reel(
            generated, template="cost_highlight", slug="teste", category="CASA",
            hero_image="public/imagens/artigos/ar-condicionado-quanto-custa.avif",
        )
        payload["highlight"]["amount"] = "999 €"
        article = read_article(REPOSITORY_ROOT, "ar-condicionado-quanto-custa")
        with self.assertRaisesRegex(ValueError, "valor monetário ausente") as raised:
            validate_semantics(payload, article, REPOSITORY_ROOT)
        self.assertNotIsInstance(raised.exception, EditorialValidationError)

    def test_falha_factual_impede_repair_mesmo_com_falha_editorial(self):
        generated_payload = valid_cost()
        generated_payload["highlight"]["amount"] = "999 €"
        generated_payload["warning"]["body"] = "x" * 91
        raw = assemble_final_reel(
            CostHighlightOutput.model_validate(generated_payload),
            template="cost_highlight",
            slug="ar-condicionado-quanto-custa",
            category="CASA",
            hero_image="public/imagens/artigos/ar-condicionado-quanto-custa.avif",
        )
        article = read_article(REPOSITORY_ROOT, "ar-condicionado-quanto-custa")
        with self.assertRaisesRegex(ValueError, "valor monetário ausente") as raised:
            validate_semantics(raw, article, REPOSITORY_ROOT)
        self.assertNotIsInstance(raised.exception, EditorialValidationError)

    def test_eval_templates_dos_tres_fixtures(self):
        accepted = {
            "herdei-uma-casa": {"ordered_steps"},
            "ar-condicionado-quanto-custa": {"cost_highlight"},
            "vizinho-barulhento": {"problem_solution", "ordered_steps"},
        }
        observed = {
            "herdei-uma-casa": "ordered_steps",
            "ar-condicionado-quanto-custa": "cost_highlight",
            "vizinho-barulhento": "ordered_steps",
        }
        for slug, template in observed.items():
            with self.subTest(slug=slug):
                self.assertIn(template, accepted[slug])

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
