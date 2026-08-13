from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


CLOUDFLARE_APP_SLUG = "cloudflare-workers-and-pages"
CLOUDFLARE_CHECK_NAME = "Cloudflare Pages"
DEPLOYMENT_PATH = re.compile(
    r"^/(?P<account>[0-9a-f]{32})/pages/view/(?P<project>[a-z0-9-]+)/(?P<deployment>[0-9a-f-]{36})$"
)


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


def extract_check(payload: dict) -> tuple[str, str, str, str]:
    check = payload.get("check_run", {})
    if payload.get("action") != "completed":
        raise ValueError("O check ainda não terminou.")
    if check.get("conclusion") != "success":
        raise ValueError("O check Cloudflare Pages não terminou com sucesso.")
    if check.get("name") != CLOUDFLARE_CHECK_NAME:
        raise ValueError("O check não é o Cloudflare Pages esperado.")
    if check.get("app", {}).get("slug") != CLOUDFLARE_APP_SLUG:
        raise ValueError("O check não pertence à aplicação Cloudflare esperada.")
    details_url = check.get("details_url", "")
    parsed = urllib.parse.urlparse(details_url)
    query_path = urllib.parse.parse_qs(parsed.query).get("to", [""])
    deployment_path = parsed.path if parsed.path != "/" else query_path[0]
    match = DEPLOYMENT_PATH.fullmatch(deployment_path)
    if parsed.scheme != "https" or parsed.netloc != "dash.cloudflare.com" or not match:
        raise ValueError("O check não contém um deployment Cloudflare Pages reconhecível.")
    sha = check.get("head_sha", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("O check não contém um SHA válido.")
    return sha, match.group("account"), match.group("project"), match.group("deployment")


def fetch_deployment(deployment_id: str, config: PagesReadConfig) -> dict:
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{config.account_id}"
        f"/pages/projects/{config.project_name}/deployments/{deployment_id}"
    )
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {config.api_token}"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"A validação Pages Read falhou com HTTP {exc.code}.") from None
    if not payload.get("success") or not payload.get("result"):
        raise RuntimeError("A API Cloudflare não devolveu o deployment esperado.")
    return payload["result"]


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
    if deployment.get("latest_stage", {}).get("status") != "success":
        raise ValueError("O deployment Production falhou ou foi cancelado.")
    if metadata.get("branch") != "main" or source.get("production_branch") != "main":
        raise ValueError("O deployment não corresponde à branch Production main.")
    if metadata.get("commit_hash") != sha:
        raise ValueError("O deployment não corresponde ao SHA do check.")


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
    parser = argparse.ArgumentParser(description="Valida um check Production do Cloudflare Pages.")
    parser.add_argument("--event", type=Path, required=True)
    parser.add_argument("--activation-sha", required=True)
    parser.add_argument("--repository", type=Path, default=Path.cwd())
    parser.add_argument("--github-output", type=Path, default=os.environ.get("GITHUB_OUTPUT"))
    args = parser.parse_args()

    payload = json.loads(args.event.read_text(encoding="utf-8"))
    sha, event_account, event_project, deployment_id = extract_check(payload)
    config = PagesReadConfig.from_env()
    if event_account != config.account_id or event_project != config.project_name:
        raise ValueError("O check pertence a outro projeto Pages.")
    deployment = fetch_deployment(deployment_id, config)
    validate_production_deployment(deployment, sha=sha, project_name=config.project_name)
    validate_sha(args.repository.resolve(), sha=sha, activation_sha=args.activation_sha)

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
