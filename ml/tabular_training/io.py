from __future__ import annotations

import io
from pathlib import Path
from typing import Tuple

import pandas as pd

from ml.tabular_training.spec import SUPPORTED_EXTENSIONS


def load_feature_table(path: str | Path, content: bytes | None = None) -> pd.DataFrame:
    """Load parquet or delimiter-separated table from disk or bytes."""
    p = Path(path)
    suffix = p.suffix.lower()
    if content is not None:
        if suffix == ".parquet":
            return pd.read_parquet(io.BytesIO(content))
        sep = "\t" if suffix in (".tsv", ".txt") else ","
        return pd.read_csv(io.BytesIO(content), sep=sep)

    if not p.is_file():
        raise FileNotFoundError(f"Dataset file not found: {p}")
    if suffix == ".parquet":
        return pd.read_parquet(p)
    sep = "\t" if suffix in (".tsv", ".txt") else ","
    return pd.read_csv(p, sep=sep)


def ensure_sample_id_index(df: pd.DataFrame) -> pd.DataFrame:
    """Use ``sample_id`` column as index if present; otherwise keep existing index."""
    out = df.copy()
    if "sample_id" in out.columns:
        out = out.set_index("sample_id", drop=True)
    elif out.index.name != "sample_id" and out.index.dtype == "object":
        out.index.name = out.index.name or "sample_id"
    return out


def feature_label_split(
    df: pd.DataFrame,
    label_column: str,
    patient_id_column: str | None,
) -> Tuple[pd.DataFrame, pd.Series, pd.Series | None]:
    """
    Split frame into X, y, and optional groups (patient ids aligned to X index).
    Drops non-numeric / reserved columns from X.
    ``df`` must be a table with one row per sample (use ``reset_index()`` if ``sample_id`` is the index).
    """
    if label_column not in df.columns:
        raise KeyError(f"Label column {label_column!r} not in table columns: {list(df.columns)[:20]}...")

    y = df[label_column].copy()
    drop_cols = {label_column}
    if patient_id_column and patient_id_column in df.columns:
        drop_cols.add(patient_id_column)
    for c in ("sample_id", "index"):
        if c in df.columns:
            drop_cols.add(c)

    X = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")
    # Drop object columns that are not numeric features
    numeric = X.select_dtypes(include=["number", "bool"]).copy()
    for c in X.columns:
        if c not in numeric.columns and X[c].dtype == object:
            try:
                numeric[c] = pd.to_numeric(X[c], errors="coerce")
            except Exception:
                pass
    X = numeric.fillna(0.0)

    groups = None
    if patient_id_column and patient_id_column in df.columns:
        groups = df[patient_id_column].astype(str).loc[X.index]

    return X, y, groups
