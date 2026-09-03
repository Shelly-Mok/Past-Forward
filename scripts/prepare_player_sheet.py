#!/usr/bin/env python3
"""Turn the generated two-row player sheet into anchored transparent game frames."""

from pathlib import Path
from collections import deque
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/player-walk-sheet-raw-v2.png"
OUT_DIR = ROOT / "public/assets/player/walk-v2"
SHEET_OUT = ROOT / "public/assets/player/player-walk-sheet-v2.png"
PREVIEW_OUT = ROOT / "public/assets/player/player-walk-preview-v2.png"
FRAME_SIZE = 128
COLS = 6
ROWS = 2


def remove_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = list(rgba.getdata())
    cleaned = []
    for red, green, blue, _alpha in pixels:
        neutral = max(red, green, blue) - min(red, green, blue) < 12
        background = neutral and min(red, green, blue) > 218
        cleaned.append((red, green, blue, 0 if background else 255))
    rgba.putdata(cleaned)
    return rgba


def content_crop(slot: Image.Image) -> Image.Image:
    alpha = slot.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    box = alpha.getbbox()
    if box is None:
        raise RuntimeError("A sprite slot contains no visible character pixels.")
    return slot.crop(box)


def remove_small_components(slot: Image.Image) -> Image.Image:
    """Discard generation specks while preserving detached hands and shoes."""
    alpha = slot.getchannel("A")
    width, height = slot.size
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or alpha.getpixel((x, y)) <= 8:
                continue
            visited[index] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        next_index = next_y * width + next_x
                        if visited[next_index] or alpha.getpixel((next_x, next_y)) <= 8:
                            continue
                        visited[next_index] = 1
                        queue.append((next_x, next_y))
            components.append(component)

    if not components:
        return slot
    largest = max(len(component) for component in components)
    minimum = max(48, round(largest * 0.018))
    cleaned = slot.copy()
    cleaned_alpha = cleaned.getchannel("A")
    for component in components:
        if len(component) >= minimum:
            continue
        for point in component:
            cleaned_alpha.putpixel(point, 0)
    cleaned.putalpha(cleaned_alpha)
    return cleaned


def main() -> None:
    raw = remove_checkerboard(Image.open(SOURCE))
    slot_width = raw.width // COLS
    slot_height = raw.height // ROWS
    crops = []
    for row in range(ROWS):
        for column in range(COLS):
            left = column * slot_width
            top = row * slot_height
            slot = raw.crop((left, top, left + slot_width, top + slot_height))
            crops.append(content_crop(remove_small_components(slot)))

    max_width = max(crop.width for crop in crops)
    max_height = max(crop.height for crop in crops)
    scale = min((FRAME_SIZE - 14) / max_width, (FRAME_SIZE - 8) / max_height)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    frames = []
    for index, crop in enumerate(crops, start=1):
        width = max(1, round(crop.width * scale))
        height = max(1, round(crop.height * scale))
        resized = crop.resize((width, height), Image.Resampling.NEAREST)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        frame.alpha_composite(resized, ((FRAME_SIZE - width) // 2, FRAME_SIZE - height))
        frame.save(OUT_DIR / f"{index:02d}.png")
        frames.append(frame)

    sheet = Image.new("RGBA", (FRAME_SIZE * COLS, FRAME_SIZE * ROWS), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((index % COLS) * FRAME_SIZE, (index // COLS) * FRAME_SIZE))
    SHEET_OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET_OUT)

    tile = 16
    preview = Image.new("RGBA", sheet.size, (238, 238, 238, 255))
    for top in range(0, preview.height, tile):
        for left in range(0, preview.width, tile):
            if (left // tile + top // tile) % 2:
                preview.paste((216, 216, 216, 255), (left, top, left + tile, top + tile))
    preview.alpha_composite(sheet)
    preview.save(PREVIEW_OUT)


if __name__ == "__main__":
    main()
