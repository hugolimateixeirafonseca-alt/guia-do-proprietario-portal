from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

from brand import CREAM, GREEN, GREEN_DARK, GREEN_SOFT, INK, LINE, MUTED, PAPER, SAND, draw_mark, draw_wordmark, font


WIDTH = 1080
HEIGHT = 1920
MARGIN = 92
CONTENT_TOP = 330
CONTENT_BOTTOM = 1580


def _canvas(category: str, folio: str) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)
    draw_mark(image, (MARGIN, 190), 64)
    draw_wordmark(image, (174, 205), 30)

    category_font = font(21, True)
    category_width = draw.textbbox((0, 0), category, font=category_font)[2]
    draw.text((WIDTH - MARGIN - category_width, 210), category, font=category_font, fill=GREEN)
    draw.line((MARGIN, 286, WIDTH - MARGIN, 286), fill="#cfdad5", width=2)

    # A mesma fita editorial atravessa todas as cenas sem competir com o conteúdo.
    draw.rounded_rectangle((MARGIN, 1650, WIDTH - MARGIN, 1668), radius=9, fill=SAND)
    draw.rounded_rectangle((MARGIN, 1682, WIDTH - MARGIN, 1718), radius=18, fill=GREEN)
    draw.text((MARGIN, 1760), folio, font=font(18, True), fill=MUTED)
    draw.text((WIDTH - MARGIN, 1760), "GUIADOPROPRIETARIO.PT", font=font(18, True), fill=MUTED, anchor="ra")
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


def _paste_card(image: Image.Image, content: Image.Image, xy: tuple[int, int], radius: int = 18, shadow: int = 18) -> None:
    x, y = xy
    width, height = content.size
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(layer)
    shadow_draw.rounded_rectangle((x + 5, y + 9, x + width + 5, y + height + 9), radius=radius, fill=(16, 42, 49, 32))
    layer = layer.filter(ImageFilter.GaussianBlur(shadow))
    image.paste(layer.convert("RGB"), mask=layer.getchannel("A"))
    mask = Image.new("L", content.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    image.paste(content, xy, mask)


def _fit_text(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int], maximum: int, minimum: int, bold: bool = True, spacing: int = 8) -> tuple[object, str]:
    width = box[2] - box[0]
    height = box[3] - box[1]
    paragraphs = text.split("\n")
    for size in range(maximum, minimum - 1, -2):
        candidate_font = font(size, bold)
        lines: list[str] = []
        for paragraph in paragraphs:
            words = paragraph.split()
            current = ""
            for word in words:
                attempt = f"{current} {word}".strip()
                if draw.textbbox((0, 0), attempt, font=candidate_font)[2] <= width or not current:
                    current = attempt
                else:
                    lines.append(current)
                    current = word
            lines.append(current)
        wrapped = "\n".join(lines)
        bbox = draw.multiline_textbbox((0, 0), wrapped, font=candidate_font, spacing=spacing)
        if bbox[3] - bbox[1] <= height:
            return candidate_font, wrapped
    raise ValueError(f"O texto não cabe no layout: {text}")


