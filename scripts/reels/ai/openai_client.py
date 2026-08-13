from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

from .prompt import SYSTEM_PROMPT, user_prompt
from .schema import GeneratedResponse


DEFAULT_MODEL = "gpt-5-mini"


@dataclass(frozen=True)
class GenerationMetadata:
    model: str
    response_id: str
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


def _usage_value(usage: Any, name: str) -> int | None:
    value = getattr(usage, name, None) if usage is not None else None
    return value if isinstance(value, int) else None


def generate_editorial(
    article_payload: dict,
    *,
    api_key: str | None = None,
    model: str | None = None,
    client: Any | None = None,
    client_factory: Callable[..., Any] | None = None,
) -> tuple[GeneratedResponse, GenerationMetadata]:
    key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY não está definida.")
    selected_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    if client is None:
        if client_factory is None:
            from openai import OpenAI

            client_factory = OpenAI
        client = client_factory(api_key=key, max_retries=1)

    try:
        response = client.responses.parse(
            model=selected_model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt(article_payload)},
            ],
            text_format=GeneratedResponse,
            store=False,
        )
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        if status == 401:
            raise RuntimeError("A OpenAI recusou OPENAI_API_KEY. Confirme se a chave está ativa e pertence ao projeto correto.") from None
        if isinstance(status, int):
            raise RuntimeError(f"A chamada à OpenAI falhou com HTTP {status} ({type(exc).__name__}).") from None
        raise RuntimeError(f"A chamada à OpenAI falhou ({type(exc).__name__}).") from None
    parsed = getattr(response, "output_parsed", None)
    if parsed is None:
        raise ValueError("A OpenAI não devolveu um Structured Output utilizável; a resposta pode ter sido recusada.")
    usage = getattr(response, "usage", None)
    metadata = GenerationMetadata(
        model=str(getattr(response, "model", selected_model)),
        response_id=str(getattr(response, "id", "indisponível")),
        input_tokens=_usage_value(usage, "input_tokens"),
        output_tokens=_usage_value(usage, "output_tokens"),
        total_tokens=_usage_value(usage, "total_tokens"),
    )
    return parsed, metadata
