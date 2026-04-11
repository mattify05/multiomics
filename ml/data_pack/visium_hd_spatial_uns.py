"""Build Scanpy-compatible ``adata.uns['spatial'][library_id]`` for Visium / Visium HD."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import numpy as np


def _image_to_uint8_rgb(arr: np.ndarray) -> np.ndarray:
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], axis=-1)
    elif arr.ndim == 3 and arr.shape[2] >= 4:
        arr = arr[..., :3]
    if np.issubdtype(arr.dtype, np.floating) and float(np.nanmax(arr)) <= 1.0 + 1e-5:
        arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    else:
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    return arr


def build_nested_spatial_uns(
    spatial_dir: Path,
    library_id: str,
    attach_images: bool = True,
) -> Dict[str, Any]:
    """
    Nested structure expected by ``scanpy.pl.spatial`` / many Squidpy Visium tutorials::

        uns['spatial'][library_id] = {'images': {'hires': ndarray, 'lowres': ...}, 'scalefactors': {...}}
    """
    spatial_dir = Path(spatial_dir)
    scalefactors: Dict[str, Any] = {}
    sf_path = spatial_dir / "scalefactors_json.json"
    if sf_path.is_file():
        with sf_path.open() as f:
            scalefactors = json.load(f)

    images: Dict[str, np.ndarray] = {}
    if attach_images:
        try:
            import matplotlib.image as mpimg
        except ImportError:
            mpimg = None  # type: ignore[assignment]
        if mpimg is not None:
            for key, fname in (("hires", "tissue_hires_image.png"), ("lowres", "tissue_lowres_image.png")):
                fp = spatial_dir / fname
                if fp.is_file():
                    images[key] = _image_to_uint8_rgb(np.asarray(mpimg.imread(str(fp))))

    return {library_id: {"images": images, "scalefactors": scalefactors}}
