from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .article import Article


NUMBER_PATTERN = re.compile(r"(?<![\w])\d+(?:[ .\u00a0]\d{3})*(?:[,.]\d+)?")
MONEY_PATTERN = re.compile(r"(\d+(?:[ .\u00a0]\d{3})*(?:[,.]\d+)?)\s*€")


def _normalise_number(value: str) -> str:
    return value.replace(" ", "").replace("\u00a0", "").replace(".", "").replace(",", ".")


def _strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def validate_semantics(payload: dict, article: Article, repository_root: Path) -> None:
    errors: list[str] = []
    if payload.get("slug") != article.slug:
        errors.append("o slug final não corresponde ao artigo solicitado")
    if payload.get("heroImage") != article.hero_image:
        errors.append("heroImage não corresponde a imagem_capa")
    hero_path = repository_root / str(payload.get("heroImage", ""))
    if not hero_path.is_file():
        errors.append(f"heroImage não existe: {hero_path}")

    generated_text = "\n".join(_strings(payload))
    article_numbers = {_normalise_number(item) for item in NUMBER_PATTERN.findall(article.factual_text)}
    generated_numbers = {_normalise_number(item) for item in NUMBER_PATTERN.findall(generated_text)}
    new_numbers = generated_numbers - article_numbers - {str(step["number"]) for step in payload.get("steps", [])}
    if new_numbers:
        errors.append("foram introduzidos números ausentes do artigo: " + ", ".join(sorted(new_numbers)))

    if payload.get("template") == "cost_highlight":
        amount = payload.get("highlight", {}).get("amount", "")
        amount_values = {_normalise_number(item) for item in MONEY_PATTERN.findall(amount)}
        article_money = {_normalise_number(item) for item in MONEY_PATTERN.findall(article.factual_text)}
        if not amount_values:
            errors.append("highlight.amount não contém um valor monetário")
        elif not amount_values.issubset(article_money):
            errors.append("highlight.amount contém um valor monetário ausente do artigo")

    if errors:
        raise ValueError("Validação semântica falhou: " + "; ".join(errors))


def write_validated_json(payload: dict, output: Path, article: Article, repository_root: Path) -> None:
    validate_semantics(payload, article, repository_root)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        from content import load_content

        load_content(temporary, repository_root)
        temporary.replace(output)
    finally:
        if temporary.exists():
            temporary.unlink()
