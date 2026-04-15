from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.feature_selection import f_classif
from sklearn.metrics import confusion_matrix, f1_score, roc_auc_score
from sklearn.preprocessing import LabelEncoder


def encode_labels(y: np.ndarray) -> Tuple[np.ndarray, LabelEncoder]:
    le = LabelEncoder()
    yy = le.fit_transform(y.astype(str))
    return yy, le


def evaluate_binary_or_multiclass(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None,
    le: LabelEncoder,
) -> Dict[str, Any]:
    n_classes = len(le.classes_)
    f1 = f1_score(y_true, y_pred, average="weighted" if n_classes > 2 else "binary")
    out: Dict[str, Any] = {"f1": float(f1), "n_classes": int(n_classes)}
    if n_classes == 2 and y_proba is not None:
        if y_proba.ndim == 2 and y_proba.shape[1] >= 2:
            pos = y_proba[:, 1]
        else:
            pos = y_proba
        try:
            out["auc"] = float(roc_auc_score(y_true, pos))
        except ValueError:
            out["auc"] = None
    elif y_proba is not None and n_classes > 2:
        try:
            out["auc"] = float(roc_auc_score(y_true, y_proba, multi_class="ovr", average="weighted"))
        except ValueError:
            out["auc"] = None
    else:
        out["auc"] = None

    cm = confusion_matrix(y_true, y_pred)
    out["confusion_matrix"] = cm.tolist()
    return out


def top_feature_scores(X: np.ndarray, y: np.ndarray, feature_names: List[str], k: int = 15) -> List[Dict[str, Any]]:
    """Univariate F-scores as a model-agnostic importance proxy for XAI-style tables."""
    Xf = np.nan_to_num(X.astype(float), nan=0.0, posinf=0.0, neginf=0.0)
    try:
        scores, _ = f_classif(Xf, y)
    except Exception:
        return [{"name": feature_names[i], "modality": "tabular", "importance": 0.0} for i in range(min(k, len(feature_names)))]
    order = np.argsort(-np.nan_to_num(scores, nan=0.0))[:k]
    top = []
    for i in order:
        if i < len(feature_names):
            top.append({"name": str(feature_names[i]), "modality": "tabular", "importance": float(max(scores[i], 0.0))})
    return top
