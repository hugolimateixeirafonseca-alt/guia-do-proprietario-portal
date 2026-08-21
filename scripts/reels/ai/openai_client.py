from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

from .prompt import (
    REPAIR_SYSTEM_PROMPT,
    ROUTER_SYSTEM_PROMPT,
    editorial_system_prompt,
    editorial_user_prompt,
    repair_user_prompt,
    router_user_prompt,
)
from .schema import (
    EditorialFieldIssue,
    StrictModel,
    TemplateName,
    TemplateRouterOutput,
    apply_editorial_repairs,
    editorial_schema,
    repair_output_schema,
)


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


def _metadata(response: Any, selected_model: str) -> GenerationMetadata:
    usage = getattr(response, "usage", None)
    return GenerationMetadata(
        model=str(getattr(response, "model", selected_model)),
        response_id=str(getattr(response, "id", "indisponível")),
        input_tokens=_usage_value(usage, "input_tokens"),
        output_tokens=_usage_value(usage, "output_tokens"),
        total_tokens=_usage_value(usage, "total_tokens"),
    )


def log_usage(stage: str, metadata: GenerationMetadata, logger: Callable[[str], None] = print) -> None:
    logger(f"{stage} modelo: {metadata.model}")
    logger(f"{stage} response ID: {metadata.response_id}")
    logger(f"{stage} tokens de entrada: {metadata.input_tokens}")
    logger(f"{stage} tokens de saída: {metadata.output_tokens}")
    logger(f"{stage} tokens totais: {metadata.total_tokens}")


def create_openai_client(
    *,
    api_key: str | None = None,
    client_factory: Callable[..., Any] | None = None,
) -> Any:
    key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY não está definida.")
    if client_factory is None:
        from openai import OpenAI

        client_factory = OpenAI
    # Duas tentativas adicionais apenas para falhas transitórias tratadas pelo SDK
    # (timeouts, 408/409/429 e 5xx). Não repete validações editoriais nem uma
    # geração que já tenha devolvido resposta válida.
    return client_factory(api_key=key, max_retries=2)


def _parse_response(
    client: Any,
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: type[StrictModel],
    stage: str,
    logger: Callable[[str], None],
    reasoning_effort: str,
) -> tuple[StrictModel, GenerationMetadata]:
    request: dict[str, Any] = {
        "model": model,
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "text_format": schema,
        "store": False,
    }
    if model == "gpt-5-mini" or model.startswith("gpt-5-mini-"):
        request["reasoning"] = {"effort": reasoning_effort}
        request["text"] = {"verbosity": "low"}
    try:
        response = client.responses.parse(**request)
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        if status == 401:
            raise RuntimeError("A OpenAI recusou OPENAI_API_KEY. Confirme se a chave está ativa e pertence ao projeto correto.") from None
        if isinstance(status, int):
            raise RuntimeError(f"A chamada {stage} à OpenAI falhou com HTTP {status} ({type(exc).__name__}).") from None
        raise RuntimeError(f"A chamada {stage} à OpenAI falhou ({type(exc).__name__}).") from None

    metadata = _metadata(response, model)
    log_usage(stage, metadata, logger)
    parsed = getattr(response, "output_parsed", None)
    if parsed is None:
        raise ValueError(f"A chamada {stage} não devolveu um Structured Output utilizável; a resposta pode ter sido recusada.")
    return schema.model_validate(parsed), metadata


def route_template(
    article_payload: dict,
    *,
    api_key: str | None = None,
    model: str | None = None,
    client: Any | None = None,
    client_factory: Callable[..., Any] | None = None,
    logger: Callable[[str], None] = print,
) -> tuple[TemplateName, GenerationMetadata]:
    selected_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    active_client = client or create_openai_client(api_key=api_key, client_factory=client_factory)
    parsed, metadata = _parse_response(
        active_client,
        model=selected_model,
        system_prompt=ROUTER_SYSTEM_PROMPT,
        user_prompt=router_user_prompt(article_payload),
        schema=TemplateRouterOutput,
        stage="Router",
        logger=logger,
        reasoning_effort="minimal",
    )
    return parsed.template, metadata


def generate_editorial(
    article_payload: dict,
    *,
    template: TemplateName,
    api_key: str | None = None,
    model: str | None = None,
    client: Any | None = None,
    client_factory: Callable[..., Any] | None = None,
    logger: Callable[[str], None] = print,
) -> tuple[StrictModel, GenerationMetadata]:
    selected_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    active_client = client or create_openai_client(api_key=api_key, client_factory=client_factory)
    schema = editorial_schema(template)
    return _parse_response(
        active_client,
        model=selected_model,
        system_prompt=editorial_system_prompt(template),
        user_prompt=editorial_user_prompt(article_payload, template),
        schema=schema,
        stage="Gerador",
        logger=logger,
        reasoning_effort="low",
    )


def repair_editorial(
    article_payload: dict,
    *,
    template: TemplateName,
    editorial: StrictModel,
    issues: tuple[EditorialFieldIssue, ...],
    api_key: str | None = None,
    model: str | None = None,
    client: Any | None = None,
    client_factory: Callable[..., Any] | None = None,
    logger: Callable[[str], None] = print,
) -> tuple[StrictModel, GenerationMetadata, list[str]]:
    if not issues:
        raise ValueError("O repair editorial exige pelo menos um campo com falha.")
    selected_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    active_client = client or create_openai_client(api_key=api_key, client_factory=client_factory)
    allowed_paths = [issue.path for issue in issues]
    schema = repair_output_schema(allowed_paths)
    parsed, metadata = _parse_response(
        active_client,
        model=selected_model,
        system_prompt=REPAIR_SYSTEM_PROMPT,
        user_prompt=repair_user_prompt(article_payload, template, issues),
        schema=schema,
        stage="Repair",
        logger=logger,
        reasoning_effort="minimal",
    )
    repairs = [item.model_dump() for item in parsed.repairs]
    repaired = apply_editorial_repairs(
        editorial,
        template=template,
        repairs=repairs,
        allowed_paths=allowed_paths,
    )
    return repaired, metadata, allowed_paths
