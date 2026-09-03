"""Package the approved 4x4 lifecycle into one root-aligned game atlas."""
from pathlib import Path
import importlib.util
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('normalizer', ROOT / 'scripts/sprite_tools/normalize_sprite_strip.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
source = Image.open(ROOT / 'asset-sources/flowers/clean-rgba.png').convert('RGBA')
if source.getchannel('A').getextrema()[0] != 0:
    raise SystemExit('Source must contain true transparency, not a painted checkerboard.')

cells = []
row_cuts = [0, 297, 592, 898, 1254]  # Verified empty gutters in this approved 1254px sheet.
if source.size != (1254, 1254):
    raise SystemExit('Re-measure row gutters before packaging a differently sized source.')
for row in range(4):
    strip = source.crop((0, row_cuts[row], source.width, row_cuts[row + 1]))
    cells.extend(normalizer.split_strip(strip, 4))
contents = [normalizer.crop_to_content(cell, 8) for cell in cells]
if any(image is None for image in contents):
    raise SystemExit('All sixteen lifecycle frames must contain a plant/seed.')
max_width, max_height = normalizer.max_content_size(contents)
scale = min(112 / max_width, 116 / max_height)
out = ROOT / 'public/assets/garden/flower-lifecycle-v1'
out.mkdir(parents=True, exist_ok=True)
atlas = Image.new('RGBA', (16 * 128, 128))
for index, content in enumerate(contents):
    # Anchor on the soil, not the whole silhouette: falling seeds must not shift the stem.
    alpha = content.getchannel('A')
    soil_top = max(0, content.height - 20)
    soil_box = alpha.crop((0, soil_top, content.width, content.height)).getbbox()
    soil_center = (soil_box[0] + soil_box[2]) / 2
    width, height = max(1, round(content.width * scale)), max(1, round(content.height * scale))
    resized = content.resize((width, height), Image.Resampling.NEAREST)
    frame = Image.new('RGBA', (128, 128))
    frame.alpha_composite(resized, (round(64 - soil_center * scale), 124 - height))
    frame.save(out / f'{index + 1:02d}.png')
    atlas.alpha_composite(frame, (128 * index, 0))
atlas.save(ROOT / 'public/assets/garden/flower-lifecycle-v1.png')
print(f'16 frames, shared scale {scale:.4f}, ground baseline y=124, atlas {atlas.size}, alpha retained')
