from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONTMATTER_PATTERN = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@dataclass(frozen=True)
class Article:
    slug: str
    path: Path
    hero_image: str
    hero_path: Path
    category: str
    api_payload: dict[str, Any]
    factual_text: str


def _json_safe(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _normalise_body(body: str) -> str:
    body = re.sub(r"^import\s+.*$", "", body, flags=re.MULTILINE)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"\[([^]]+)]\([^)]+\)", r"\1", body)
    body = re.sub(r"[*_`]+", "", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def _category(pillar: str) -> str:
    return {"vender": "VENDER CASA"}.get(pillar.casefold(), pillar.upper())


def read_article(repository_root: Path, slug: str) -> Article:
    if not SLUG_PATTERN.fullmatch(slug):
        raise ValueError("Slug inválido. Use apenas minúsculas, números e hífenes.")
    path = repository_root / "src" / "content" / "artigos" / f"{slug}.mdx"
    if not path.is_file():
        raise FileNotFoundError(f"Artigo não encontrado para o slug: {slug}")
    raw = path.read_text(encoding="utf-8")
    match = FRONTMATTER_PATTERN.match(raw)
    if not match:
        raise ValueError(f"Frontmatter inválido ou ausente em {path}")
    frontmatter = yaml.safe_load(match.group(1))
    if not isinstance(frontmatter, dict):
        raise ValueError(f"Frontmatter inválido em {path}")

    image_value = frontmatter.get("imagem_capa")
    if not isinstance(image_value, str) or not image_value.startswith("/imagens/"):
        raise ValueError("imagem_capa tem de apontar para /imagens/ dentro do portal.")
    hero_image = f"public{image_value}"
    hero_path = repository_root / hero_image
    if not hero_path.is_file():
        raise FileNotFoundError(f"A imagem de capa não existe: {hero_path}")
    pillar = frontmatter.get("pilar")
    if not isinstance(pillar, str) or not pillar.strip():
        raise ValueError("O artigo não tem pilar/categoria válido.")

    relevant_keys = (
        "titulo",
        "descricao",
        "resposta_rapida",
        "custos",
        "perguntas_rapidas",
        "exemplo",
        "aviso",
        "pilar",
    )
    relevant = {key: _json_safe(frontmatter[key]) for key in relevant_keys if frontmatter.get(key) not in (None, "", [])}
    body = _normalise_body(raw[match.end() :])
    api_payload = {"frontmatter": relevant, "texto_editorial": body}
    factual_text = "\n".join([str(relevant), body])
    return Article(
        slug=slug,
        path=path,
        hero_image=hero_image,
        hero_path=hero_path,
        category=_category(pillar.strip()),
        api_payload=api_payload,
        factual_text=factual_text,
    )
