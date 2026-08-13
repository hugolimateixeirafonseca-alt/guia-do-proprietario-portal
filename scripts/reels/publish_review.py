from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Callable


SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from content import load_content
from review_metadata import D1Config, failed_generation_metadata, pending_review_metadata, register_metadata
from storage import R2Config, UploadedGeneration, generate_generation_id, upload_generation
from video import probe_video


def validate_assets(slug: str, reel_json: Path, video: Path, contact: Path, ffprobe: str) -> dict:
    data = load_content(reel_json, REPOSITORY_ROOT)
    if data["slug"] != slug:
        raise ValueError("O slug do JSON não corresponde ao slug solicitado.")
    if not contact.is_file() or contact.stat().st_size == 0:
        raise FileNotFoundError(f"A contact sheet não existe: {contact}")
    probe_video(ffprobe, video, expected_audio=(SCRIPT_DIR / "assets" / "background.mp3").is_file())
    return data


def publish_after_validation(
    *,
    slug: str,
    generation_id: str,
    reel_json: Path,
    video: Path,
    contact: Path,
    ffprobe: str = "ffprobe",
    validator: Callable[..., dict] = validate_assets,
    uploader: Callable[..., UploadedGeneration] = upload_generation,
    registrar: Callable[..., None] = register_metadata,
) -> dict:
    data = validator(slug, reel_json, video, contact, ffprobe)
    uploaded = uploader(
        slug=slug,
        generation_id=generation_id,
        video=video,
        contact=contact,
        reel_json=reel_json,
    )
    metadata = pending_review_metadata(slug, data["template"], uploaded)
    registrar(metadata)
    return metadata.as_dict()


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publica uma geração validada em R2 e regista-a para revisão.")
    parser.add_argument("--new-generation-id", action="store_true")
    parser.add_argument("--slug")
    parser.add_argument("--generation-id")
    parser.add_argument("--json", type=Path)
    parser.add_argument("--video", type=Path)
    parser.add_argument("--contact", type=Path)
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--record-failure", action="store_true")
    parser.add_argument("--error", default="workflow_failed")
    return parser.parse_args()


def main() -> int:
    args = arguments()
    if args.new_generation_id:
        print(generate_generation_id())
        return 0
    if not args.slug or not args.generation_id:
        raise ValueError("--slug e --generation-id são obrigatórios.")
    if args.record_failure:
        register_metadata(failed_generation_metadata(args.slug, args.generation_id, args.error))
        print("Falha de geração registada sem upload.")
        return 0
    if not args.json or not args.video or not args.contact:
        raise ValueError("--json, --video e --contact são obrigatórios para upload.")
    R2Config.from_env()
    D1Config.from_env()
    metadata = publish_after_validation(
        slug=args.slug,
        generation_id=args.generation_id,
        reel_json=args.json.resolve(),
        video=args.video.resolve(),
        contact=args.contact.resolve(),
        ffprobe=args.ffprobe,
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1)
