"""
Tabular multi-omics clinical-outcome training — data contract (MVP).

Expected uploaded file (parquet or CSV) registered in ``datasets.file_path``:

- **One row per analytical sample** (e.g. tumor sample, biopsy aliquot). A column or index
  ``sample_id`` identifies the row; if the index is unnamed, the first column ``sample_id``
  is used when present.
- **Numeric feature columns** — all other columns except reserved columns are treated as
  features (float-converted where possible).
- **Label column** — name supplied in experiment ``hyperparameters.label_column`` (same as
  UI ``target_variable``). Binary 0/1 or string class labels.
- **Optional ``patient_id`` column** — name supplied in ``hyperparameters.patient_id_column``.
  When set, train/test split uses ``GroupShuffleSplit`` so no patient appears in both sets.

Reserved column names (excluded from features if present): ``sample_id``, ``patient_id``
(when used as grouping key only — if you use a different name, list it in
``patient_id_column`` and that column is excluded from features).

Split: ``hyperparameters.train_test_split`` as ``"80/20"`` (train+val / test) for MVP;
an 80/10/10 scheme uses first split 80% trainval / 20% test then 10/90 of trainval for val
when ``use_validation_slice`` is true (optional future).

Model names from the UI are mapped in ``ml.tabular_training.models``.
"""

from __future__ import annotations

# Default object storage bucket for dataset files (matches Supabase migrations).
OMICS_DATA_BUCKET = "omics-data"

# Hyperparameter keys written by the edge orchestrator / UI.
HP_LABEL_COLUMN = "label_column"
HP_TARGET_VARIABLE = "target_variable"
HP_PATIENT_ID_COLUMN = "patient_id_column"
HP_TRAIN_TEST_SPLIT = "train_test_split"
HP_STRATIFY = "stratify"
HP_DATASET_IDS = "dataset_ids"
HP_SEED = "seed"

SUPPORTED_EXTENSIONS = (".parquet", ".csv", ".tsv")
