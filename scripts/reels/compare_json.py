from __future__ import annotations

import argparse
import json
from pathlib import Path


TEXT_LIMITS = {
    "intro.title": 32,
    "intro.accent": 30,
    "intro.subtitle": 80,
    "warning.title": 60,
    "warning.body": 90,
    "warning.secondary": 100,
    "outro.title": 75,
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compara um JSON gerado por IA com uma fixture manual aprovada.")
    parser.add_argument("--generated", required=True, type=Path)
    parser.add_argument("--fixture", required=True, type=Path)
    return parser.parse_args()


def _read(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON inválido em {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"A raiz de {path} não é um objeto.")
    return value


def _nested(data: dict, path: str) -> str:
    value = data
    for part in path.split("."):
        value = value.get(part, {}) if isinstance(value, dict) else {}
    return value if isinstance(value, str) else ""


def main() -> int:
    args = arguments()
    generated = _read(args.generated)
    fixture = _read(args.fixture)
    report = {
        "slug": generated.get("slug"),
        "templateGenerated": generated.get("template"),
        "templateFixture": fixture.get("template", "ordered_steps"),
        "templateMatches": generated.get("template") == fixture.get("template", "ordered_steps"),
        "stepsGenerated": len(generated.get("steps", [])),
        "stepsFixture": len(fixture.get("steps", [])),
        "density": {
            path: {"characters": len(_nested(generated, path)), "limit": limit}
            for path, limit in TEXT_LIMITS.items()
        },
        "stepCharacters": [len(str(step.get("title", ""))) for step in generated.get("steps", [])],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["templateMatches"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
