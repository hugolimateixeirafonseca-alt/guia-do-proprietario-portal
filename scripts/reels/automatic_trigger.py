from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Callable, Mapping


Query = Callable[[str, list[str | None]], int]
VALID_REVIEW_STATUSES = ("pending_review", "approved", "rejected", "superseded")


@dataclass(frozen=True)
class D1Config:
    account_id: str
    database_id: str
    api_token: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "D1Config":
        values = os.environ if env is None else env
        names = ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_API_TOKEN")
        missing = [name for name in names if not values.get(name, "").strip()]
        if missing:
            raise ValueError("Configuração D1 em falta: " + ", ".join(missing))
        return cls(*(values[name].strip() for name in names))


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _validate_identity(slug: str, publication_sha: str) -> None:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError("Slug inválido para o trigger automático.")
    if not re.fullmatch(r"[0-9a-f]{40}", publication_sha):
        raise ValueError("SHA de publicação inválido para o trigger automático.")


def d1_query(sql: str, params: list[str | None], config: D1Config | None = None) -> int:
    active = config or D1Config.from_env()
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{active.account_id}"
        f"/d1/database/{active.database_id}/query"
    )
    request = urllib.request.Request(
        url,
        data=json.dumps({"sql": sql, "params": params}).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {active.api_token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"A operação D1 do trigger automático falhou com HTTP {exc.code}.") from None
    if not payload.get("success") or not payload.get("result"):
        raise RuntimeError("A operação D1 do trigger automático falhou.")
    return int(payload["result"][0].get("meta", {}).get("changes", 0))


def claim_initial_trigger(
    slug: str,
    publication_sha: str,
    *,
    query: Query = d1_query,
    claimed_at: str | None = None,
) -> bool:
    """Reserva a geração inicial, usando D1 como lock autoritativo.

    Uma geração que já chegou a um estado de revisão válido bloqueia novos claims,
    mesmo que o passo final que marcava o trigger como completed tenha falhado.
    Estados failed, claims abandonados há mais de 30 minutos e completed órfãos
    podem ser recuperados automaticamente para o mesmo SHA de publicação.
    """
    _validate_identity(slug, publication_sha)
    now = claimed_at or _timestamp()
    status_placeholders = ", ".join("?" for _ in VALID_REVIEW_STATUSES)
    sql = f"""INSERT INTO reel_initial_triggers
        (slug, publication_sha, state, claimed_at)
        SELECT ?, ?, 'claimed', ?
        WHERE NOT EXISTS (
            SELECT 1 FROM reel_generations
            WHERE slug = ? AND status IN ({status_placeholders})
        )
        ON CONFLICT(slug) DO UPDATE SET
            state = 'claimed',
            claimed_at = excluded.claimed_at,
            completed_at = NULL,
            failed_at = NULL,
            generation_id = NULL,
            error = NULL
        WHERE reel_initial_triggers.publication_sha = excluded.publication_sha
          AND NOT EXISTS (
              SELECT 1 FROM reel_generations
              WHERE slug = excluded.slug AND status IN ({status_placeholders})
          )
          AND (
              reel_initial_triggers.state = 'failed'
              OR (
                  reel_initial_triggers.state = 'claimed'
                  AND datetime(reel_initial_triggers.claimed_at) <= datetime(?, '-30 minutes')
              )
              OR reel_initial_triggers.state = 'completed'
          )"""
    params: list[str | None] = [
        slug,
        publication_sha,
        now,
        slug,
        *VALID_REVIEW_STATUSES,
        *VALID_REVIEW_STATUSES,
        now,
    ]
    changes = query(sql, params)
    return changes == 1


def complete_initial_trigger(
    slug: str,
    publication_sha: str,
    generation_id: str,
    *,
    query: Query = d1_query,
    completed_at: str | None = None,
) -> bool:
    _validate_identity(slug, publication_sha)
    changes = query(
        """UPDATE reel_initial_triggers
        SET state = 'completed', completed_at = ?, failed_at = NULL,
            generation_id = ?, error = NULL
        WHERE slug = ? AND publication_sha = ? AND state = 'claimed'""",
        [completed_at or _timestamp(), generation_id, slug, publication_sha],
    )
    return changes == 1


def fail_initial_trigger(
    slug: str,
    publication_sha: str,
    error: str,
    generation_id: str | None = None,
    *,
    query: Query = d1_query,
    failed_at: str | None = None,
) -> bool:
    _validate_identity(slug, publication_sha)
    changes = query(
        """UPDATE reel_initial_triggers
        SET state = 'failed', completed_at = NULL, failed_at = ?,
            generation_id = ?, error = ?
        WHERE slug = ? AND publication_sha = ? AND state = 'claimed'""",
        [failed_at or _timestamp(), generation_id, error[:500], slug, publication_sha],
    )
    return changes == 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Reserva e conclui triggers automáticos iniciais de Reels.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("claim", "complete", "fail"):
        subparser = subparsers.add_parser(command)
        subparser.add_argument("--slug", required=True)
        subparser.add_argument("--publication-sha", required=True)
        if command in {"complete", "fail"}:
            subparser.add_argument("--generation-id")
        if command == "fail":
            subparser.add_argument("--error", default="workflow_failed")
    args = parser.parse_args()

    if args.command == "claim":
        print("true" if claim_initial_trigger(args.slug, args.publication_sha) else "false")
    elif args.command == "complete":
        if not args.generation_id:
            raise ValueError("--generation-id é obrigatório para completar o trigger.")
        if not complete_initial_trigger(args.slug, args.publication_sha, args.generation_id):
            raise RuntimeError("O trigger automático já não estava no estado claimed.")
        print("completed")
    else:
        if not fail_initial_trigger(
            args.slug, args.publication_sha, args.error, args.generation_id,
        ):
            raise RuntimeError("O trigger automático já não estava no estado claimed.")
        print("failed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1)
