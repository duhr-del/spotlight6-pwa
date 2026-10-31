# -*- coding: utf-8 -*-
"""Генерация иконок PWA: icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png.

Рисуем в 4-кратном разрешении и уменьшаем — края получаются гладкими.
Запуск:  python scripts/make_icons.py
"""

import math
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

BLUE = (74, 111, 165, 255)      # #4A6FA5
BLUE_DARK = (60, 92, 140, 255)  # #3C5C8C
WHITE = (255, 255, 255, 255)
GOLD = (240, 182, 56, 255)      # #F0B638

# Пути к bold-шрифтам на разных ОС. Берём первый найденный.
FONT_CANDIDATES = [
    # Windows
    r"C:\Windows\Fonts\georgiab.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\calibrib.ttf",
    # macOS
    "/Library/Fonts/Georgia Bold.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    # Linux — DejaVu / Liberation / Noto
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
]

# Кэш найденного шрифта, чтобы не сканировать список при каждом вызове.
_font_path = None


def _find_font():
    global _font_path
    if _font_path is not None:
        return _font_path
    for path in FONT_CANDIDATES:
        if pathlib.Path(path).exists():
            _font_path = path
            return path
    # Последняя попытка: поискать через fc-match (Linux).
    try:
        import shutil
        import subprocess
        if shutil.which("fc-match"):
            result = subprocess.run(
                ["fc-match", "-f", "%{file}", ":bold:sans"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                candidate = result.stdout.strip()
                if pathlib.Path(candidate).exists():
                    _font_path = candidate
                    return candidate
    except Exception:
        pass
    return None


def load_font(size):
    path = _find_font()
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def star_points(cx, cy, outer, inner, points=5, rotation=-90.0):
    verts = []
    for i in range(points * 2):
        angle = math.radians(rotation + i * 180.0 / points)
        r = outer if i % 2 == 0 else inner
        verts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return verts


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_letter(draw, cx, cy, size):
    font = load_font(int(size))
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = cx - width / 2 - bbox[0]
    y = cy - height / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=WHITE)


def compose(scale=4, maskable=False):
    """Возвращает готовое изображение 512×512 (рисуем в scale раз больше)."""
    size = 512 * scale
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(size * 0.22)
    rounded_rect(draw, (0, 0, size - 1, size - 1), radius, BLUE)

    # мягкая «полка» снизу, чтобы буква не висела в пустоте
    shelf_top = int(size * 0.70)
    draw.rounded_rectangle(
        (int(size * 0.16), shelf_top, int(size * 0.84), int(size * 0.78)),
        radius=int(size * 0.03),
        fill=(255, 255, 255, 38),
    )

    letter_size = size * (0.52 if maskable else 0.58)
    letter_cy = size * (0.50 if maskable else 0.46)
    draw_letter(draw, size / 2, letter_cy, letter_size)

    star_center = (size * (0.68 if maskable else 0.72), size * (0.74 if maskable else 0.78))
    star_scale = 0.80 if maskable else 1.0
    draw.polygon(
        star_points(star_center[0], star_center[1], size * 0.14 * star_scale, size * 0.062 * star_scale),
        fill=GOLD,
    )

    return img.resize((512, 512), Image.LANCZOS)


def save_maskable_with_bleed():
    """Maskable: фон до самых краёв, контент в безопасной зоне 80%."""
    base = compose(maskable=True)
    size = 512
    img = Image.new("RGBA", (size, size), BLUE)
    # вставляем скруглённую иконку нельзя — нужен полный квад; рисуем поверх фона
    img.paste(base, (0, 0), base)
    # закрашиваем прозрачные углы базовой картинки цветом фона
    draw = ImageDraw.Draw(img)
    return img


def main():
    icon = compose(maskable=False)
    icon.save(ICONS / "icon-512.png")
    icon.resize((192, 192), Image.LANCZOS).save(ICONS / "icon-192.png")

    maskable = save_maskable_with_bleed()
    maskable.save(ICONS / "icon-maskable-512.png")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#4A6FA5"/>
  <rect x="82" y="358" width="348" height="41" rx="16" fill="#ffffff" opacity="0.15"/>
  <text x="256" y="308" font-family="Georgia, 'Times New Roman', serif" font-size="300"
        font-weight="bold" fill="#ffffff" text-anchor="middle">A</text>
  <polygon fill="#F0B638" points="369,394 379,416 403,418 385,433 391,457 369,444 347,457 353,433 335,418 359,416"/>
</svg>
"""
    (ICONS / "icon.svg").write_text(svg, encoding="utf-8")
    print("Иконки записаны в", ICONS)


if __name__ == "__main__":
    main()