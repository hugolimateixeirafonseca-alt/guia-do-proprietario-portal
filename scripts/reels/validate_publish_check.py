from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


SHA_PATTERN = re.compile(r"[0-9a-f]{40}")
TERMINAL_FAILURE_STATES = {"failure", "failed", "canceled", "cancelled", "skipped"}
PAGES_PER_PAGE = 25
MAX_PAGES_TO_SCAN = 20


@dataclass(frozen=True)
class PagesReadConfig:
    account_id: str
    project_name: str
    api_token: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "PagesReadConfig":
        values = os.environ if env is None else env
        names = ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_PAGES_PROJECT", "CLOUDFLARE_PAGES_READ_TOKEN")
        missing = [name for name in names if not values.get(name, "").strip()]
        if missing:
            raise ValueError("Configuração Pages Read em falta: " + ", ".join(missing))
        return cls(*(values[name].strip() for name in names))


def extract_candidate_sha(payload: dict, event_name: str) -> str:
    if event_name == "repository_dispatch":
        if payload.get("action") != "reel_publish_candidate":
            raise ValueError("O repository_dispatch não tem o tipo esperado.")
        client_payload = payload.get("client_payload")
        if not isinstance(client_payload, dict) or set(client_payload) != {"sha"}:
            raise ValueError("O client_payload deve conter exclusivamente o SHA publicado.")
        sha = client_payload.get("sha", "")
    elif event_name == "push":
        if payload.get("ref") != "refs/heads/main":
            raise ValueError("O push não pertence à branch main.")
        sha = payload.get("after", "")
    else:
        raise ValueError("Evento não suportado para publicação automática de Reels.")
    if not isinstance(sha, str) or not SHA_PATTERN.fullmatch(sha):
        raise ValueError("O evento não contém um SHA completo válido.")
    return sha


def _request_deployments_page(config: PagesReadConfig, page: int) -> dict:
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{config.account_id}"
        f"/pages/projects/{config.project_name}/deployments"
        f"?env=production&page={page}&per_page={PAGES_PER_PAGE}"
    )
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {config.api_token}"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"A validação Pages Read falhou com HTTP {exc.code}.") from None
    if not payload.get("success") or not isinstance(payload.get("result"), list):
        raise RuntimeError("A API Cloudflare não devolveu a lista de deployments esperada.")
    return payload


def fetch_production_deployments(
    config: PagesReadConfig,
    target_sha: str,
    *,
    max_pages: int = MAX_PAGES_TO_SCAN,
    page_fetcher=_request_deployments_page,
) -> list[dict]:
    """Procura o SHA em páginas sucessivas de deployments Production.

    O portal tem muitos deployments. Limitar a pesquisa à primeira página fazia
    uma reconciliação antiga esperar até ao timeout mesmo quando o deployment
    existia. Paramos logo que encontramos o SHA e impomos um teto para evitar
    uma varredura ilimitada da API.
    """
    if not SHA_PATTERN.fullmatch(target_sha):
        raise ValueError("O SHA alvo da pesquisa Pages é inválido.")
    if max_pages < 1:
        raise ValueError("max_pages tem de ser pelo menos 1.")

    collected: list[dict] = []
    for page in range(1, max_pages + 1):
        payload = page_fetcher(config, page)
        results = payload["result"]
        collected.extend(results)

        if any(
            item.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") == target_sha
            and item.get("environment") == "production"
            for item in results
        ):
            return collected

        info = payload.get("result_info") if isinstance(payload.get("result_info"), dict) else {}
        total_pages = info.get("total_pages")
        if isinstance(total_pages, int) and total_pages > 0 and page >= total_pages:
            break

        total_count = info.get("total_count")
        if isinstance(total_count, int) and total_count >= 0:
            calculated_pages = max(1, math.ceil(total_count / PAGES_PER_PAGE))
            if page >= calculated_pages:
                break

        if len(results) < PAGES_PER_PAGE:
            break

    return collected


