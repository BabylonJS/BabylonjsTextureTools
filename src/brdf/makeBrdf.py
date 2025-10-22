# This file is written to parse the BRDF sheen LUT from the C++ source of
# "Practical Multiple-Scattering Sheen Using Linearly Transformed Cosines"
# https://github.com/tizian/ltc-sheen?tab=readme-ov-file
# LUT file: https://github.com/MiiBond/ltc-sheen/blob/master/fitting/python/data/ltc_table_sheen_volume.cpp
# LUT Generation Code: https://github.com/MiiBond/ltc-sheen/blob/master/fitting/src/bsdfs/sheen_volume.h
#!/usr/bin/env python3
"""
sheen_lut_to_datauri.py

Parse a C++ file containing:
  const Vector3f SheenLTC::_ltcParamTableApprox[32][32] = { { Vector3f(...), ... }, ... };

and emit a 32x32 PNG or data:image/png;base64 string.
Now includes the option to flip the X/Y axes (transpose image).

Usage:
  python3 sheen_lut_to_datauri.py input.cpp [--mode normalize|clip] [--output base64|png]
Dependencies:
  pip install pillow
"""
import re
import sys
import argparse
import base64
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except Exception:
    print("Pillow is required. Install with: pip install pillow", file=sys.stderr)
    sys.exit(1)

WIDTH = 32
HEIGHT = 32
EXPECTED = WIDTH * HEIGHT

VECTOR_RE = re.compile(r'Vector3f\s*\(\s*([^\)]*?)\s*\)', re.S)
FLOAT_RE = re.compile(r'[-+]?\d*\.\d+(?:[eE][-+]?\d+)?|[-+]?\d+')

def parse_vector_entries(text):
    entries = VECTOR_RE.findall(text)
    vals = []
    for ent in entries:
        nums = FLOAT_RE.findall(ent)
        if len(nums) < 3:
            continue
        x, y, z = float(nums[0]), float(nums[1]), float(nums[2])
        vals.append((x, y, z))
    return vals

def to_png_data(pixels, width, height):
    img = Image.new("RGB", (width, height))
    img.putdata(pixels)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def main():
    parser = argparse.ArgumentParser(description="Convert Vector3f LUT to base64 PNG or PNG file")
    parser.add_argument("input", help="C++ file (or - for stdin)")
    parser.add_argument("-m", "--mode", choices=("normalize","clip"), default="normalize",
                        help="normalize = per-channel remap to full 0..255 (default); clip = clamp to [0,1]")
    parser.add_argument("-o", "--output", choices=("base64","png"), default="base64",
                        help="output format: base64 (default) or png (write file)")
    parser.add_argument("--outfile", default="ltc_sheen_lut.png", help="output PNG filename (if --output png)")
    parser.add_argument("--swapxy", action="store_true", help="swap X and Y axes of the LUT (transpose image)")
    args = parser.parse_args()

    src = sys.stdin.read() if args.input == "-" else Path(args.input).read_text(encoding="utf-8")

    vectors = parse_vector_entries(src)
    if len(vectors) != EXPECTED:
        print(f"Warning: found {len(vectors)} entries (expected {EXPECTED}).", file=sys.stderr)
        if len(vectors) < EXPECTED:
            sys.exit(1)
    vectors = vectors[:EXPECTED]

    rs = [v[0] for v in vectors]
    gs = [v[1] for v in vectors]
    bs = [v[2] for v in vectors]
    rmin, rmax = min(rs), max(rs)
    gmin, gmax = min(gs), max(gs)
    bmin, bmax = min(bs), max(bs)

    # reshape into 2D array [y][x]
    rows = [vectors[y*WIDTH:(y+1)*WIDTH] for y in range(HEIGHT)]

    # optionally transpose
    if args.swapxy:
        rows = list(map(list, zip(*rows)))  # transpose 32x32

    pixels = []
    if args.mode == "normalize":
        def norm(v, mn, mx):
            if mx <= mn: return 0
            return int(round(max(0, min(1, (v - mn) / (mx - mn))) * 255))
        for y in range(HEIGHT):
            for x in range(WIDTH):
                r,g,b = rows[y][x]
                pixels.append((norm(r,rmin,rmax), norm(g,gmin,gmax), norm(b,bmin,bmax)))
    else:
        def clip8(v): return int(round(max(0, min(1, v)) * 255))
        for y in range(HEIGHT):
            for x in range(WIDTH):
                r,g,b = rows[y][x]
                pixels.append((clip8(r), clip8(g), clip8(b)))

    png_bytes = to_png_data(pixels, WIDTH, HEIGHT)

    if args.output == "png":
        Path(args.outfile).write_bytes(png_bytes)
        print(f"✅ Wrote PNG: {args.outfile} ({WIDTH}x{HEIGHT})")
    else:
        data_uri = "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")
        print("# Mode:", args.mode)
        print(f"# R range: {rmin:.6g}–{rmax:.6g}")
        print(f"# G range: {gmin:.6g}–{gmax:.6g}")
        print(f"# B range: {bmin:.6g}–{bmax:.6g}")
        print("# SwapXY:", args.swapxy)
        print()
        print(data_uri)

if __name__ == "__main__":
    main()
