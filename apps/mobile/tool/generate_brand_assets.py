#!/usr/bin/env python3
"""Generate Faséa text-logo app icons and splash assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_SERIF = ROOT / "node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff"
FONT_SANS = ROOT / "assets/fonts/Inter-Variable.ttf"

CANVAS = (250, 248, 246)
TEXT = (68, 68, 68)
ACCENT = (166, 106, 74)
SECONDARY = (113, 109, 100)

BRAND = "Faséa"
SUBTITLE = "Pilates Studio"


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def draw_wordmark(
    draw: ImageDraw.ImageDraw,
    *,
    cx: float,
    cy: float,
    size: int,
    subtitle: bool = False,
    compact: bool = False,
) -> None:
    scale = 0.20 if compact else (0.24 if subtitle else 0.28)
    serif_size = max(12, int(size * scale))
    font = load_font(FONT_SERIF, serif_size)
    tw, th = measure(draw, BRAND, font)
    x = cx - tw / 2
    y = cy - th / 2 - (size * 0.04 if subtitle else 0)
    draw.text((x, y), BRAND, fill=TEXT, font=font)

    if subtitle:
        sans_size = max(10, int(size * 0.055))
        sans = load_font(FONT_SANS, sans_size)
        sw, sh = measure(draw, SUBTITLE, sans)
        draw.text(
            (cx - sw / 2, y + th + max(8, int(size * 0.035))),
            SUBTITLE,
            fill=SECONDARY,
            font=sans,
        )


def render_square(size: int, *, subtitle: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), CANVAS)
    draw = ImageDraw.Draw(img)
    draw_wordmark(draw, cx=size / 2, cy=size / 2, size=size, subtitle=subtitle)
    return img


def render_splash(width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(img)
    draw_wordmark(draw, cx=width / 2, cy=height / 2, size=min(width, height), subtitle=True)
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)}")


def main() -> None:
    branding = ROOT / "assets/branding"
    save_png(render_square(1024), branding / "icon_master.png")
    save_png(render_splash(1080, 1920), branding / "splash_portrait.png")
    save_png(render_splash(1284, 2778), branding / "splash_portrait_ios.png")

    android_mipmap = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    res = ROOT / "android/app/src/main/res"
    for folder, px in android_mipmap.items():
        save_png(render_square(px), res / folder / "ic_launcher.png")

    adaptive = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    for folder, px in adaptive.items():
        save_png(render_square(px), res / folder / "ic_launcher_foreground.png")

    save_png(render_square(512), res / "drawable-nodpi" / "splash_logo.png")

    ios_icons = {
        "Icon-App-20x20@1x.png": 20,
        "Icon-App-20x20@2x.png": 40,
        "Icon-App-20x20@3x.png": 60,
        "Icon-App-29x29@1x.png": 29,
        "Icon-App-29x29@2x.png": 58,
        "Icon-App-29x29@3x.png": 87,
        "Icon-App-40x40@1x.png": 40,
        "Icon-App-40x40@2x.png": 80,
        "Icon-App-40x40@3x.png": 120,
        "Icon-App-60x60@2x.png": 120,
        "Icon-App-60x60@3x.png": 180,
        "Icon-App-76x76@1x.png": 76,
        "Icon-App-76x76@2x.png": 152,
        "Icon-App-83.5x83.5@2x.png": 167,
        "Icon-App-1024x1024@1x.png": 1024,
    }
    icon_dir = ROOT / "ios/Runner/Assets.xcassets/AppIcon.appiconset"
    for name, px in ios_icons.items():
        save_png(render_square(px), icon_dir / name)

    launch_sizes = {
        "LaunchImage.png": 240,
        "LaunchImage@2x.png": 480,
        "LaunchImage@3x.png": 720,
    }
    launch_dir = ROOT / "ios/Runner/Assets.xcassets/LaunchImage.imageset"
    for name, px in launch_sizes.items():
        save_png(render_square(px, subtitle=True), launch_dir / name)

    web = ROOT / "web"
    for name, px in {
        "favicon.png": 32,
        "icons/Icon-192.png": 192,
        "icons/Icon-512.png": 512,
        "icons/Icon-maskable-192.png": 192,
        "icons/Icon-maskable-512.png": 512,
    }.items():
        maskable = "maskable" in name
        img = render_square(px)
        if maskable:
            img = Image.new("RGB", (px, px), CANVAS)
            draw = ImageDraw.Draw(img)
            draw_wordmark(draw, cx=px / 2, cy=px / 2, size=px, compact=True)
        save_png(img, web / name)

    print("Done.")


if __name__ == "__main__":
    main()
