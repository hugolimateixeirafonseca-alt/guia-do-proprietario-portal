from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError, create_model


TemplateName = Literal["ordered_steps", "cost_highlight", "problem_solution"]

EDITORIAL_LIMITS = {
    "intro.title": 32, "intro.accent": 30, "intro.label": 40, "intro.subtitle": 80,
    "highlight.amount": 35, "highlight.caption": 80,
    "progress.eyebrow": 45, "progress.title": 60, "progress.itemLabel": 18,
    "warning.eyebrow": 35, "warning.title": 60, "warning.body": 90, "warning.secondary": 100,
    "outro.title": 75,
}
EDITORIAL_TARGETS = {
    "intro.title": 25, "intro.accent": 23, "intro.label": 30, "intro.subtitle": 60,
    "highlight.amount": 26, "highlight.caption": 60,
    "progress.eyebrow": 34, "progress.title": 45, "progress.itemLabel": 13,
    "warning.eyebrow": 26, "warning.title": 45, "warning.body": 65, "warning.secondary": 75,
    "outro.title": 55,
}
STEP_PATH_PATTERN = re.compile(r"^steps\[\d+]\.title$")
STEP_TITLE_LIMIT = 55
STEP_TITLE_TARGET = 42


@dataclass(frozen=True)
class EditorialFieldIssue:
    path: str
    value: str
    limit: int
    target: int
    reason: str


class EditorialValidationError(ValueError):
    def __init__(self, issues: list[EditorialFieldIssue]):
        self.issues = tuple(issues)
        details = [
            f"{issue.path}: {issue.reason}; comprimento={len(issue.value)}; limite={issue.limit}; objetivo={issue.target}"
            for issue in issues
        ]
        super().__init__("Validação editorial local falhou:\n- " + "\n- ".join(details))


def editorial_limit(path: str) -> int | None:
    return STEP_TITLE_LIMIT if STEP_PATH_PATTERN.fullmatch(path) else EDITORIAL_LIMITS.get(path)


def editorial_target(path: str) -> int | None:
    return STEP_TITLE_TARGET if STEP_PATH_PATTERN.fullmatch(path) else EDITORIAL_TARGETS.get(path)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Intro(StrictModel):
    title: str = Field(min_length=1, max_length=32)
    accent: str = Field(min_length=1, max_length=30)
    label: str = Field(min_length=1, max_length=40)
    subtitle: str = Field(min_length=1, max_length=80)


class EditorialStep(StrictModel):
    title: str = Field(min_length=1, max_length=55)


class Warning(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=35)
    title: str = Field(min_length=1, max_length=60)
    body: str = Field(min_length=1, max_length=90)
    secondary: str = Field(min_length=1, max_length=100)


class OutroEditorial(StrictModel):
    title: str = Field(min_length=1, max_length=75)


class Progress(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=45)
    title: str = Field(min_length=1, max_length=60)
    itemLabel: str = Field(min_length=1, max_length=18)


class Highlight(StrictModel):
    amount: str = Field(min_length=1, max_length=35)
    caption: str = Field(min_length=1, max_length=80)


class GeneratedIntro(StrictModel):
    title: str
    accent: str
    label: str
    subtitle: str


class GeneratedStep(StrictModel):
    title: str


class GeneratedWarning(StrictModel):
    eyebrow: str
    title: str
    body: str
    secondary: str


class GeneratedOutro(StrictModel):
    title: str


class GeneratedProgress(StrictModel):
    eyebrow: str
    title: str
    itemLabel: str


class GeneratedHighlight(StrictModel):
    amount: str
    caption: str


class TemplateRouterOutput(StrictModel):
    template: TemplateName


class OrderedStepsOutput(StrictModel):
    intro: GeneratedIntro
    steps: list[GeneratedStep] = Field(min_length=3, max_length=5)
    warning: GeneratedWarning
    outro: GeneratedOutro


class CostHighlightOutput(StrictModel):
    intro: GeneratedIntro
    highlight: GeneratedHighlight
    progress: GeneratedProgress
    steps: list[GeneratedStep] = Field(min_length=3, max_length=3)
    warning: GeneratedWarning
    outro: GeneratedOutro


class ProblemSolutionOutput(StrictModel):
    intro: GeneratedIntro
    progress: GeneratedProgress
    steps: list[GeneratedStep] = Field(min_length=3, max_length=3)
    warning: GeneratedWarning
    outro: GeneratedOutro


EDITORIAL_SCHEMAS = {
    "ordered_steps": OrderedStepsOutput,
    "cost_highlight": CostHighlightOutput,
    "problem_solution": ProblemSolutionOutput,
}


class NumberedStep(StrictModel):
    number: int = Field(ge=1, le=5)
    title: str = Field(min_length=1, max_length=55)


class OutroFinal(OutroEditorial):
    label: Literal["Artigo completo no"]
    brand: Literal["Guia do Proprietário"]
    domain: Literal["guiadoproprietario.pt"]


