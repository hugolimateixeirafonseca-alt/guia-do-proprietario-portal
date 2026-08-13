from __future__ import annotations

import os
import secrets
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping


REQUIRED_R2_ENV = (
    "CLOUDFLARE_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
)


@dataclass(frozen=True)
class R2Config:
    account_id: str
    access_key_id: str
    secret_access_key: str
    bucket_name: str
    endpoint: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "R2Config":
        values = os.environ if env is None else env
        missing = [name for name in REQUIRED_R2_ENV if not values.get(name, "").strip()]
        if missing:
            raise ValueError("Configuração R2 em falta: " + ", ".join(missing))
        account_id = values["CLOUDFLARE_ACCOUNT_ID"].strip()
        endpoint = values.get("R2_ENDPOINT", "").strip() or f"https://{account_id}.r2.cloudflarestorage.com"
        return cls(
            account_id=account_id,
            access_key_id=values["R2_ACCESS_KEY_ID"].strip(),
            secret_access_key=values["R2_SECRET_ACCESS_KEY"].strip(),
            bucket_name=values["R2_BUCKET_NAME"].strip(),
            endpoint=endpoint.rstrip("/"),
        )


@dataclass(frozen=True)
class ReelObjectKeys:
    video_key: str
    contact_key: str
    json_key: str


@dataclass(frozen=True)
class UploadedGeneration:
    generation_id: str
    video_key: str
    contact_key: str
    json_key: str

    def as_dict(self) -> dict[str, str]:
        return asdict(self)


def generate_generation_id(now: datetime | None = None, short_id: str | None = None) -> str:
    current = (now or datetime.now(UTC)).astimezone(UTC)
    suffix = short_id or secrets.token_hex(4)
    if not suffix or any(character not in "0123456789abcdef" for character in suffix.lower()):
        raise ValueError("O identificador curto da geração tem de ser hexadecimal.")
    return f"{current.strftime('%Y%m%dT%H%M%SZ')}-{suffix.lower()}"


def build_object_keys(slug: str, generation_id: str) -> ReelObjectKeys:
    if not slug or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in slug):
        raise ValueError("Slug inválido para keys R2.")
    if not generation_id or "/" in generation_id or "\\" in generation_id or ".." in generation_id:
        raise ValueError("generation_id inválido para keys R2.")
    prefix = f"reels/{slug}/{generation_id}"
    return ReelObjectKeys(
        video_key=f"{prefix}/video.mp4",
        contact_key=f"{prefix}/contact.jpg",
        json_key=f"{prefix}/reel.json",
    )


def create_r2_client(config: R2Config) -> Any:
    import boto3

    return boto3.client(
        service_name="s3",
        endpoint_url=config.endpoint,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        region_name="auto",
    )


def upload_generation(
    *,
    slug: str,
    generation_id: str,
    video: Path,
    contact: Path,
    reel_json: Path,
    config: R2Config | None = None,
    client: Any | None = None,
) -> UploadedGeneration:
    paths = ((video, "video/mp4"), (contact, "image/jpeg"), (reel_json, "application/json"))
    missing = [str(path) for path, _ in paths if not path.is_file() or path.stat().st_size == 0]
    if missing:
        raise FileNotFoundError("Ficheiros obrigatórios para upload em falta: " + ", ".join(missing))
    active_config = config or R2Config.from_env()
    active_client = client or create_r2_client(active_config)
    keys = build_object_keys(slug, generation_id)
    for (path, content_type), key in zip(paths, (keys.video_key, keys.contact_key, keys.json_key), strict=True):
        active_client.upload_file(
            str(path),
            active_config.bucket_name,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    return UploadedGeneration(generation_id, keys.video_key, keys.contact_key, keys.json_key)
