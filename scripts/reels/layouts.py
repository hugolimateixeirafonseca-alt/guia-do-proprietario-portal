from __future__ import annotations

from functools import lru_cache
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


def _normalise_text(text: str) -> str:
    return "\n".join(" ".join(paragraph.split()) for paragraph in text.splitlines())


def _balanced_wrap(
    draw: ImageDraw.ImageDraw,
    text: str,
    candidate_font: object,
    width: int,
    max_lines: int | None = None,
) -> str | None:
    """Wrap whole words and favour visually balanced lines over greedy wrapping."""
    wrapped_paragraphs: list[str] = []
    remaining_lines = max_lines
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            wrapped_paragraphs.append("")
            if remaining_lines is not None:
                remaining_lines -= 1
            continue

        widths = [draw.textlength(word, font=candidate_font) for word in words]
        if any(word_width > width for word_width in widths):
            return None
        space_width = draw.textlength(" ", font=candidate_font)

        @lru_cache(maxsize=None)
        def best(start: int, lines_left: int) -> tuple[float, tuple[str, ...]] | None:
            if start == len(words):
                return 0.0, ()
            if lines_left == 0:
                return None

            best_result: tuple[float, tuple[str, ...]] | None = None
            line_width = 0.0
            for end in range(start, len(words)):
                line_width += widths[end] + (space_width if end > start else 0)
                if line_width > width:
                    break
                tail = best(end + 1, lines_left - 1)
                if tail is None:
                    continue
                is_last = end == len(words) - 1
                raggedness = ((width - line_width) / width) ** 2 * (0.2 if is_last else 1.0)
                # Evita uma última linha com uma única palavra muito curta.
                orphan_penalty = 0.35 if is_last and start > 0 and line_width < width * 0.28 else 0.0
                score = raggedness + orphan_penalty + tail[0]
                result = score, (" ".join(words[start : end + 1]), *tail[1])
                if best_result is None or result[0] < best_result[0]:
                    best_result = result
            return best_result

        available = remaining_lines if remaining_lines is not None else len(words)
        result = best(0, available)
        if result is None:
            return None
        lines = list(result[1])
        wrapped_paragraphs.extend(lines)
        if remaining_lines is not None:
            remaining_lines -= len(lines)
            if remaining_lines < 0:
                return None

    return "\n".join(wrapped_paragraphs)


def _greedy_wrap(draw: ImageDraw.ImageDraw, text: str, candidate_font: object, width: int) -> str:
    """Keep the established body-copy wrapping; title composition is handled separately."""
    lines: list[str] = []
    for paragraph in text.split("\n"):
        current = ""
        for word in paragraph.split():
            attempt = f"{current} {word}".strip()
            if draw.textbbox((0, 0), attempt, font=candidate_font)[2] <= width or not current:
                current = attempt
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return "\n".join(lines)


def _title_size_cap(text: str, maximum: int, minimum: int) -> int:
    """Reduce long titles gradually before layout fitting, without abrupt jumps."""
    character_count = len(" ".join(text.split()))
    reduction = max(0, (character_count - 24 + 11) // 12) * 2
    return max(minimum, maximum - reduction)


def _fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    maximum: int,
    minimum: int,
    bold: bool = True,
    spacing: int = 8,
    *,
    title: bool = False,
    max_lines: int | None = None,
) -> tuple[object, str, int]:
    width = box[2] - box[0]
    height = box[3] - box[1]
    text = _normalise_text(text)
    size_cap = _title_size_cap(text, maximum, minimum) if title else maximum
    for size in range(size_cap, minimum - 1, -2):
        candidate_font = font(size, bold)
        wrapped = _balanced_wrap(draw, text, candidate_font, width, max_lines) if title else _greedy_wrap(draw, text, candidate_font, width)
        if wrapped is None:
            continue
        line_spacing = max(spacing, round(size * 0.22)) if title else spacing
        bbox = draw.multiline_textbbox((0, 0), wrapped, font=candidate_font, spacing=line_spacing)
        if bbox[3] - bbox[1] <= height:
            return candidate_font, wrapped, line_spacing
    raise ValueError(f"O texto não cabe no layout: {text}")


