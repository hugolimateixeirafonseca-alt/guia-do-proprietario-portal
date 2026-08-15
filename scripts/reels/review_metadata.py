from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Mapping

from storage import UploadedGeneration


ALLOWED_STATUSES = {"pending_review", "approved", "rejected", "generation_failed"}
REQUIRED_D1_ENV = ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_API_TOKEN")


@dataclass(frozen=True)
class D1Config:
    account_id: str
    database_id: str
    api_token: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "D1Config":
        values = os.environ if env is None else env
        missing = [name for name in REQUIRED_D1_ENV if not values.get(name, "").strip()]
        if missing:
            raise ValueError("Configuração D1 em falta: " + ", ".join(missing))
        return cls(*(values[name].strip() for name in REQUIRED_D1_ENV))


@dataclass(frozen=True)
class ReelGenerationMetadata:
    id: str
    slug: str
    template: str | None
    generation_id: str
    status: str
    video_key: str | None
    contact_key: str | None
    json_key: str | None
    article_title: str | None
    article_url: str | None
    publication_sha: str | None
    created_at: str
    approved_at: str | None = None
    rejected_at: str | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, str | None]:
        return asdict(self)


def pending_review_metadata(
    slug: str,
    template: str,
    uploaded: UploadedGeneration,
    *,
    article_title: str,
    article_url: str,
    publication_sha: str | None,
) -> ReelGenerationMetadata:
    return ReelGenerationMetadata(
        id=str(uuid.uuid4()),
        slug=slug,
        template=template,
        generation_id=uploaded.generation_id,
        status="pending_review",
        video_key=uploaded.video_key,
        contact_key=uploaded.contact_key,
        json_key=uploaded.json_key,
        article_title=article_title,
        article_url=article_url,
        publication_sha=publication_sha,
        created_at=datetime.now(UTC).isoformat(),
    )


def failed_generation_metadata(slug: str, generation_id: str, error: str) -> ReelGenerationMetadata:
    return ReelGenerationMetadata(
        id=str(uuid.uuid4()),
        slug=slug,
        template=None,
        generation_id=generation_id,
        status="generation_failed",
        video_key=None,
        contact_key=None,
        json_key=None,
        article_title=None,
        article_url=None,
        publication_sha=None,
        created_at=datetime.now(UTC).isoformat(),
        error=error[:500],
    )


def register_metadata(metadata: ReelGenerationMetadata, config: D1Config | None = None) -> None:
    if metadata.status not in ALLOWED_STATUSES:
        raise ValueError(f"Status de Reel inválido: {metadata.status}")
    active = config or D1Config.from_env()
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{active.account_id}"
        f"/d1/database/{active.database_id}/query"
    )
    fields = metadata.as_dict()
    payload = json.dumps({
        "sql": """INSERT INTO reel_generations
        (id, slug, template, generation_id, status, video_key, contact_key, json_key,
         article_title, article_url, publication_sha, created_at, approved_at, rejected_at, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        "params": list(fields.values()),
    }).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={"Authorization": f"Bearer {active.api_token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"O registo D1 falhou com HTTP {exc.code}.") from None
    if not result.get("success"):
        raise RuntimeError("O registo D1 da geração falhou.")
