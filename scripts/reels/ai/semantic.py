from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .article import Article
from .schema import (
    EDITORIAL_LIMITS,
    STEP_TITLE_LIMIT,
    EditorialFieldIssue,
    EditorialValidationError,
    editorial_target,
)


NUMBER_PATTERN = re.compile(r"(?<![\w])\d+(?:[ .\u00a0]\d{3})*(?:[,.]\d+)?")
MONEY_PATTERN = re.compile(r"(\d+(?:[ .\u00a0]\d{3})*(?:[,.]\d+)?)\s*€")
ZERO_WIDTH_PATTERN = re.compile(r"[\u200b\u200c\u200d\ufeff]")
ACRONYM_JOIN_PATTERN = re.compile(r"\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}[a-záéíóúâêôãõç]{2,}\b")
KNOWN_JOIN_PATTERN = re.compile(r"\b(?:câmaraourec)\b", re.IGNORECASE)
TRAILING_FRAGMENT_PATTERN = re.compile(r"(?:[-‐‑‒–—,;:]|\b(?:a|à|ao|aos|as|às|com|como|da|das|de|do|dos|e|em|entre|mas|na|nas|no|nos|o|ou|para|pela|pelas|pelo|pelos|por|porque|que|se|sem|só|um|uma))\s*$", re.IGNORECASE)
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


def _nested_string(payload: dict, path: str) -> str:
    value: Any = payload
    for part in path.split("."):
        value = value.get(part) if isinstance(value, dict) else None
    return value if isinstance(value, str) else ""


def _truncation_reason(value: str, limit: int) -> str | None:
    if ZERO_WIDTH_PATTERN.search(value):
        return "contém um carácter invisível associado a corte"
    if ACRONYM_JOIN_PATTERN.search(value) or KNOWN_JOIN_PATTERN.search(value):
        return "contém uma junção anormal de palavras"
    if TRAILING_FRAGMENT_PATTERN.search(value):
        return "termina de forma fragmentada"
    if len(value) == limit and value[-1:].isalnum():
        return "atinge exatamente o limite e termina sem fecho natural"
    return None


def _validate_no_truncation(payload: dict) -> list[EditorialFieldIssue]:
    issues: list[EditorialFieldIssue] = []
    for path, limit in EDITORIAL_LIMITS.items():
        value = _nested_string(payload, path)
        if value:
            reason = _truncation_reason(value, limit)
            if reason:
                issues.append(EditorialFieldIssue(path, value, limit, editorial_target(path) or limit, reason))
    for index, step in enumerate(payload.get("steps", []), start=1):
        value = step.get("title", "") if isinstance(step, dict) else ""
        if isinstance(value, str) and value:
            reason = _truncation_reason(value, STEP_TITLE_LIMIT)
            if reason:
                path = f"steps[{index - 1}].title"
                issues.append(EditorialFieldIssue(path, value, STEP_TITLE_LIMIT, editorial_target(path) or STEP_TITLE_LIMIT, reason))
    return issues


def validate_facts(payload: dict, article: Article, repository_root: Path) -> None:
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


def validate_semantics(payload: dict, article: Article, repository_root: Path) -> None:
    validate_facts(payload, article, repository_root)
    editorial_issues = _validate_no_truncation(payload)
    if editorial_issues:
        raise EditorialValidationError(editorial_issues)


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
