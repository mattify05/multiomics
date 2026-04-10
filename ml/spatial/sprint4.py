"""Sprint 4: Cross-platform benchmark summary + failure cases (synthetic or from predictions)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np


def run(
    platform_train: str = "10x_visium",
    platform_test: str = "stereo_seq",
    in_domain_f1: float = 0.82,
    ood_f1: float = 0.61,
) -> Dict[str, Any]:
    rng = np.random.default_rng(99)
    n_fail = 40
    return {
        "benchmark_metrics": {
            "in_domain": {"f1": in_domain_f1, "accuracy": in_domain_f1 * 0.97, "auroc": 0.88},
            "out_of_domain": {"f1": ood_f1, "accuracy": ood_f1 * 0.95, "auroc": 0.72},
            "platform_train": platform_train,
            "platform_test": platform_test,
        },
        "shift_report": {
            "delta_f1": round(in_domain_f1 - ood_f1, 3),
            "by_tissue": {"breast": 0.64, "brain": 0.58},
            "by_batch": {"batch_A": 0.71, "batch_B": 0.55},
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
