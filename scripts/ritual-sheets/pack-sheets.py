"""Pack official-stage ritual stills into 2x2 checkerboard contact sheets.

Reads a JSON payload from stdin and writes sheet-01.png, sheet-02.png, ... into
`sheetsDir`. Leftover 1-3 rituals go onto a final partial 2x2 sheet with empty
cells left blank (never dropped). Prints a JSON summary array to stdout.
"""
import json
import os
import sys
import textwrap
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
]


def load_cjk_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in FONT_CANDIDATES:
        if not os.path.exists(font_path):
            continue
        if font_path.endswith(".ttc"):
            # Prefer Simplified Chinese face inside the NotoSansCJK TTC.
            fallback_font = None
            for idx in range(10):
                try:
                    candidate = ImageFont.truetype(font_path, size, index=idx)
                except OSError:
                    break
                if fallback_font is None:
                    fallback_font = candidate
                family = candidate.getname()[0]
                if "SC" in family and "Mono" not in family:
                    return candidate
            if fallback_font is not None:
                return fallback_font
        else:
            try:
                return ImageFont.truetype(font_path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def fit_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text
    ellipsis = "..."
    lo, hi = 0, len(text)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if draw.textlength(text[:mid] + ellipsis, font=font) <= max_width:
            lo = mid
        else:
            hi = mid - 1
    return text[:lo] + ellipsis


def main() -> None:
    payload = json.load(sys.stdin)
    sheets_dir = payload["sheetsDir"]
    items = payload["items"]
    cols = int(payload.get("cols", 2))
    rows = int(payload.get("rows", 2))
    cell_w = int(payload.get("cellWidth", 692))
    cell_h = int(payload.get("cellHeight", 664))
    banner_meta = payload.get("bannerMeta", "")

    os.makedirs(sheets_dir, exist_ok=True)
    # Remove stale sheet-*.png from earlier runs so the folder reflects this batch.
    for existing in os.listdir(sheets_dir):
        if existing.startswith("sheet-") and existing.endswith(".png"):
            os.remove(os.path.join(sheets_dir, existing))

    per_sheet = cols * rows
    total = len(items)
    if total == 0:
        print(json.dumps([]))
        return

    label_font = load_cjk_font(22)
    banner_font = load_cjk_font(22)
    error_font = load_cjk_font(18)

    banner_h = 48
    header_h = 42
    pad = 16
    slot_w = cell_w + 2
    slot_h = header_h + cell_h + 2
    sheet_w = pad + cols * (slot_w + pad)
    sheet_h = banner_h + pad + rows * (slot_h + pad)

    bg_color = (20, 23, 28)
    banner_bg = (30, 36, 44)
    banner_fg = (232, 238, 245)
    checker_colors = ((30, 34, 42), (37, 42, 52))
    border_color = (58, 66, 80)
    label_fg = (242, 245, 249)
    fail_bg = (58, 28, 34)
    fail_border = (214, 86, 94)
    fail_fg = (255, 198, 202)

    results = []
    sheet_count = (total + per_sheet - 1) // per_sheet

    for sheet_idx in range(sheet_count):
        start = sheet_idx * per_sheet
        chunk = items[start : start + per_sheet]
        end = start + len(chunk)
        filename = f"sheet-{sheet_idx + 1:02d}.png"
        out_path = os.path.join(sheets_dir, filename)

        sheet = Image.new("RGB", (sheet_w, sheet_h), bg_color)
        draw = ImageDraw.Draw(sheet)

        draw.rectangle([0, 0, sheet_w, banner_h], fill=banner_bg)
        draw.line([0, banner_h - 1, sheet_w, banner_h - 1], fill=border_color, width=1)
        banner_parts = [f"sheet-{sheet_idx + 1:02d}", f"({start + 1}-{end} / {total})"]
        if banner_meta:
            banner_parts.append(banner_meta)
        banner_text = "  ·  ".join(banner_parts)
        draw.text((pad, 11), banner_text, fill=banner_fg, font=banner_font)

        for slot_idx in range(per_sheet):
            r, c = divmod(slot_idx, cols)
            x = pad + c * (slot_w + pad)
            y = banner_h + pad + r * (slot_h + pad)
            cell_bg = checker_colors[(r + c) % 2]

            if slot_idx >= len(chunk):
                # Empty cells stay visibly empty on partial final sheets.
                draw.rectangle(
                    [x, y, x + slot_w - 1, y + slot_h - 1],
                    fill=cell_bg,
                    outline=border_color,
                    width=1,
                )
                continue

            item = chunk[slot_idx]
            label = item["label"]
            img_x = x + 1
            img_y = y + 1 + header_h

            if item.get("failed") or not item.get("path") or not os.path.exists(item["path"]):
                draw.rectangle(
                    [x, y, x + slot_w - 1, y + slot_h - 1],
                    fill=fail_bg,
                    outline=fail_border,
                    width=2,
                )
                fail_label = fit_text(draw, f"FAILED  {label}", label_font, cell_w - 20)
                draw.text((x + 10, y + 9), fail_label, fill=fail_fg, font=label_font)
                err_msg = item.get("error") or "capture failed"
                wrapped = textwrap.wrap(err_msg, width=48)[:12]
                ty = img_y + 24
                for line in wrapped:
                    draw.text((img_x + 16, ty), line, fill=fail_fg, font=error_font)
                    ty += 26
                continue

            draw.rectangle(
                [x, y, x + slot_w - 1, y + slot_h - 1],
                fill=cell_bg,
                outline=border_color,
                width=1,
            )
            clipped_label = fit_text(draw, label, label_font, cell_w - 20)
            draw.text((x + 10, y + 9), clipped_label, fill=label_fg, font=label_font)

            with Image.open(item["path"]) as raw_im:
                im = raw_im.convert("RGB")
                if im.size != (cell_w, cell_h):
                    scale = min(cell_w / im.width, cell_h / im.height)
                    tw = max(1, int(round(im.width * scale)))
                    th = max(1, int(round(im.height * scale)))
                    im = im.resize((tw, th), Image.Resampling.LANCZOS)
                paste_x = img_x + (cell_w - im.width) // 2
                paste_y = img_y + (cell_h - im.height) // 2
                sheet.paste(im, (paste_x, paste_y))

        sheet.save(out_path)
        results.append(
            {
                "file": out_path,
                "name": filename,
                "width": sheet.width,
                "height": sheet.height,
                "cells": [item["id"] for item in chunk],
            }
        )

    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
