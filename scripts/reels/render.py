from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

from brand import CREAM, INK, font, font_path
from content import load_content
from layouts import render_intro, render_outro, render_steps, render_warning
from video import encode_video, probe_video


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Renderiza um Reel vertical a partir de JSON estruturado.")
    parser.add_argument("--input", required=True, type=Path, help="JSON de conteúdo do Reel")
    parser.add_argument("--output", required=True, type=Path, help="MP4 a gerar")
    parser.add_argument("--contact-sheet", type=Path, help="JPG de revisão; por omissão usa <output>-contact.jpg")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="Executável ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe", help="Executável ffprobe")
    return parser.parse_args()


def resolve_from_working_directory(path: Path) -> Path:
    return path.resolve() if path.is_absolute() else (Path.cwd() / path).resolve()


def save_contact_sheet(items: list[tuple[str, Image.Image]], output: Path) -> None:
    columns = 3
    thumb_width, thumb_height = 300, 533
    gap_x, gap_y = 45, 68
    top = 110
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new("RGB", (1080, top + rows * (thumb_height + gap_y) + 25), CREAM)
    draw = ImageDraw.Draw(sheet)
    draw.text((45, 34), "Revisão do Reel", font=font(38, True), fill=INK)
    for index, (label, frame) in enumerate(items):
        column, row = index % columns, index // columns
        x = 45 + column * (thumb_width + gap_x)
        y = top + row * (thumb_height + gap_y)
        thumb = frame.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.text((x, y + thumb_height + 13), label, font=font(22, True), fill=INK)
    sheet.save(output, format="JPEG", quality=91, optimize=True)


def main() -> int:
    args = arguments()
    input_path = resolve_from_working_directory(args.input)
    output = resolve_from_working_directory(args.output)
    contact = resolve_from_working_directory(args.contact_sheet) if args.contact_sheet else output.with_name(f"{output.stem}-contact.jpg")
    if output.suffix.lower() != ".mp4":
        raise ValueError("--output tem de terminar em .mp4")
    output.parent.mkdir(parents=True, exist_ok=True)
    contact.parent.mkdir(parents=True, exist_ok=True)
    data = load_content(input_path, REPOSITORY_ROOT)

    print(f"Fonte regular: {font_path(False)}")
    print(f"Fonte bold: {font_path(True)}")
    with tempfile.TemporaryDirectory(prefix=".reel-build-", dir=output.parent) as temporary:
        work = Path(temporary)
        intro = render_intro(data)
        steps = [render_steps(data, visible) for visible in range(1, len(data["steps"]) + 1)]
        warning = render_warning(data)
        outro = render_outro(data)

        intro_path = work / "scene-intro.png"
        intro.save(intro_path)
        step_paths = []
        for index, frame in enumerate(steps, start=1):
            path = work / f"scene-steps-{index}.png"
            frame.save(path)
            step_paths.append(path)
        warning_path = work / "scene-warning.png"
        warning.save(warning_path)
        outro_path = work / "scene-outro.png"
        outro.save(outro_path)

        save_contact_sheet(
            [("Introdução", intro), ("Passo 1", steps[0]), ("Passo 3", steps[min(2, len(steps) - 1)]), ("Passos completos", steps[-1]), ("Aviso", warning), ("Fecho", outro)],
            contact,
        )
        encode_video(args.ffmpeg, {"intro": intro_path, "steps": step_paths, "warning": warning_path, "outro": outro_path}, output, work)

    result = probe_video(args.ffprobe, output)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"MP4: {output}")
    print(f"Contact sheet: {contact}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1)
