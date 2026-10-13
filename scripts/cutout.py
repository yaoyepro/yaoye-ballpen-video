"""Optional pre-step: character images on a plain WHITE background (jpg/png) -> tight transparent PNGs.
White regions connected to the image border become transparent; white INSIDE the character is kept.
Edge band is de-fringed (no white halo). For non-white backgrounds, use a proper matting tool instead."""
import glob, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

def cutout_dir(src_dir, dst_dir, white_min=226, white_spread=22, min_area=800):
    os.makedirs(dst_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(src_dir, "*.jpg")) + glob.glob(os.path.join(src_dir, "*.jpeg")) + glob.glob(os.path.join(src_dir, "*.png")))
    if not files: raise SystemExit(f"no images in {src_dir}")
    for f in files:
        im = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
        mn = im.min(2); mx = im.max(2)
        cand = (mn > white_min) & ((mx - mn) < white_spread)
        lab, n = nd.label(cand)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(border))
        fg = nd.binary_fill_holes(~bg) | ~bg
        fg = nd.binary_opening(fg, iterations=1)
        l2, n2 = nd.label(fg); sz = nd.sum(fg, l2, range(1, n2 + 1)); fg = np.isin(l2, [i + 1 for i, s in enumerate(sz) if s > min_area])
        alpha = fg.astype(np.float32)
        band = fg & ~nd.binary_erosion(fg, iterations=2)
        L = im.mean(2); a = np.clip((248 - L) / (248 - 110), 0, 1)
        alpha[band] = np.maximum(a[band], 0)
        out = im.copy(); aa = np.clip(alpha, 1e-3, 1)[..., None]
        dec = (im - (1 - aa) * 250) / aa; out[band] = np.clip(dec[band], 0, 255)
        alpha = nd.gaussian_filter(alpha, 0.4) * fg.astype(np.float32)
        rgba = np.dstack([out, np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
        ys, xs = np.where(alpha > 0.02)
        if len(ys) == 0: print("skip (empty)", f); continue
        y0, y1, x0, x1 = max(0, ys.min() - 6), ys.max() + 7, max(0, xs.min() - 6), xs.max() + 7
        name = os.path.splitext(os.path.basename(f))[0]
        Image.fromarray(rgba[y0:y1, x0:x1]).save(os.path.join(dst_dir, name + ".png"))
        print(name, (x1 - x0, y1 - y0))
