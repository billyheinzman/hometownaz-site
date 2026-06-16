#!/bin/bash
# ============================================================
# compress-listing-photos.sh
# 
# Resize + compress MLS photos for the website. Use this any time
# you get new hi-res photos from flexmls/Spark.
#
# USAGE:
#   ./compress-listing-photos.sh <source_folder> <mls_number>
#
# EXAMPLE:
#   ./compress-listing-photos.sh ~/Downloads/HiRes_7012683 7012683
#
# WHAT IT DOES:
#   • Resizes everything to max 1600px wide (sharp on cards, ~300KB each)
#   • Skips floor plans (4:3 aspect ratio detection)
#   • Picks 12 evenly-spaced photos from the gallery
#   • Saves as 01.jpg, 02.jpg ... 12.jpg in images/listings/<MLS>/
#   • Quality: 85% JPEG, progressive, optimized
#
# REQUIREMENTS:
#   • Python 3 with Pillow (pip install Pillow)
# ============================================================

set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <source_folder> <mls_number>"
  echo ""
  echo "Examples:"
  echo "  $0 ~/Downloads/HiRes_Photos_7012683 7012683"
  echo "  $0 \"./14430 W Parada Dr\" 7012683"
  exit 1
fi

SRC="$1"
MLS="$2"
DST="images/listings/$MLS"

if [ ! -d "$SRC" ]; then
  echo "ERROR: Source folder not found: $SRC"
  exit 1
fi

# Validate MLS number format (7 digits)
if ! [[ "$MLS" =~ ^[0-9]{7}$ ]]; then
  echo "ERROR: MLS must be 7 digits. Got: $MLS"
  exit 1
fi

python3 - "$SRC" "$MLS" "$DST" <<'PYEOF'
import sys, os, re
from PIL import Image

src_dir, mls, dst_dir = sys.argv[1], sys.argv[2], sys.argv[3]

# Find all jpg/jpeg/png files in source
exts = {'.jpg', '.jpeg', '.png'}
files = sorted([f for f in os.listdir(src_dir)
                if os.path.splitext(f)[1].lower() in exts])

if not files:
    print(f"ERROR: No image files found in {src_dir}")
    sys.exit(1)

print(f"Source: {len(files)} images in {src_dir}")

# Detect floor plans by aspect ratio (4:3 portrait-ish vs 3:2 landscape photos)
def is_floorplan(path):
    try:
        with Image.open(path) as img:
            w, h = img.size
            return abs((w/h) - (4/3)) < 0.05 and h > 1500
    except Exception:
        return False

# Filter out floor plans
photos = [f for f in files if not is_floorplan(os.path.join(src_dir, f))]
fp_count = len(files) - len(photos)
if fp_count:
    print(f"Excluded {fp_count} floor plan(s) from selection")

# Pick 12 evenly-spaced (always keep #1 = cover)
if len(photos) <= 12:
    chosen = photos
else:
    cover = photos[0]
    rest = photos[1:]
    step = len(rest) / 11
    chosen = [cover] + [rest[int(i*step)] for i in range(11)]

# Wipe destination folder
os.makedirs(dst_dir, exist_ok=True)
for f in os.listdir(dst_dir):
    os.remove(os.path.join(dst_dir, f))

TARGET_W = 1600
QUALITY = 85
total_before = 0
total_after = 0

for idx, fname in enumerate(chosen, 1):
    src = os.path.join(src_dir, fname)
    dst = os.path.join(dst_dir, f'{idx:02d}.jpg')
    
    with Image.open(src) as img:
        if img.mode != 'RGB':
            img = img.convert('RGB')
        w, h = img.size
        if w > TARGET_W:
            new_h = int(h * TARGET_W / w)
            img = img.resize((TARGET_W, new_h), Image.LANCZOS)
        img.save(dst, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    
    total_before += os.path.getsize(src)
    total_after += os.path.getsize(dst)

print(f"\n✓ Installed {len(chosen)} photos → {dst_dir}")
print(f"  Source size: {total_before/1024:.0f} KB")
print(f"  Output size: {total_after/1024:.0f} KB  ({total_after/total_before*100:.0f}% of source)")
PYEOF

echo ""
echo "Next steps:"
echo "  1. Open the site, hard-refresh the listings page"
echo "  2. Listing $MLS will now show the new photos"
echo "  3. Commit/upload images/listings/$MLS/ to your hosting"
