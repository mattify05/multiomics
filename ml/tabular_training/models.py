from __future__ import annotations

from typing import Any

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier


def build_estimator(model_name: str, random_state: int) -> Any:
    """Map UI model catalogue names to sklearn estimators with sensible defaults."""
    name = (model_name or "").lower()
    if "xgboost" in name or "lightgbm" in name:
        try:
            from xgboost import XGBClassifier  # type: ignore[import-not-found]

            return XGBClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.9,
                random_state=random_state,
                eval_metric="logloss",
            )
        except ImportError:
            pass
    if "random forest" in name or name == "random_forest":
        return RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            random_state=random_state,
            class_weight="balanced_subsample",
        )
    if "mlp" in name or "late fusion" in name:
        return MLPClassifier(
            hidden_layer_sizes=(128, 64),
            max_iter=300,
            random_state=random_state,
            early_stopping=True,
        )
    # Default: XGBoost catalogue entry and everything else
    return LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=random_state,
        solver="saga",
        n_jobs=-1,
    )
