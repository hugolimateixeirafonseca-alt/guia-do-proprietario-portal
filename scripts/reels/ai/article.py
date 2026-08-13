from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path, PurePosixPath
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


def _repository_path(repository_root: Path, relative: PurePosixPath) -> Path:
    root = repository_root.resolve()
    candidate = (root / Path(*relative.parts)).resolve()
    if not candidate.is_relative_to(root):
        raise ValueError("imagem_capa tem de permanecer dentro do repositório.")
    return candidate


def _resolve_hero_image(repository_root: Path, image_value: Any) -> tuple[str, Path]:
    if not isinstance(image_value, str) or not image_value.startswith("/imagens/"):
        raise ValueError("imagem_capa tem de apontar para /imagens/ dentro do portal.")
    if "\\" in image_value:
        raise ValueError("imagem_capa tem de usar um caminho seguro dentro de /imagens/.")

    image_path = PurePosixPath(image_value)
    if ".." in image_path.parts or image_path.parts[:2] != ("/", "imagens"):
        raise ValueError("imagem_capa tem de usar um caminho seguro dentro de /imagens/.")

    relative_image = PurePosixPath(*image_path.parts[1:])
    published_relative = PurePosixPath("public") / relative_image
    published_path = _repository_path(repository_root, published_relative)
    if published_path.is_file():
        return published_relative.as_posix(), published_path

    for suffix in (".png", ".jpg", ".jpeg"):
        source_relative = relative_image.with_suffix(suffix)
        source_path = _repository_path(repository_root, source_relative)
        if source_path.is_file():
            return source_relative.as_posix(), source_path

    raise FileNotFoundError(f"A imagem de capa não existe: {published_path}")


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

    hero_image, hero_path = _resolve_hero_image(repository_root, frontmatter.get("imagem_capa"))
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