class FinalBase(StrictModel):
    version: Literal[1]
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    category: str = Field(min_length=1, max_length=30)
    heroImage: str = Field(min_length=1)
    intro: Intro
    steps: list[NumberedStep]
    warning: Warning
    outro: OutroFinal


class OrderedStepsFinal(FinalBase):
    template: Literal["ordered_steps"]
    steps: list[NumberedStep] = Field(min_length=3, max_length=5)


class CostHighlightFinal(FinalBase):
    template: Literal["cost_highlight"]
    highlight: Highlight
    progress: Progress
    steps: list[NumberedStep] = Field(min_length=3, max_length=3)


class ProblemSolutionFinal(FinalBase):
    template: Literal["problem_solution"]
    progress: Progress
    steps: list[NumberedStep] = Field(min_length=3, max_length=3)


FinalReel = Annotated[
    OrderedStepsFinal | CostHighlightFinal | ProblemSolutionFinal,
    Field(discriminator="template"),
]
FINAL_REEL_ADAPTER = TypeAdapter(FinalReel)


def editorial_schema(template: TemplateName) -> type[StrictModel]:
    try:
        return EDITORIAL_SCHEMAS[template]
    except KeyError as exc:
        raise ValueError(f"Template não suportado: {template}") from exc


def repair_output_schema(paths: list[str]) -> type[StrictModel]:
    if not paths or len(paths) != len(set(paths)):
        raise ValueError("Os paths de repair têm de ser únicos e não vazios.")
    path_literal = Literal.__getitem__(tuple(paths))
    item_model = create_model(
        "RepairItem",
        __base__=StrictModel,
        path=(path_literal, ...),
        value=(str, ...),
    )
    return create_model(
        "RepairOutput",
        __base__=StrictModel,
        repairs=(list[item_model], Field(min_length=len(paths), max_length=len(paths))),
    )


def apply_editorial_repairs(
    editorial: StrictModel,
    *,
    template: TemplateName,
    repairs: list[dict],
    allowed_paths: list[str],
) -> StrictModel:
    received_paths = [repair.get("path") for repair in repairs]
    if len(received_paths) != len(set(received_paths)) or set(received_paths) != set(allowed_paths):
        raise ValueError("O repair não devolveu exatamente uma substituição por campo permitido.")
    payload = editorial.model_dump()
    for repair in repairs:
        value = repair.get("value")
        if not isinstance(value, str):
            raise ValueError(f"O repair de {repair.get('path')} não devolveu texto.")
        current: object = payload
        clean_tokens: list[str | int] = []
        for match in re.finditer(r"([^.\[\]]+)|\[(\d+)\]", repair["path"]):
            clean_tokens.append(int(match.group(2)) if match.group(2) is not None else match.group(1))
        for token in clean_tokens[:-1]:
            current = current[token] if isinstance(token, int) else current[token]  # type: ignore[index]
        last = clean_tokens[-1]
        current[last] = value  # type: ignore[index]
    return editorial_schema(template).model_validate(payload)


def parse_generated_json(raw: str, schema: type[StrictModel]) -> StrictModel:
    try:
        return schema.model_validate_json(raw)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValueError(f"Resposta JSON inválida: {exc}") from exc


def assemble_final_reel(
    editorial: StrictModel,
    *,
    template: TemplateName,
    slug: str,
    category: str,
    hero_image: str,
) -> dict:
    payload = editorial.model_dump()
    payload.update({"version": 1, "template": template, "slug": slug, "category": category, "heroImage": hero_image})
    payload["steps"] = [
        {"number": index, "title": step["title"]}
        for index, step in enumerate(payload["steps"], start=1)
    ]
    payload["outro"].update(
        {
            "label": "Artigo completo no",
            "brand": "Guia do Proprietário",
            "domain": "guiadoproprietario.pt",
        }
    )
    return payload


def build_final_reel(
    editorial: StrictModel,
    *,
    template: TemplateName,
    slug: str,
    category: str,
    hero_image: str,
) -> dict:
    payload = assemble_final_reel(
        editorial,
        template=template,
        slug=slug,
        category=category,
        hero_image=hero_image,
    )
    try:
        return FINAL_REEL_ADAPTER.validate_python(payload).model_dump()
    except ValidationError as exc:
        issues: list[EditorialFieldIssue] = []
        other_errors: list[str] = []
        for error in exc.errors(include_url=False):
            parts = [part for part in error["loc"] if part != template]
            location = ""
            for part in parts:
                location += f"[{part}]" if isinstance(part, int) else (f".{part}" if location else str(part))
            value = error.get("input")
            limit = editorial_limit(location)
            target = editorial_target(location)
            if error["type"] in {"string_too_long", "string_too_short"} and isinstance(value, str) and limit and target:
                issues.append(EditorialFieldIssue(location, value, limit, target, error["msg"]))
            else:
                length = len(value) if isinstance(value, (str, list)) else None
                suffix = f"; comprimento={length}" if length is not None else ""
                other_errors.append(f"{location}: {error['msg']}{suffix}")
        if other_errors:
            raise ValueError("Validação estrutural local falhou:\n- " + "\n- ".join(other_errors)) from exc
        raise EditorialValidationError(issues) from exc
