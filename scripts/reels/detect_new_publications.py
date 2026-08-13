from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path


ARTICLES_PREFIX = "src/content/artigos/"
PENDING_PREFIX = "src/content/por-publicar/"
ARTICLE_SUFFIXES = (".md", ".mdx")


@dataclass(frozen=True)
class DetectionResult:
    sha: str
    parent: str
    slugs: list[str]


def _git(repository: Path, *arguments: str, text: bool = True) -> str | bytes:
    result = subprocess.run(
        ["git", "-C", str(repository), *arguments],
        check=True,
        capture_output=True,
        text=text,
        encoding="utf-8" if text else None,
    )
    return result.stdout


def _is_article(path: str) -> bool:
    return path.startswith(ARTICLES_PREFIX) and path.lower().endswith(ARTICLE_SUFFIXES)


def _is_pending(path: str) -> bool:
    return path.startswith(PENDING_PREFIX) and path.lower().endswith(ARTICLE_SUFFIXES)


def _diff_entries(repository: Path, parent: str, sha: str) -> list[tuple[str, str, str | None]]:
    raw = _git(
        repository,
        "diff",
        "--find-renames=50%",
        "--name-status",
        "-z",
        parent,
        sha,
        "--",
        ARTICLES_PREFIX,
        PENDING_PREFIX,
        text=False,
    )
    parts = raw.decode("utf-8").split("\0")
    if parts and parts[-1] == "":
        parts.pop()

    entries: list[tuple[str, str, str | None]] = []
    index = 0
    while index < len(parts):
        status = parts[index]
        index += 1
        if status.startswith(("R", "C")):
            source, destination = parts[index], parts[index + 1]
            index += 2
            entries.append((status, destination, source))
        else:
            path = parts[index]
            index += 1
            entries.append((status, path, None))
    return entries


def _was_previously_published(repository: Path, parent: str, path: str) -> bool:
    history = _git(repository, "log", "--format=%H", parent, "--", path)
    return bool(str(history).strip())


def _is_draft_at(repository: Path, sha: str, path: str) -> bool:
    source = str(_git(repository, "show", f"{sha}:{path}"))
    if not source.startswith("---"):
        return False
    end = source.find("\n---", 3)
    frontmatter = source[3:end if end >= 0 else len(source)]
    match = re.search(r"(?mi)^\s*rascunho\s*:\s*(true|false)\s*(?:#.*)?$", frontmatter)
    return bool(match and match.group(1).lower() == "true")


def detect_new_publications(repository: Path, sha: str) -> DetectionResult:
    repository = repository.resolve()
    resolved_sha = str(_git(repository, "rev-parse", f"{sha}^{{commit}}")).strip()
    parent = str(_git(repository, "rev-parse", f"{resolved_sha}^1")).strip()
    candidates: set[str] = set()

    for status, path, source in _diff_entries(repository, parent, resolved_sha):
        if not _is_article(path):
            continue
        if status == "A":
            candidates.add(path)
        elif status.startswith(("R", "C")) and source and _is_pending(source):
            candidates.add(path)

    slugs: list[str] = []
    for path in sorted(candidates):
        if _was_previously_published(repository, parent, path):
            continue
        if _is_draft_at(repository, resolved_sha, path):
            continue
        slugs.append(Path(path).stem)

    return DetectionResult(sha=resolved_sha, parent=parent, slugs=slugs)


def main() -> int:
    parser = argparse.ArgumentParser(description="Deteta artigos publicados pela primeira vez num commit.")
    parser.add_argument("--sha", required=True)
    parser.add_argument("--repository", type=Path, default=Path.cwd())
    parser.add_argument("--github-output", type=Path, default=os.environ.get("GITHUB_OUTPUT"))
    args = parser.parse_args()

    result = detect_new_publications(args.repository, args.sha)
    payload = asdict(result)
    print(json.dumps(payload, ensure_ascii=False))
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as output:
            output.write(f"sha={result.sha}\n")
            output.write(f"parent={result.parent}\n")
            output.write("slugs=" + json.dumps(result.slugs, ensure_ascii=False) + "\n")
            output.write(f"count={len(result.slugs)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
