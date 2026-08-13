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


class OrderedStepsEditorial(StrictModel):
    template: Literal["ordered_steps"]
    intro: Intro
    steps: list[EditorialStep] = Field(min_length=3, max_length=5)
    warning: Warning
    outro: OutroEditorial


class CostHighlightEditorial(StrictModel):
    template: Literal["cost_highlight"]
    intro: Intro
    highlight: Highlight
    progress: Progress
    steps: list[EditorialStep] = Field(min_length=3, max_length=3)
    warning: Warning
    outro: OutroEditorial


class ProblemSolutionEditorial(StrictModel):
    template: Literal["problem_solution"]
    intro: Intro
    progress: Progress
    steps: list[EditorialStep] = Field(min_length=3, max_length=3)
    warning: Warning
    outro: OutroEditorial


EditorialReel = Annotated[
    OrderedStepsEditorial | CostHighlightEditorial | ProblemSolutionEditorial,
    Field(discriminator="template"),
]


class GeneratedResponse(StrictModel):
    reel: EditorialReel


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


def parse_generated_json(raw: str) -> GeneratedResponse:
    try:
        return GeneratedResponse.model_validate_json(raw)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValueError(f"Resposta JSON inválida: {exc}") from exc


def build_final_reel(editorial: EditorialReel, *, slug: str, category: str, hero_image: str) -> dict:
    payload = editorial.model_dump()
    payload.update({"version": 1, "slug": slug, "category": category, "heroImage": hero_image})
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
    return FINAL_REEL_ADAPTER.validate_python(payload).model_dump()
