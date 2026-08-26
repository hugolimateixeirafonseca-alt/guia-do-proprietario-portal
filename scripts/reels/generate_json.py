from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from ai.article import read_article
from ai.openai_client import create_openai_client, generate_editorial, repair_editorial, route_template
from ai.prompt import PROMPT_VERSION
from ai.schema import EditorialValidationError, assemble_final_reel, build_final_reel
from ai.semantic import validate_facts, validate_semantics, write_validated_json


MAX_EDITORIAL_REPAIR_PASSES = 3


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera um JSON de Reel a partir de um artigo MDX usando a OpenAI.")
    parser.add_argument("--slug", required=True, help="Slug do artigo em src/content/artigos")
    parser.add_argument("--output", type=Path, help="Destino; por omissão out/reels-json/<slug>.json")
    parser.add_argument("--dry-run", action="store_true", help="Lê e normaliza o artigo sem chamar a OpenAI nem gravar JSON")
    return parser.parse_args()


def main() -> int:
    args = arguments()
    article = read_article(REPOSITORY_ROOT, args.slug)
    if args.dry_run:
        print(json.dumps({
            "slug": article.slug,
            "category": article.category,
            "heroImage": article.hero_image,
            "promptVersion": PROMPT_VERSION,
            "articlePayload": article.api_payload,
        }, ensure_ascii=False, indent=2))
        return 0

    client = create_openai_client()
    template, router_metadata = route_template(article.api_payload, client=client)
    print(f"Template selecionado: {template}")
    generated, generator_metadata = generate_editorial(article.api_payload, template=template, client=client)

    def validate_generated(editorial):
        candidate = build_final_reel(
            editorial,
            template=template,
            slug=article.slug,
            category=article.category,
            hero_image=article.hero_image,
        )
        validate_semantics(candidate, article, REPOSITORY_ROOT)
        return candidate

    repair_metadata_items = []
    repaired_paths: list[str] = []
    try:
        final = validate_generated(generated)
        print("Repair editorial: não")
    except EditorialValidationError as exc:
        # Antes de qualquer repair, garantir que a geração continua factualmente
        # suportada pelo artigo. Repairs editoriais nunca podem mascarar uma falha factual.
        raw_candidate = assemble_final_reel(
            generated,
            template=template,
            slug=article.slug,
            category=article.category,
            hero_image=article.hero_image,
        )
        validate_facts(raw_candidate, article, REPOSITORY_ROOT)

        issues = exc.issues
        final = None
        print("Repair editorial: sim")
        for attempt in range(1, MAX_EDITORIAL_REPAIR_PASSES + 1):
            print(
                f"Repair editorial tentativa {attempt}/{MAX_EDITORIAL_REPAIR_PASSES}: "
                + ", ".join(issue.path for issue in issues)
            )
            generated, repair_metadata, paths = repair_editorial(
                article.api_payload,
                template=template,
                editorial=generated,
                issues=issues,
                client=client,
            )
            repair_metadata_items.append(repair_metadata)
            repaired_paths.extend(paths)

            try:
                final = validate_generated(generated)
                print("Campos reparados: " + ", ".join(paths))
                break
            except EditorialValidationError as retry_exc:
                # Confirmar novamente factos antes de tentar encurtar/reformular
                # apenas os campos editoriais ainda inválidos.
                raw_candidate = assemble_final_reel(
                    generated,
                    template=template,
                    slug=article.slug,
                    category=article.category,
                    hero_image=article.hero_image,
                )
                validate_facts(raw_candidate, article, REPOSITORY_ROOT)
                issues = retry_exc.issues
                if attempt >= MAX_EDITORIAL_REPAIR_PASSES:
                    raise
                print(
                    "Repair ainda fora dos limites; nova tentativa apenas nos campos restantes: "
                    + ", ".join(issue.path for issue in issues)
                )

        if final is None:
            raise RuntimeError("O repair editorial terminou sem produzir um Reel validado.")

    output = args.output or REPOSITORY_ROOT / "out" / "reels-json" / f"{article.slug}.json"
    output = output.resolve() if output.is_absolute() else (Path.cwd() / output).resolve()
    write_validated_json(final, output, article, REPOSITORY_ROOT)

    metadata_items = [router_metadata, generator_metadata, *repair_metadata_items]
    for name in ("input_tokens", "output_tokens", "total_tokens"):
        values = [getattr(item, name) for item in metadata_items]
        total = sum(values) if all(isinstance(value, int) for value in values) else None
        label = {"input_tokens": "entrada", "output_tokens": "saída", "total_tokens": "totais"}[name]
        print(f"Reel tokens de {label}: {total}")
    print(f"Repair passes usados: {len(repair_metadata_items)}")
    if repaired_paths:
        print("Paths reparados no total: " + ", ".join(repaired_paths))
    print(f"Template: {final['template']}")
    print(f"JSON: {output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1)
