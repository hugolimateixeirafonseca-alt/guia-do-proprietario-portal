from __future__ import annotations

import os
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# Valores confirmados em src/styles/global.css e src/components/Marca.astro.
INK = "#102a31"
MUTED = "#5f7075"
GREEN = "#256b5c"
GREEN_DARK = "#174e43"
GREEN_SOFT = "#e7f1ed"
SAND = "#e2c58f"
CREAM = "#f5f2e9"
PAPER = "#fffefa"
LINE = "#dce4e0"

MARK_TILE = "#315f78"
MARK_HOME = "#f6efe0"
MARK_DOOR = "#24594f"
MARK_SUN = "#d8814b"
MARK_ACCENTS = "#d6a955"


def _fc_match(pattern: str) -> Path | None:
    if not shutil.which("fc-match"):
        return None
    result = subprocess.run(
        ["fc-match", "-f", "%{file}\n", pattern],
        check=False,
        capture_output=True,
        text=True,
    )
    candidate = Path(result.stdout.splitlines()[0]) if result.stdout.strip() else None
    return candidate if candidate and candidate.is_file() else None


@lru_cache(maxsize=2)
def font_path(bold: bool = False) -> Path:
    override = os.environ.get("REELS_FONT_BOLD" if bold else "REELS_FONT")
    if override:
        path = Path(override)
        if not path.is_file():
            raise FileNotFoundError(f"A fonte configurada não existe: {path}")
        return path

    pattern = "Inter:style=Bold" if bold else "Inter:style=Regular"
    matched = _fc_match(pattern)
    if matched:
        return matched

    windows = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = (
        [windows / "segoeuib.ttf", windows / "arialbd.ttf"]
        if bold
        else [windows / "segoeui.ttf", windows / "arial.ttf"]
    )
    candidates += [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "Não foi encontrada uma fonte adequada. Instale Inter ou defina REELS_FONT e REELS_FONT_BOLD."
    )


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(font_path(bold)), size=size)


def draw_mark(image: Image.Image, xy: tuple[int, int], size: int) -> None:
    """Desenha exatamente a geometria 64x64 definida em Marca.astro."""
    x, y = xy
    scale = size / 64
    draw = ImageDraw.Draw(image)

    def point(px: float, py: float) -> tuple[float, float]:
        return x + px * scale, y + py * scale

    draw.rounded_rectangle(
        [point(2, 2), point(62, 62)],
        radius=11 * scale,
        fill=MARK_TILE,
    )
    draw.polygon([point(10, 31), point(32, 12), point(54, 31), point(54, 54), point(10, 54)], fill=MARK_HOME)
    draw.rectangle([point(22, 36), point(42, 54)], fill=MARK_DOOR)
    draw.ellipse([point(43, 12), point(53, 22)], fill=MARK_SUN)
    width = max(1, round(3 * scale))
    for start, end in (((2, 32), (10, 32)), ((54, 32), (62, 32)), ((32, 2), (32, 12)), ((32, 54), (32, 62))):
        draw.line([point(*start), point(*end)], fill=MARK_ACCENTS, width=width)


def draw_wordmark(image: Image.Image, xy: tuple[int, int], size: int = 31) -> None:
    ImageDraw.Draw(image).text(xy, "Guia do Proprietário", font=font(size, True), fill=INK)
