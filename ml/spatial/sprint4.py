"""Sprint 4: Cross-platform benchmark summary + failure cases (synthetic or data-informed)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from ml.spatial.h5ad_load import h5ad_metadata_summary


def run(
    platform_train: str = "10x_visium",
    platform_test: str = "stereo_seq",
    in_domain_f1: float = 0.82,
    ood_f1: float = 0.61,
    train_h5ad_path: Optional[str] = None,
    test_h5ad_path: Optional[str] = None,
) -> Dict[str, Any]:
    rng = np.random.default_rng(99)
    n_fail = 40

    cohort_summary: Dict[str, Any] = {}
    for key, p in (("train", train_h5ad_path), ("test", test_h5ad_path)):
        if not p:
            continue
        pp = Path(p)
        if not pp.is_file():
            cohort_summary[key] = {"path": str(pp.expanduser().resolve()), "error": "file_not_found"}
            continue
        try:
            cohort_summary[key] = h5ad_metadata_summary(pp)
        except Exception as exc:  # noqa: BLE001
            cohort_summary[key] = {"path": str(pp.resolve()), "error": str(exc)}

    inferred_train = platform_train
    inferred_test = platform_test
    tc_tr = cohort_summary.get("train", {}).get("platform_counts") or {}
    tc_te = cohort_summary.get("test", {}).get("platform_counts") or {}
    if len(tc_tr) == 1:
        inferred_train = next(iter(tc_tr.keys()))
    if len(tc_te) == 1:
        inferred_test = next(iter(tc_te.keys()))

    return {
        "benchmark_metrics": {
            "in_domain": {"f1": in_domain_f1, "accuracy": in_domain_f1 * 0.97, "auroc": 0.88},
            "out_of_domain": {"f1": ood_f1, "accuracy": ood_f1 * 0.95, "auroc": 0.72},
            "platform_train_inferred": inferred_train,
            "platform_test_inferred": inferred_test,
            "platform_train": platform_train,
            "platform_test": platform_test,
        },
        "cohort_summary": cohort_summary,
        "shift_report": {
            "delta_f1": round(in_domain_f1 - ood_f1, 3),
            "by_tissue": {"breast": 0.64, "brain": 0.58},
            "by_batch": {"batch_A": 0.71, "batch_B": 0.55},
            "note": "Synthetic tissue/batch breakdown unless you wire real evaluation scores from training jobs.",
        },
        "failure_cases": [
            {
                "spot_id": f"low_conf_{i}",
                "predicted": "Epithelial",
                "true_label": "CAF",
                "confidence": float(rng.uniform(0.35, 0.52)),
            }
            for i in range(n_fail)
        ],
    }
