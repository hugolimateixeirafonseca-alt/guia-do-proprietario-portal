from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _object(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{path} tem de ser um objeto.")
    return value


def _text(container: dict[str, Any], key: str, path: str) -> str:
    value = container.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Falta texto obrigatório em {path}.{key}.")
    return value.strip()


def load_content(input_path: Path, repository_root: Path) -> dict[str, Any]:
    if not input_path.is_file():
        raise FileNotFoundError(f"O JSON do Reel não existe: {input_path}")
    try:
        data = json.loads(input_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON inválido em {input_path}: {exc}") from exc

    data = _object(data, "raiz")
    if data.get("version") != 1:
        raise ValueError("version tem de ser 1.")
    slug = _text(data, "slug", "raiz")
    if not SLUG_PATTERN.fullmatch(slug):
        raise ValueError("slug só pode conter minúsculas, números e hífenes.")
    _text(data, "category", "raiz")
    template = data.get("template", "ordered_steps")
    if template not in {"ordered_steps", "cost_highlight", "problem_solution"}:
        raise ValueError("template tem de ser ordered_steps, cost_highlight ou problem_solution.")
    data["template"] = template
    hero_relative = Path(_text(data, "heroImage", "raiz"))
    if hero_relative.is_absolute() or ".." in hero_relative.parts:
        raise ValueError("heroImage tem de ser um caminho relativo dentro do repositório.")
    hero_path = (repository_root / hero_relative).resolve()
    if not hero_path.is_file():
        raise FileNotFoundError(f"A imagem do artigo não existe: {hero_path}")
    data["_hero_path"] = hero_path

    fields = {
        "intro": ("title", "accent", "label", "subtitle"),
        "warning": ("eyebrow", "title", "body", "secondary"),
        "outro": ("title", "label", "brand", "domain"),
    }
    for section_name, required in fields.items():
        section = _object(data.get(section_name), section_name)
        for key in required:
            _text(section, key, section_name)

    if template != "ordered_steps":
        progress = _object(data.get("progress"), "progress")
        for key in ("eyebrow", "title", "itemLabel"):
            _text(progress, key, "progress")
    if template == "cost_highlight":
        highlight = _object(data.get("highlight"), "highlight")
        for key in ("amount", "caption"):
            _text(highlight, key, "highlight")

    steps = data.get("steps")
    if not isinstance(steps, list) or not steps:
        raise ValueError("steps tem de ser uma lista não vazia.")
    expected = 1
    for index, raw_step in enumerate(steps):
        step = _object(raw_step, f"steps[{index}]")
        if step.get("number") != expected:
            raise ValueError(f"steps[{index}].number tem de ser {expected}.")
        _text(step, "title", f"steps[{index}]")
        expected += 1
    return data
