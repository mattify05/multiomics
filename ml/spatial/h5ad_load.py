"""Shared helpers for large `.h5ad` workflows: subsampling obs and lightweight metadata reads."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np


def subsample_obs(adata: Any, max_obs: Optional[int], random_seed: int = 0) -> Any:
    """Return a copy with at most ``max_obs`` observations (uniform random, fixed seed)."""
    if max_obs is None or adata.n_obs <= max_obs:
        return adata
    rng = np.random.default_rng(random_seed)
    idx = rng.choice(adata.n_obs, size=max_obs, replace=False)
    idx.sort()
    return adata[idx].copy()


def h5ad_metadata_summary(path: Path) -> Dict[str, Any]:
    """Read shape / keys from a file without loading the full matrix into memory (backed mode)."""
    import anndata as ad

    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(str(p))
    adata = ad.read_h5ad(p, backed="r")
    try:
        summary: Dict[str, Any] = {
            "path": str(p.resolve()),
            "n_obs": int(adata.n_obs),
            "n_vars": int(adata.n_vars),
            "obs_columns": [str(c) for c in adata.obs.columns],
            "obsm_keys": list(adata.obsm.keys()),
            "uns_keys": list(adata.uns.keys()),
        }
        if "platform" in adata.obs.columns:
            vc = adata.obs["platform"].astype(str).value_counts().head(20)
            summary["platform_counts"] = {str(k): int(v) for k, v in vc.items()}
        if "sample_id" in adata.obs.columns:
            summary["n_sample_id_levels"] = int(adata.obs["sample_id"].astype(str).nunique())
        if "slide_id" in adata.obs.columns:
            summary["n_slide_id_levels"] = int(adata.obs["slide_id"].astype(str).nunique())
        vh = adata.uns.get("visium_hd")
        if isinstance(vh, dict):
            summary["visium_hd"] = {k: v for k, v in vh.items() if k != "note"}
        return summary
    finally:
        fh = getattr(adata, "file", None)
        if fh is not None:
            try:
                fh.close()
            except Exception:
                pass