def _text_box(
    image: Image.Image,
    text: str,
    box: tuple[int, int, int, int],
    maximum: int,
    minimum: int = 28,
    fill: str = INK,
    bold: bool = True,
    spacing: int = 8,
    centered: bool = False,
    *,
    title: bool = False,
    max_lines: int | None = None,
) -> None:
    draw = ImageDraw.Draw(image)
    chosen_font, wrapped, chosen_spacing = _fit_text(
        draw,
        text,
        box,
        maximum,
        minimum,
        bold,
        spacing,
        title=title,
        max_lines=max_lines,
    )
    if centered:
        draw.multiline_text(((box[0] + box[2]) // 2, box[1]), wrapped, font=chosen_font, fill=fill, spacing=chosen_spacing, align="center", anchor="ma")
    else:
        draw.multiline_text((box[0], box[1]), wrapped, font=chosen_font, fill=fill, spacing=chosen_spacing)


def _eyebrow(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int]) -> None:
    draw.text(xy, text.upper(), font=font(22, True), fill=GREEN)


def _intro_folio(data: dict) -> str:
    value = data["intro"]["title"].upper() if data["template"] == "ordered_steps" else data["category"]
    return f"01  •  {value}"


def _steps_eyebrow(data: dict) -> str:
    return f"{len(data['steps'])} passos, por ordem"


def _warning_folio(data: dict) -> str:
    return f"03  •  {data['warning']['eyebrow'].upper()}"


def render_intro(data: dict) -> Image.Image:
    image = _canvas(data["category"], _intro_folio(data))
    draw = ImageDraw.Draw(image)
    hero = _cover(data["_hero_path"], (896, 610), 0.45)
    _paste_card(image, hero, (MARGIN, CONTENT_TOP), radius=20)
    draw.rounded_rectangle((MARGIN + 32, 885, MARGIN + 342, 945), radius=8, fill=PAPER)
    draw.text((MARGIN + 56, 903), data["intro"]["label"], font=font(22, True), fill=GREEN_DARK)
    _text_box(
        image,
        data["intro"]["title"].upper(),
        (MARGIN, 1030, WIDTH - MARGIN, 1155),
        74,
        56,
        title=True,
        max_lines=2,
    )
    _text_box(
        image,
        data["intro"]["accent"].upper(),
        (MARGIN, 1155, WIDTH - MARGIN, 1270),
        74,
        56,
        GREEN,
        title=True,
        max_lines=2,
    )
    draw.line((MARGIN, 1328, MARGIN + 86, 1328), fill=SAND, width=8)
    _text_box(image, data["intro"]["subtitle"], (MARGIN, 1380, WIDTH - MARGIN, 1515), 35, 29, MUTED, False, 8)
    return image


def render_steps(data: dict, visible: int) -> Image.Image:
    if data["template"] == "cost_highlight":
        return _render_cost_steps(data, visible)
    if data["template"] == "ordered_steps":
        eyebrow = _steps_eyebrow(data)
        title = "A ordem é esta.\nSem complicar."
        item_label = "PASSOS"
    else:
        eyebrow = data["progress"]["eyebrow"]
        title = data["progress"]["title"]
        item_label = data["progress"]["itemLabel"].upper()
    image = _canvas(data["category"], f"02  •  {visible} DE {len(data['steps'])} {item_label}")
    draw = ImageDraw.Draw(image)
    _eyebrow(draw, eyebrow, (MARGIN, 358))
    _text_box(image, title, (MARGIN, 420, WIDTH - MARGIN, 610), 64, 48, INK, True, 8, title=True, max_lines=3)

    start_y = 672
    row_height = 166
    for index, step in enumerate(data["steps"][:visible]):
        y = start_y + index * row_height
        if index:
            draw.line((MARGIN + 48, y - 74, MARGIN + 48, y - 20), fill="#abc3b9", width=4)
        draw.ellipse((MARGIN, y - 8, MARGIN + 96, y + 88), fill=GREEN)
        draw.text((MARGIN + 48, y + 40), str(step["number"]), font=font(39, True), fill=PAPER, anchor="mm")
        _text_box(image, step["title"], (MARGIN + 140, y - 3, WIDTH - MARGIN, y + 96), 38, 29, title=True, max_lines=2)
        draw.line((MARGIN + 140, y + 112, WIDTH - MARGIN, y + 112), fill=LINE, width=2)
    return image


def _render_cost_steps(data: dict, visible: int) -> Image.Image:
    image = _canvas(data["category"], f"02  •  {visible} DE {len(data['steps'])} FATORES")
    draw = ImageDraw.Draw(image)
    _eyebrow(draw, data["progress"]["eyebrow"], (MARGIN, 350))
    _text_box(image, data["highlight"]["amount"], (MARGIN, 410, WIDTH - MARGIN, 565), 112, 82, GREEN, True, 4)
    _text_box(image, data["highlight"]["caption"], (MARGIN, 575, WIDTH - MARGIN, 650), 34, 29, MUTED, False)
    draw.line((MARGIN, 700, WIDTH - MARGIN, 700), fill=LINE, width=2)
    _text_box(image, data["progress"]["title"], (MARGIN, 760, WIDTH - MARGIN, 900), 49, 38, INK, True, 8, title=True, max_lines=2)

    start_y = 980
    row_height = 178
    for index, step in enumerate(data["steps"][:visible]):
        y = start_y + index * row_height
        draw.rounded_rectangle((MARGIN, y, MARGIN + 82, y + 82), radius=12, fill=GREEN)
        draw.text((MARGIN + 41, y + 41), str(step["number"]), font=font(34, True), fill=PAPER, anchor="mm")
        _text_box(image, step["title"], (MARGIN + 125, y - 1, WIDTH - MARGIN, y + 92), 37, 29, title=True, max_lines=2)
        if index < visible - 1:
            draw.line((MARGIN + 125, y + 116, WIDTH - MARGIN, y + 116), fill=LINE, width=2)
    return image


def render_warning(data: dict) -> Image.Image:
    image = _canvas(data["category"], _warning_folio(data))
    draw = ImageDraw.Draw(image)
    hero = _cover(data["_hero_path"], (370, 480), 0.52)
    _paste_card(image, hero, (MARGIN, 370), radius=18)
    draw.rectangle((MARGIN + 405, 370, MARGIN + 423, 850), fill=SAND)
    _eyebrow(draw, data["warning"]["eyebrow"], (MARGIN + 470, 405))
    _text_box(image, data["warning"]["title"], (MARGIN + 470, 480, WIDTH - MARGIN, 720), 57, 40, title=True, max_lines=4)

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
    _text_box(image, data["outro"]["title"], (MARGIN, 810, WIDTH - MARGIN, 1055), 64, 44, INK, True, 8, True, title=True, max_lines=4)
    draw.line((WIDTH // 2 - 70, 1130, WIDTH // 2 + 70, 1130), fill=SAND, width=7)
    draw.text((WIDTH // 2, 1215), data["outro"]["label"], font=font(28), fill=MUTED, anchor="ma")
    draw.text((WIDTH // 2, 1300), data["outro"]["brand"], font=font(46, True), fill=INK, anchor="ma")
    draw.text((WIDTH // 2, 1400), data["outro"]["domain"], font=font(31, True), fill=GREEN, anchor="ma")
    return image
