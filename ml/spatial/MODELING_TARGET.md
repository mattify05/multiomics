# Spatial modeling target — decision checklist

Training is undefined until you fix **what** you predict, **from what inputs**, and **how you split** data. Use this doc as a living spec; link cohort IDs from [`ml/data_pack/datasets.yaml`](../data_pack/datasets.yaml).

## 1. Primary scientific goal (pick one lead; others can be secondary)

| Track | Predict | Typical labels | Notes |
|-------|---------|----------------|--------|
| **A. Niche / domain (MVP)** | Spatial domain or niche ID per bin | `niche_pseudo` (Sprint 2 graph Leiden), later `niche_ref` (pathologist / manual regions) | Matches [`ml/spatial/sprint2.py`](sprint2.py): spatial graph + Leiden in `obs["niche"]`. Supervised learning keys off one categorical `obs` column (see §2). |
| **B. Cell-type deconvolution (secondary / later)** | Cell-type proportions or dominant type per bin | scRNA reference + RCTD / SPOTlight-style targets | Needs reference `h5ad` + harmonized `var_names`; [`ml/spatial/sprint3.py`](sprint3.py) is a kNN sketch only. If you adopt Track B, add **MAE / JS divergence** metrics in §4 alongside Track A. |
| **C. Domain generalization (optional)** | Same label under train platform → test platform | Platform / lab / tissue tags | Use when benchmarking OOD slides (e.g. registry `stereo_seq_mouse_brain` vs `tenx_visium_hd`). |

**Our lead track:** **A — niche / domain** (bins classified or clustered into niches).

---

## 2. Labels — source of truth

- **Label key in `adata.obs` (required for supervised / eval):**
  - **Interim (dev / UI):** `niche_pseudo` — copy from Sprint 2 output: after `sq.gr.spatial_neighbors` + `sc.tl.leiden(..., key_added="niche")`, persist `adata.obs["niche_pseudo"] = adata.obs["niche"].astype(str)` (or run pipeline once and save `h5ad`).
  - **Target (production):** `niche_ref` — pathologist or curated region labels (string or categorical). Replace or join with `niche_pseudo` when available.
- **Who / what produced labels:** Interim: **“Sprint 2 spatial Leiden v1 — resolution 0.8, `profile=default` or `fast`, Squidpy `spatial_neighbors` generic coords”**. Production: document paper / annotator version (e.g. “pathologist polygons v1 → bin vote”).
- **Granularity:** **bin** (Visium HD `square_*um` bin; same unit as `obs_names` / matrix rows).
- **Known issues (imbalance, noise, batch):** e.g. rare niches → report per-class support; batch by **slide** and chemistry if multi-cohort; document here when known.

---

## 3. Inputs and leakage-safe splits

- **Unit of split (required):** **Slide** (`adata.obs["slide_id"]` or agreed ID) — **not** random bins from the same slide.
- **Train / val / test slide IDs (template):** When you have multiple physical slides, assign explicitly, e.g. **Train:** `{VISIUM_HD_001, VISIUM_HD_002}`; **Val:** `{VISIUM_HD_003}`; **Test:** `{VISIUM_HD_004}`. Never put bins from one slide in two splits. For **single-slide** studies: train/val/test must be **spatial blocks** or **time-split** proxies — document that limitation; do not claim cross-slide generalization.
- **Example slide / file (current dev pipeline):** After [`ml/data_pack/build_dev_h5ad.sh`](../data_pack/build_dev_h5ad.sh) on `square_016um`, the converter sets **`sample_id` = folder name** (e.g. `square_016um`) and **`slide_id` = parent folder name** (e.g. `binned_outputs`) per [`visium_hd_square_to_h5ad.py`](../data_pack/visium_hd_square_to_h5ad.py). Use your **Space Ranger–level** `sample_id` / `slide_id` when re-running the converter with `--sample-id` / `--slide-id` so splits match biology, not folder names.
- **Gene space:** **HGNC gene symbols** in `var_names` for current Visium HD path (`read_10x_mtx` + `gene_symbols`). For cross-technology or Ensembl keys, add a `adata.var` column `feature_id` and a short mapping note here.

---

## 4. Success metrics

- **Primary (Track A — niche / domain):** **Macro-F1** over held-out bins (or **balanced accuracy** if class counts are very skewed). Optional: **ARI** between `niche_pseudo` and `niche_ref` when both exist (weak ref quality).
- **Secondary:** spatial coherence of predictions; **Moran’s I** on residuals vs null; subgroup fairness by `slide_id` or region.
- **If Track B is added later:** primary there becomes **MAE** or **Jensen–Shannon** on proportion vectors vs reference; keep Track A metrics separate.

---

## 5. Relationship to current repo capabilities

- **Sprint 1–2:** QC, UMAP/Leiden, spatial-graph niches — baselines and features, not end-to-end DL training.
- **Sprint 3:** kNN transfer in PCA space — quick probe for label/ref compatibility (Track B oriented).
- **New training code:** expected for serious models (PyTorch / Lightning, etc.); this file only scopes the **problem**.

---

## 6. Decisions (filled for development; revise when data grows)

1. **Which track A/B/C is MVP?** **Track A** (niche/domain).
2. **Where do ground-truth labels live (column + example)?** **Interim:** `adata.obs["niche_pseudo"]` (from Sprint 2). **Example:** dev object `ml/data_pack/local/square_016um_dev.h5ad` — inspect `obs["sample_id"]`, `obs["slide_id"]`, and after a Sprint 2 run, `obs["niche"]` / copied `niche_pseudo`. **Production:** `adata.obs["niche_ref"]` once annotations exist.
3. **Minimum slides per split (credibility vs dev speed):** **Dev / plumbing:** 1 slide is OK. **Any generalization claim:** aim for **≥3 slides train**, **≥1 val**, **≥1 test**; publication-style work typically needs more — document actual counts in experiment READMEs.
4. **Inference online (API) or batch (HPC)?** **Online** — FastAPI spatial routes + optional `profile=fast` / `max_obs` for latency (see [`PERFORMANCE.md`](PERFORMANCE.md)).

**Supervised training** that reports Macro-F1 on `niche_ref` is in scope once `niche_ref` (or agreed proxy) and slide splits are fixed. **Tabular / TCGA** training remains separate under `ml/tabular_training/` and `ml/train_tcga_purity.py`.