def validate_production_deployment(deployment: dict, *, sha: str, project_name: str) -> None:
    trigger = deployment.get("deployment_trigger", {})
    metadata = trigger.get("metadata", {})
    source = deployment.get("source", {}).get("config", {})
    if deployment.get("project_name") != project_name:
        raise ValueError("O deployment pertence a outro projeto Pages.")
    if deployment.get("environment") != "production":
        raise ValueError("O deployment é Preview, não Production.")
    if deployment.get("is_skipped"):
        raise ValueError("O deployment Production foi ignorado.")
    status = str(deployment.get("latest_stage", {}).get("status", "")).lower()
    if status in TERMINAL_FAILURE_STATES:
        raise ValueError(f"O deployment Production terminou no estado {status}.")
    if status != "success":
        raise ValueError("O deployment Production ainda não terminou.")
    if metadata.get("branch") != "main" or source.get("production_branch") != "main":
        raise ValueError("O deployment não corresponde à branch Production main.")
    if metadata.get("commit_hash") != sha:
        raise ValueError("O deployment não corresponde ao SHA publicado.")


def wait_for_production_deployment(
    config: PagesReadConfig,
    *,
    sha: str,
    timeout_seconds: float = 2400,
    poll_interval_seconds: float = 15,
    fetcher=fetch_production_deployments,
    sleeper=time.sleep,
    monotonic=time.monotonic,
) -> dict:
    deadline = monotonic() + timeout_seconds
    while True:
        deployments = fetcher(config, sha)
        matching = [
            item for item in deployments
            if item.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") == sha
            and item.get("environment") == "production"
        ]
        if matching:
            deployment = matching[0]
            if deployment.get("project_name") != config.project_name:
                raise ValueError("O deployment pertence a outro projeto Pages.")
            if deployment.get("is_skipped"):
                raise ValueError("O deployment Production foi ignorado.")
            status = str(deployment.get("latest_stage", {}).get("status", "")).lower()
            if status == "success":
                validate_production_deployment(deployment, sha=sha, project_name=config.project_name)
                return deployment
            if status in TERMINAL_FAILURE_STATES:
                raise ValueError(f"O deployment Production terminou no estado {status}.")
        if monotonic() >= deadline:
            raise RuntimeError(f"Timeout à espera do deployment Production para {sha}.")
        sleeper(poll_interval_seconds)


def _is_ancestor(repository: Path, ancestor: str, descendant: str) -> bool:
    result = subprocess.run(
        ["git", "-C", str(repository), "merge-base", "--is-ancestor", ancestor, descendant],
        check=False,
        capture_output=True,
    )
    return result.returncode == 0


def validate_sha(repository: Path, *, sha: str, activation_sha: str, main_ref: str = "origin/main") -> None:
    if sha == activation_sha or not _is_ancestor(repository, activation_sha, sha):
        raise ValueError("O SHA é anterior ou igual ao ponto de ativação da Fase 2C.")
    if not _is_ancestor(repository, sha, main_ref):
        raise ValueError("O SHA não pertence à história atual de main.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida o deployment Production do SHA publicado.")
    parser.add_argument("--event", type=Path, required=True)
    parser.add_argument("--event-name", required=True)
    parser.add_argument("--activation-sha", required=True)
    parser.add_argument("--repository", type=Path, default=Path.cwd())
    parser.add_argument("--github-output", type=Path, default=os.environ.get("GITHUB_OUTPUT"))
    args = parser.parse_args()

    payload = json.loads(args.event.read_text(encoding="utf-8"))
    sha = extract_candidate_sha(payload, args.event_name)
    config = PagesReadConfig.from_env()
    validate_sha(args.repository.resolve(), sha=sha, activation_sha=args.activation_sha)
    deployment = wait_for_production_deployment(config, sha=sha)
    deployment_id = deployment.get("id", "")

    print(f"Deployment Production confirmado para {sha}.")
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as output:
            output.write(f"sha={sha}\n")
            output.write(f"deployment_id={deployment_id}\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}")
        raise SystemExit(1)
