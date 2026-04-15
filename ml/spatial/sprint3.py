"""Sprint 3: Label transfer from reference scRNA (kNN in PCA space — simplified)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

from ml.spatial.config import allow_synthetic_fallback
from ml.spatial.errors import (
    DependencyError,
    InsufficientSharedGenesError,
    MissingFileError,
    MissingLabelColumnError,
    SyntheticFallbackDisabledError,
)
from ml.spatial.h5ad_load import subsample_obs


def _synthetic() -> Dict[str, Any]:
    rng = np.random.default_rng(11)
    n = 250
    types = ["T_cell", "B_cell", "Macrophage", "Epithelial", "Fibroblast"]
    labels = [types[int(rng.integers(0, len(types)))] for _ in range(n)]
    unc = rng.uniform(0.02, 0.35, n)
    return {
        "label_transfer": [
            {
                "spot_id": f"spot_{i}",
                "transferred_label": labels[i],
                "uncertainty": float(unc[i]),
            }
            for i in range(n)
        ],
        "integration_qc": {
            "n_shared_genes": 15000,
            "mean_confidence": float(1.0 - np.mean(unc)),
            "per_class_coverage": {t: float(labels.count(t) / n) for t in types},
        },
        "celltype_composition": [
            {"region": "core", "T_cell": 0.2, "B_cell": 0.05, "Macrophage": 0.15, "Epithelial": 0.45, "Fibroblast": 0.15},
            {"region": "margin", "T_cell": 0.35, "B_cell": 0.1, "Macrophage": 0.2, "Epithelial": 0.2, "Fibroblast": 0.15},
        ],
    }


def _require_fallback_or_raise(reason: str) -> Dict[str, Any]:
    if allow_synthetic_fallback():
        return _synthetic()
    raise SyntheticFallbackDisabledError(
        f"Synthetic fallback disabled (ML_ALLOW_SYNTHETIC_FALLBACK=false). Reason: {reason}"
    )


def run(
    spatial_h5ad: Optional[str] = None,
    reference_h5ad: Optional[str] = None,
    ref_label_key: str = "cell_type",
    spatial_max_obs: Optional[int] = None,
    spatial_random_seed: int = 0,
    min_shared_genes: int = 500,
) -> Dict[str, Any]:
    if not spatial_h5ad or not Path(spatial_h5ad).is_file():
        if spatial_h5ad and not Path(spatial_h5ad).is_file() and not allow_synthetic_fallback():
            raise MissingFileError(f"spatial h5ad not found: {spatial_h5ad}")
        return _require_fallback_or_raise("spatial_h5ad not provided or not found")
    if not reference_h5ad or not Path(reference_h5ad).is_file():
        if reference_h5ad and not Path(reference_h5ad).is_file() and not allow_synthetic_fallback():
            raise MissingFileError(f"reference h5ad not found: {reference_h5ad}")
        return _require_fallback_or_raise("reference_h5ad not provided or not found")

    try:
        import anndata as ad
        import scanpy as sc
        from sklearn.neighbors import KNeighborsClassifier
    except ImportError as exc:
        if not allow_synthetic_fallback():
            raise DependencyError(f"Required package missing: {exc}") from exc
        return _synthetic()

    sp = ad.read_h5ad(spatial_h5ad)
    n_spatial_loaded = int(sp.n_obs)
    sp = subsample_obs(sp, spatial_max_obs, spatial_random_seed)
    ref = ad.read_h5ad(reference_h5ad)
    if ref_label_key not in ref.obs.columns:
        avail = ", ".join(sorted(map(str, ref.obs.columns))) or "(none)"
        raise MissingLabelColumnError(
            f"reference AnnData missing obs column {ref_label_key!r}. Available: {avail}"
        )

    common = list(set(sp.var_names) & set(ref.var_names))
    if len(common) < min_shared_genes:
        raise InsufficientSharedGenesError(
            f"Only {len(common)} shared genes between spatial and reference; need >= {min_shared_genes}. "
            "Check gene symbols / Ensembl IDs and harmonize var_names."
        )

    sp_sub = sp[:, common].copy()
    ref_sub = ref[:, common].copy()
    sc.pp.normalize_total(ref_sub, target_sum=1e4)
    sc.pp.log1p(ref_sub)
    sc.pp.scale(ref_sub, max_value=10)
    sc.tl.pca(ref_sub, n_comps=30)

    sc.pp.normalize_total(sp_sub, target_sum=1e4)
    sc.pp.log1p(sp_sub)
    sc.pp.scale(sp_sub, max_value=10)
    sc.tl.pca(sp_sub, n_comps=30)

    X_ref = ref_sub.obsm["X_pca"]
    y_ref = ref_sub.obs[ref_label_key].astype(str).to_numpy()
    clf = KNeighborsClassifier(n_neighbors=5, weights="distance")
    clf.fit(X_ref, y_ref)
    X_sp = sp_sub.obsm["X_pca"]
    pred = clf.predict(X_sp)
    proba = clf.predict_proba(X_sp).max(axis=1)

    spot_ids = list(sp_sub.obs_names.astype(str))
    label_transfer = [
        {
            "spot_id": spot_ids[i],
            "transferred_label": str(pred[i]),
            "uncertainty": float(1.0 - proba[i]),
        }
        for i in range(len(spot_ids))
    ]

    uniq, counts = np.unique(pred, return_counts=True)
    coverage = {str(u): float(c) / len(pred) for u, c in zip(uniq, counts)}

    integration_qc: Dict[str, Any] = {
        "n_shared_genes": len(common),
        "mean_confidence": float(np.mean(proba)),
        "per_class_coverage": coverage,
        "n_spatial_loaded": n_spatial_loaded,
        "n_spatial_used": int(sp_sub.n_obs),
    }
    if spatial_max_obs is not None and n_spatial_loaded > spatial_max_obs:
        integration_qc["spatial_subsample_max_obs"] = int(spatial_max_obs)
        integration_qc["spatial_subsample_random_seed"] = int(spatial_random_seed)

    return {
        "label_transfer": label_transfer,
        "integration_qc": integration_qc,
        "celltype_composition": [
            {"region": "whole_slide", **{str(u): float(c) / len(pred) for u, c in zip(uniq, counts)}},
        ],
    }
