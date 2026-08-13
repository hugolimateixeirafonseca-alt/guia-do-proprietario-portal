from __future__ import annotations

import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError


TemplateName = Literal["ordered_steps", "cost_highlight", "problem_solution"]


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


def parse_generated_json(raw: str, schema: type[StrictModel]) -> StrictModel:
    try:
        return schema.model_validate_json(raw)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValueError(f"Resposta JSON inválida: {exc}") from exc


def build_final_reel(
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
    try:
        return FINAL_REEL_ADAPTER.validate_python(payload).model_dump()
    except ValidationError as exc:
        details: list[str] = []
        for error in exc.errors(include_url=False):
            location = ".".join(str(part) for part in error["loc"] if part != template)
            value = error.get("input")
            length = len(value) if isinstance(value, (str, list)) else None
            suffix = f"; comprimento={length}" if length is not None else ""
            details.append(f"{location}: {error['msg']}{suffix}")
        raise ValueError("Validação editorial local falhou:\n- " + "\n- ".join(details)) from exc
