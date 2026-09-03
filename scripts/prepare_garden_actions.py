"""Package one generated action strip; use the project's sprite normalization helpers."""
from pathlib import Path
import importlib.util
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'scripts/sprite_tools/normalize_sprite_strip.py'
spec = importlib.util.spec_from_file_location('normalizer', HELPER)
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)

raw = Image.open(ROOT / 'asset-sources/player/plant-raw-v1.png').convert('RGBA')
if raw.getchannel('A').getextrema()[0] > 0:
    raise SystemExit('The generated strip is not transparent; do not ship a painted background.')
anchor = Image.open(ROOT / 'public/assets/player/walk-v2/09.png').convert('RGBA')
target_height = normalizer.crop_to_content(anchor, 8).height
slots = normalizer.split_strip(raw, 6)
crops = [normalizer.crop_to_content(slot, 8) for slot in slots]
max_width, max_height = normalizer.max_content_size(crops)
# One scale for the whole animation, derived from the shipped standing player.
scale = min(114 / max_width, target_height / max_height)
out = ROOT / 'public/assets/player/plant-v1'
out.mkdir(parents=True, exist_ok=True)
sheet = Image.new('RGBA', (768, 128), (0, 0, 0, 0))
for index, crop in enumerate(crops):
    frame = normalizer.compose_frame(crop, 128, scale)
    frame.save(out / f'{index + 1:02d}.png')
    sheet.alpha_composite(frame, (128 * index, 0))
sheet.save(ROOT / 'public/assets/player/player-plant-sheet-v1.png')
print(f'Packaged six frames: shared scale={scale:.4f}; standing height={target_height}; alpha preserved.')
