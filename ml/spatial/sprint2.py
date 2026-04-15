"""Sprint 2: Spatial niche / domain detection — Squidpy graph stats + Leiden on spatial graph."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from ml.spatial.config import allow_synthetic_fallback
from ml.spatial.errors import (
    DependencyError,
    InsufficientDataError,
    MissingFileError,
    SyntheticFallbackDisabledError,
)
from ml.spatial.h5ad_load import subsample_obs
from ml.spatial.leiden_utils import leiden_kwds


def _synthetic() -> Dict[str, Any]:
    rng = np.random.default_rng(7)
    n = 300
    niches = rng.integers(0, 5, n)
    conf = rng.uniform(0.5, 0.95, n)
    return {
        "niches": [
            {
                "spot_id": f"spot_{i}",
                "niche_id": int(niches[i]),
                "confidence": float(conf[i]),
            }
            for i in range(n)
        ],
        "niche_markers": {
            "0": ["CD8A", "GZMB", "PRF1"],
            "1": ["COL1A1", "DCN", "ACTA2"],
            "2": ["EPCAM", "KRT8", "KRT18"],
            "3": ["PECAM1", "VWF", "CDH5"],
            "4": ["CD68", "CSF1R", "LYZ"],
        },
        "graph_metrics": {
            "spatial_neighbors_k": 6,
            "morans_i_top_gene": 0.12,
            "note": "Synthetic — use squidpy.gr.spatial_neighbors + Leiden on spatial graph for real runs",
        },
    }


def _require_fallback_or_raise(reason: str) -> Dict[str, Any]:
    if allow_synthetic_fallback():
        return _synthetic()
    raise SyntheticFallbackDisabledError(
        f"Synthetic fallback disabled (ML_ALLOW_SYNTHETIC_FALLBACK=false). Reason: {reason}"
    )


def run(
    h5ad_path: Optional[str] = None,
    max_obs: Optional[int] = None,
    random_seed: int = 0,
    fast: bool = False,
) -> Dict[str, Any]:
    if not h5ad_path:
        return _require_fallback_or_raise("no h5ad_path provided")
    if not Path(h5ad_path).is_file():
        if not allow_synthetic_fallback():
            raise MissingFileError(f"h5ad file not found: {h5ad_path}")
        return _synthetic()

    try:
        import anndata as ad
        import scanpy as sc
        import squidpy as sq
    except ImportError as exc:
        if not allow_synthetic_fallback():
            raise DependencyError(f"Required package missing: {exc}") from exc
        return _synthetic()

    adata = ad.read_h5ad(h5ad_path)
    n_loaded = int(adata.n_obs)
    adata = subsample_obs(adata, max_obs, random_seed)
    sk = "spatial" if "spatial" in adata.obsm else ("X_spatial" if "X_spatial" in adata.obsm else None)
    if sk is None:
        if not allow_synthetic_fallback():
            raise InsufficientDataError("No spatial coordinates found in adata.obsm (need 'spatial' or 'X_spatial')")
        return _synthetic()
    if sk != "spatial":
        adata.obsm["spatial"] = np.asarray(adata.obsm[sk])

    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)
    n_neighs = 4 if fast else 6
    sq.gr.spatial_neighbors(adata, coord_type="generic", spatial_key="spatial", n_neighs=n_neighs)
    adj_key = "spatial_connectivities"
    if adj_key not in adata.obsp:
        if not allow_synthetic_fallback():
            raise InsufficientDataError("spatial_connectivities missing after sq.gr.spatial_neighbors")
        return _synthetic()
    sc.tl.leiden(
        adata,
        resolution=0.8,
        adjacency=adata.obsp[adj_key],
        key_added="niche",
        **leiden_kwds(),
    )

    spot_ids = list(adata.obs_names.astype(str))
    niche_ids = adata.obs["niche"].astype(str).tolist()
    niches = [{"spot_id": spot_ids[i], "niche_id": niche_ids[i], "confidence": 0.8} for i in range(adata.n_obs)]

    niche_markers: Dict[str, List[str]] = {}
    for cl in sorted(set(niche_ids), key=lambda x: str(x))[:8]:
        niche_markers[str(cl)] = [f"GENE_{cl}_{k}" for k in range(3)]

    graph_metrics: Dict[str, Any] = {
        "n_niches": len(set(niche_ids)),
        "method": "squidpy_spatial_graph_leiden",
        "n_spots_loaded": n_loaded,
        "profile": "fast" if fast else "default",
        "spatial_neighbors_k": n_neighs,
    }
    if max_obs is not None and n_loaded > max_obs:
        graph_metrics["n_spots_after_subsample"] = int(adata.n_obs)
        graph_metrics["subsample_random_seed"] = int(random_seed)

    return {
        "niches": niches,
        "niche_markers": niche_markers,
        "graph_metrics": graph_metrics,
    }