def _text_box(image: Image.Image, text: str, box: tuple[int, int, int, int], maximum: int, minimum: int = 28, fill: str = INK, bold: bool = True, spacing: int = 8, centered: bool = False) -> None:
    draw = ImageDraw.Draw(image)
    chosen_font, wrapped = _fit_text(draw, text, box, maximum, minimum, bold, spacing)
    if centered:
        draw.multiline_text(((box[0] + box[2]) // 2, box[1]), wrapped, font=chosen_font, fill=fill, spacing=spacing, align="center", anchor="ma")
    else:
        draw.multiline_text((box[0], box[1]), wrapped, font=chosen_font, fill=fill, spacing=spacing)


def _eyebrow(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int]) -> None:
    draw.text(xy, text.upper(), font=font(22, True), fill=GREEN)


def render_intro(data: dict) -> Image.Image:
    image = _canvas(data["category"], "01  •  HERDEI UMA CASA")
    draw = ImageDraw.Draw(image)
    hero = _cover(data["_hero_path"], (896, 610), 0.45)
    _paste_card(image, hero, (MARGIN, CONTENT_TOP), radius=20)
    draw.rounded_rectangle((MARGIN + 32, 885, MARGIN + 342, 945), radius=8, fill=PAPER)
    draw.text((MARGIN + 56, 903), data["intro"]["label"], font=font(22, True), fill=GREEN_DARK)
    _text_box(image, data["intro"]["title"].upper(), (MARGIN, 1030, WIDTH - MARGIN, 1155), 78, 60)
    _text_box(image, data["intro"]["accent"].upper(), (MARGIN, 1155, WIDTH - MARGIN, 1270), 78, 60, GREEN)
    draw.line((MARGIN, 1328, MARGIN + 86, 1328), fill=SAND, width=8)
    _text_box(image, data["intro"]["subtitle"], (MARGIN, 1380, WIDTH - MARGIN, 1515), 35, 29, MUTED, False, 8)
    return image


def render_steps(data: dict, visible: int) -> Image.Image:
    image = _canvas(data["category"], f"02  •  {visible} DE {len(data['steps'])} PASSOS")
    draw = ImageDraw.Draw(image)
    _eyebrow(draw, "5 passos, por ordem", (MARGIN, 358))
    _text_box(image, "A ordem é esta.\nSem complicar.", (MARGIN, 420, WIDTH - MARGIN, 610), 68, 54, INK, True, 4)

    start_y = 672
    row_height = 166
    for index, step in enumerate(data["steps"][:visible]):
        y = start_y + index * row_height
        if index:
            draw.line((MARGIN + 48, y - 74, MARGIN + 48, y - 20), fill="#abc3b9", width=4)
        draw.ellipse((MARGIN, y - 8, MARGIN + 96, y + 88), fill=GREEN)
        draw.text((MARGIN + 48, y + 40), str(step["number"]), font=font(39, True), fill=PAPER, anchor="mm")
        _text_box(image, step["title"], (MARGIN + 140, y - 3, WIDTH - MARGIN, y + 96), 40, 31)
        draw.line((MARGIN + 140, y + 112, WIDTH - MARGIN, y + 112), fill=LINE, width=2)
    return image


def render_warning(data: dict) -> Image.Image:
    image = _canvas(data["category"], "03  •  EVITE O BLOQUEIO")
    draw = ImageDraw.Draw(image)
    hero = _cover(data["_hero_path"], (370, 480), 0.52)
    _paste_card(image, hero, (MARGIN, 370), radius=18)
    draw.rectangle((MARGIN + 405, 370, MARGIN + 423, 850), fill=SAND)
    _eyebrow(draw, data["warning"]["eyebrow"], (MARGIN + 470, 405))
    _text_box(image, data["warning"]["title"], (MARGIN + 470, 480, WIDTH - MARGIN, 720), 61, 45)

    draw.rounded_rectangle((MARGIN, 960, WIDTH - MARGIN, 1190), radius=18, fill=GREEN_SOFT)
    draw.ellipse((MARGIN + 40, 1015, MARGIN + 112, 1087), fill=GREEN)
    draw.text((MARGIN + 76, 1051), "!", font=font(38, True), fill=PAPER, anchor="mm")
    _text_box(image, data["warning"]["body"], (MARGIN + 145, 1010, WIDTH - MARGIN - 38, 1135), 40, 32, GREEN_DARK)
    draw.line((MARGIN, 1290, MARGIN + 86, 1290), fill=SAND, width=8)
    _text_box(image, data["warning"]["secondary"], (MARGIN, 1340, WIDTH - MARGIN, 1490), 38, 30, MUTED, False, 8)
    return image


def render_outro(data: dict) -> Image.Image:
    image = _canvas(data["category"], "04  •  GUIA COMPLETO")
    draw = ImageDraw.Draw(image)
    draw.ellipse((WIDTH // 2 - 170, 365, WIDTH // 2 + 170, 705), fill=GREEN_SOFT)
    draw_mark(image, (WIDTH // 2 - 78, 458), 156)
    _text_box(image, data["outro"]["title"], (MARGIN, 810, WIDTH - MARGIN, 1055), 68, 48, INK, True, 8, True)
    draw.line((WIDTH // 2 - 70, 1130, WIDTH // 2 + 70, 1130), fill=SAND, width=7)
    draw.text((WIDTH // 2, 1215), data["outro"]["label"], font=font(28), fill=MUTED, anchor="ma")
    draw.text((WIDTH // 2, 1300), data["outro"]["brand"], font=font(46, True), fill=INK, anchor="ma")
    draw.text((WIDTH // 2, 1400), data["outro"]["domain"], font=font(31, True), fill=GREEN, anchor="ma")
    return image
