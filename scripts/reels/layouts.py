from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

from brand import CREAM, GREEN, GREEN_DARK, GREEN_SOFT, INK, LINE, MUTED, PAPER, SAND, draw_mark, draw_wordmark, font


WIDTH = 1080
HEIGHT = 1920
MARGIN = 100


def _canvas(category: str) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)
    draw_mark(image, (MARGIN, 184), 58)
    draw_wordmark(image, (176, 196), 29)
    category_font = font(22, True)
    bbox = draw.textbbox((0, 0), category, font=category_font)
    draw.text((WIDTH - MARGIN - (bbox[2] - bbox[0]), 204), category, font=category_font, fill=GREEN)
    draw.line((MARGIN, 280, WIDTH - MARGIN, 280), fill=LINE, width=2)
    draw.rectangle((0, 1690, WIDTH, 1760), fill=GREEN)
    draw.rectangle((MARGIN, 1668, WIDTH - 210, 1690), fill=SAND)
    return image


def _cover(path: Path, size: tuple[int, int], focal_y: float = 0.5) -> Image.Image:
    with Image.open(path) as source:
        source = ImageOps.exif_transpose(source).convert("RGB")
        target_ratio = size[0] / size[1]
        source_ratio = source.width / source.height
        if source_ratio > target_ratio:
            crop_width = round(source.height * target_ratio)
            left = (source.width - crop_width) // 2
            box = (left, 0, left + crop_width, source.height)
        else:
            crop_height = round(source.width / target_ratio)
            top = round((source.height - crop_height) * max(0, min(1, focal_y)))
            top = min(top, source.height - crop_height)
            box = (0, top, source.width, top + crop_height)
        return source.crop(box).resize(size, Image.Resampling.LANCZOS)


def _fit_text(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int], maximum: int, minimum: int, bold: bool = True, spacing: int = 8) -> tuple[object, str]:
    width = box[2] - box[0]
    height = box[3] - box[1]
    words = text.split()
    for size in range(maximum, minimum - 1, -2):
        candidate_font = font(size, bold)
        lines: list[str] = []
        current = ""
        for word in words:
            attempt = f"{current} {word}".strip()
            if draw.textbbox((0, 0), attempt, font=candidate_font)[2] <= width or not current:
                current = attempt
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
        wrapped = "\n".join(lines)
        bbox = draw.multiline_textbbox((0, 0), wrapped, font=candidate_font, spacing=spacing)
        if bbox[3] - bbox[1] <= height:
            return candidate_font, wrapped
    raise ValueError(f"O texto não cabe no layout: {text}")


def _text_box(image: Image.Image, text: str, box: tuple[int, int, int, int], maximum: int, minimum: int = 28, fill: str = INK, bold: bool = True, spacing: int = 8, anchor: str | None = None) -> None:
    draw = ImageDraw.Draw(image)
    chosen_font, wrapped = _fit_text(draw, text, box, maximum, minimum, bold, spacing)
    xy = (box[0], box[1])
    if anchor == "center":
        xy = ((box[0] + box[2]) // 2, box[1])
    draw.multiline_text(xy, wrapped, font=chosen_font, fill=fill, spacing=spacing, align="center" if anchor == "center" else "left", anchor="ma" if anchor == "center" else None)


def render_intro(data: dict) -> Image.Image:
    image = _canvas(data["category"])
    draw = ImageDraw.Draw(image)
    hero = _cover(data["_hero_path"], (880, 570), 0.45)
    image.paste(hero, (MARGIN, 342))
    draw.rectangle((MARGIN, 912, WIDTH - MARGIN, 920), fill=SAND)
    _text_box(image, data["intro"]["title"].upper(), (MARGIN, 1000, 900, 1130), 78, 58)
    _text_box(image, data["intro"]["accent"].upper(), (MARGIN, 1125, 900, 1235), 72, 54, GREEN)
    label = data["intro"]["label"]
    label_font = font(24, True)
    label_width = draw.textbbox((0, 0), label, font=label_font)[2]
    draw.rounded_rectangle((MARGIN, 1280, MARGIN + label_width + 54, 1338), radius=6, fill=GREEN_SOFT)
    draw.text((MARGIN + 27, 1295), label, font=label_font, fill=GREEN_DARK)
    _text_box(image, data["intro"]["subtitle"], (MARGIN, 1402, WIDTH - MARGIN, 1550), 34, 28, MUTED, False, 7)
    return image


def render_steps(data: dict, visible: int) -> Image.Image:
    image = _canvas(data["category"])
    draw = ImageDraw.Draw(image)
    _text_box(image, "A ordem é esta.\nSem complicar.", (MARGIN, 360, WIDTH - MARGIN, 575), 68, 54, INK, True, 5)
    start_y = 650
    for index, step in enumerate(data["steps"][:visible]):
        y = start_y + index * 170
        draw.ellipse((MARGIN, y, MARGIN + 88, y + 88), fill=GREEN)
        number_font = font(38, True)
        draw.text((MARGIN + 44, y + 43), str(step["number"]), font=number_font, fill=PAPER, anchor="mm")
        _text_box(image, step["title"], (MARGIN + 128, y - 2, WIDTH - MARGIN, y + 102), 39, 30)
        if index < visible - 1:
            draw.line((MARGIN + 44, y + 88, MARGIN + 44, y + 154), fill="#b9cdc5", width=4)
    return image


def render_warning(data: dict) -> Image.Image:
    image = _canvas(data["category"])
    draw = ImageDraw.Draw(image)
    hero = _cover(data["_hero_path"], (880, 500), 0.56)
    image.paste(hero, (MARGIN, 342))
    draw.text((MARGIN, 920), data["warning"]["eyebrow"].upper(), font=font(24, True), fill=GREEN)
    _text_box(image, data["warning"]["title"], (MARGIN, 982, WIDTH - MARGIN, 1110), 62, 48)
    draw.rounded_rectangle((MARGIN, 1170, WIDTH - MARGIN, 1322), radius=10, fill=GREEN_SOFT)
    _text_box(image, data["warning"]["body"], (MARGIN + 42, 1205, WIDTH - MARGIN - 42, 1292), 35, 29, GREEN_DARK)
    _text_box(image, data["warning"]["secondary"], (MARGIN, 1390, WIDTH - MARGIN, 1545), 34, 28, MUTED, False, 8)
    return image


def render_outro(data: dict) -> Image.Image:
    image = _canvas(data["category"])
    draw = ImageDraw.Draw(image)
    _text_box(image, data["outro"]["title"], (MARGIN, 470, WIDTH - MARGIN, 720), 68, 50, INK, True, 8, "center")
    draw.line((320, 800, 760, 800), fill=SAND, width=5)
    draw.text((WIDTH // 2, 900), data["outro"]["label"], font=font(28), fill=MUTED, anchor="ma")
    draw_mark(image, (WIDTH // 2 - 58, 1000), 116)
    draw.text((WIDTH // 2, 1150), data["outro"]["brand"], font=font(43, True), fill=INK, anchor="ma")
    draw.text((WIDTH // 2, 1280), data["outro"]["domain"], font=font(31, True), fill=GREEN, anchor="ma")
    return image
