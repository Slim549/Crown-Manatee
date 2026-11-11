"""Repair building and crown sprites.

The supplied PNGs were run through a white color-to-alpha filter. Interior pixels
are only partly opaque, and their stored RGB is the color that reconstructs the
original when composited on white. On the green board that reads as a ghosted,
green-tinted building.

Buildings: keep the keyed file's silhouette, but take color (and the baked
shadow) from the reference board, which is the same art on the real grass.
Crown: reverse the white composite so the fill stays its real color on any
background. Originals in public/assets are not modified.
"""
import os
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BASE = os.path.join(ROOT, "public", "assets")
OUT_B = os.path.join(BASE, "processed", "buildings")
OUT_U = os.path.join(BASE, "processed", "ui")

BOXES = {
    "01_courthouse_building_cluster.png": (102, 96, 657, 371),
    "02_tennis_and_recreation_facility.png": (1437, 151, 518, 318),
    "03_supervisor_of_elections_building.png": (823, 274, 568, 161),
    "04_sheriffs_office_operations_center.png": (684, 560, 477, 235),
    "05_modern_civic_building.png": (42, 601, 461, 336),
    "06_manatee_county_government_building.png": (1372, 687, 601, 315),
    "07_library.png": (412, 993, 443, 186),
    "08_property_appraiser_building.png": (1004, 1071, 548, 206),
    "09_water_pipe.png": (1503, 1233, 492, 192),
    "10_humane_society_building.png": (99, 1255, 521, 178),
}


def flood_bg(alpha, thresh=12):
    h, w = alpha.shape
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or alpha[y, x] > thresh:
            continue
        bg[y, x] = True
        q.append((y - 1, x))
        q.append((y + 1, x))
        q.append((y, x - 1))
        q.append((y, x + 1))
    return bg


def sample(img, xs, ys):
    h, w, _ = img.shape
    x = np.clip(xs, 0, w - 1.001)
    y = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = np.clip(x0 + 1, 0, w - 1)
    y1 = np.clip(y0 + 1, 0, h - 1)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    return (img[y0, x0] * (1 - fx) + img[y0, x1] * fx) * (1 - fy) + (
        img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    ) * fy


def repair_building(sprite, ref, empty, box):
    alpha = np.asarray(sprite.convert("RGBA"))[:, :, 3]
    h, w = alpha.shape
    bw, bh = empty.size
    bx, by, bw_box, bh_box = box
    content = ~flood_bg(alpha, 12)
    yy, xx = np.mgrid[0:h, 0:w]
    cx = (bx + (xx + 0.5) / w * bw_box) * (bw / 2000.0)
    cy = (by + (yy + 0.5) / h * bh_box) * (bh / 1545.0)
    ref_a = np.asarray(ref.convert("RGB")).astype(np.float32)
    emp_a = np.asarray(empty.convert("RGB")).astype(np.float32)
    rc = sample(ref_a, cx, cy)
    ec = sample(emp_a, cx, cy)
    diff = np.abs(rc - ec).max(axis=2)
    darker = rc.mean(axis=2) < ec.mean(axis=2) - 6
    dil = content.copy()
    for _ in range(4):
        d2 = dil.copy()
        d2[1:] |= dil[:-1]
        d2[:-1] |= dil[1:]
        d2[:, 1:] |= dil[:, :-1]
        d2[:, :-1] |= dil[:, 1:]
        dil = d2
    shadow = (~content) & dil & darker & (diff > 12)
    keep = (content & (diff > 8)) | shadow
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[:, :, :3] = np.clip(rc, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(keep, 255, 0)
    return Image.fromarray(out, "RGBA"), keep


def repair_crown(sprite):
    arr = np.asarray(sprite.convert("RGBA")).astype(np.float32)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    af = alpha / 255.0
    rec = np.clip(rgb * af[:, :, None] + 255.0 * (1.0 - af[:, :, None]), 0, 255)
    content = ~flood_bg(alpha, 12)
    # Pale fringe left by keying the black stroke against white.
    bg = ~content
    dil = bg.copy()
    for _ in range(2):
        d2 = dil.copy()
        d2[1:] |= dil[:-1]
        d2[:-1] |= dil[1:]
        d2[:, 1:] |= dil[:, :-1]
        d2[:, :-1] |= dil[:, 1:]
        dil = d2
    halo = content & dil & (rec.min(axis=2) > 242) & (alpha < 40)
    keep = content & ~halo
    out = np.zeros(arr.shape, dtype=np.uint8)
    out[:, :, :3] = rec.astype(np.uint8)
    out[:, :, 3] = np.where(keep, 255, 0)
    return Image.fromarray(out, "RGBA"), keep


def main():
    os.makedirs(OUT_B, exist_ok=True)
    os.makedirs(OUT_U, exist_ok=True)
    empty = Image.open(os.path.join(BASE, "board", "board-empty.png"))
    ref = Image.open(os.path.join(BASE, "board", "board-reference.png"))
    for fn, box in BOXES.items():
        im = Image.open(os.path.join(BASE, "buildings", fn))
        proc, keep = repair_building(im, ref, empty, box)
        proc.save(os.path.join(OUT_B, fn), optimize=True)
        opaque = int(keep.sum())
        print(f"{fn}: opaque {opaque} / {keep.size} ({opaque / keep.size:.1%})")
        if opaque < 1000:
            raise SystemExit("repair produced an empty sprite: " + fn)
    crown, keep = repair_crown(Image.open(os.path.join(BASE, "ui", "crown.png")))
    crown.save(os.path.join(OUT_U, "crown.png"), optimize=True)
    print(f"crown: opaque {int(keep.sum())} / {keep.size}")
    # Contact sheet for visual check: reference | repaired | raw keyed
    width, height = empty.size

    def mx(v):
        return int(round(v * (width / 2000)))

    def my(v):
        return int(round(v * (height / 1545)))

    sheet = empty.convert("RGBA")
    for fn, box in BOXES.items():
        proc = Image.open(os.path.join(OUT_B, fn)).convert("RGBA")
        x, y, w, h = box
        x0, y0, x1, y1 = mx(x), my(y), mx(x + w), my(y + h)
        sheet.alpha_composite(proc.resize((x1 - x0, y1 - y0), Image.Resampling.BILINEAR), (x0, y0))
    contact = os.path.join(ROOT, "scripts", "_contact.jpg")
    sheet.convert("RGB").resize((1200, int(1200 * height / width)), Image.Resampling.LANCZOS).save(contact, quality=82)
    # Crown on grass
    swatch = Image.new("RGBA", (280, 220), (111, 165, 2, 255))
    swatch.alpha_composite(crown, (19, 10))
    swatch.convert("RGB").save(os.path.join(ROOT, "scripts", "_crown.jpg"), quality=90)
    print("contact", contact)


if __name__ == "__main__":
    main()
