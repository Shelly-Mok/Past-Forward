"""Slice the 8-kind source sheet into a 128px atlas with true alpha."""
from pathlib import Path
import importlib.util
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('normalizer', ROOT / 'scripts/sprite_tools/normalize_sprite_strip.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)

source_path = Path(__import__('sys').argv[1]) if len(__import__('sys').argv) > 1 else ROOT / 'asset-sources/flowers/flower-kinds-source-v1.png'
source = Image.open(source_path).convert('RGBA')
pixels = source.load()
for y in range(source.height):
    for x in range(source.width):
        r, g, b, a = pixels[x, y]
        if r < 14 and g < 14 and b < 14:
            pixels[x, y] = (0, 0, 0, 0)

slots = normalizer.split_strip(source, 8)
contents = [normalizer.crop_to_content(slot, 8) for slot in slots]
if any(image is None for image in contents):
    raise SystemExit('Every kind cell must contain a flower.')
max_width, max_height = normalizer.max_content_size(contents)
scale = min(112 / max_width, 116 / max_height)
out = ROOT / 'public/assets/garden/flower-kinds-v1'
out.mkdir(parents=True, exist_ok=True)
atlas = Image.new('RGBA', (8 * 128, 128))
for index, content in enumerate(contents):
    alpha = content.getchannel('A')
    soil_top = max(0, content.height - 24)
    soil_box = alpha.crop((0, soil_top, content.width, content.height)).getbbox() or (0, 0, content.width, content.height)
    soil_center = (soil_box[0] + soil_box[2]) / 2
    width, height = max(1, round(content.width * scale)), max(1, round(content.height * scale))
    resized = content.resize((width, height), Image.Resampling.NEAREST)
    frame = Image.new('RGBA', (128, 128))
    frame.alpha_composite(resized, (round(64 - soil_center * scale), 124 - height))
    frame.save(out / f'{index + 1:02d}.png')
    atlas.alpha_composite(frame, (128 * index, 0))
atlas.save(ROOT / 'public/assets/garden/flower-kinds-v1.png')
print(f'8 kinds, shared scale {scale:.4f}, ground baseline y=124, atlas {atlas.size}')
