from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from ai.article import read_article
from ai.openai_client import generate_editorial
from ai.prompt import PROMPT_VERSION
from ai.schema import build_final_reel
from ai.semantic import write_validated_json


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

    generated, metadata = generate_editorial(article.api_payload)
    final = build_final_reel(
        generated.reel,
        slug=article.slug,
        category=article.category,
        hero_image=article.hero_image,
    )
    output = args.output or REPOSITORY_ROOT / "out" / "reels-json" / f"{article.slug}.json"
    output = output.resolve() if output.is_absolute() else (Path.cwd() / output).resolve()
    write_validated_json(final, output, article, REPOSITORY_ROOT)

    print(f"Modelo: {metadata.model}")
    print(f"Response ID: {metadata.response_id}")
    print(f"Tokens de entrada: {metadata.input_tokens}")
    print(f"Tokens de saída: {metadata.output_tokens}")
    print(f"Tokens totais: {metadata.total_tokens}")
    print(f"Template: {final['template']}")
    print(f"JSON: {output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1)
