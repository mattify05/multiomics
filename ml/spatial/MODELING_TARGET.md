# Spatial modeling target — decision checklist

Training is undefined until you fix **what** you predict, **from what inputs**, and **how you split** data. Use this doc as a living spec; fill in the blanks and link cohort IDs from `ml/data_pack/datasets.yaml`.

## 1. Primary scientific goal (pick one lead; others can be secondary)

| Track | Predict | Typical labels | Notes |
|-------|---------|----------------|--------|
| **A. Niche / domain** | Spatial domain or “niche” ID per spot | Manual regions, Leiden-as-pseudo-label, pathologist polygons | Aligns with Sprint 2 graph niches as a baseline; supervised head needs agreed ontology. |
| **B. Cell-type deconvolution** | Cell type proportions or dominant type per spot | scRNA reference + RCTD / SPOTlight-style targets, or spot-level FISH | Needs **reference** `h5ad` with harmonized `var_names` (Sprint 3 is a kNN sketch, not full deconv). |
| **C. Domain generalization** | Same label under train platform → test platform | Platform / lab / tissue as domain tags | Needs **explicit OOD slides** (e.g. 10x train, Stereo-seq test per registry). |

**Our lead track (fill in):** _________________________________________________

## 2. Labels — source of truth

- **Label key in `adata.obs` (or external table):** _____________________________
- **Who / what produced labels (paper, pathologist, clustering, simulation):** _____________________________
- **Granularity:** spot / bin / cell / region polygon
- **Known issues (imbalance, noise, batch):** _____________________________

## 3. Inputs and leakage-safe splits

- **Unit of split (required):** slide, patient, or block — **not** random spots from the same slide.
- **Train / val / test slide IDs (or rule):** _____________________________
- **Gene space:** HGNC symbols vs Ensembl — document mapping for cross-technology runs.

## 4. Success metrics

- **Primary metric:** _____________________________ (e.g. macro-F1, MAE on proportions, calibration)
- **Secondary:** spatial coherence, Moran’s I of residuals, subgroup fairness

## 5. Relationship to current repo capabilities

- **Sprint 1–2:** QC, UMAP/Leiden, spatial-graph niches — baselines and features, not end-to-end DL training.
- **Sprint 3:** kNN transfer in PCA space — quick probe for label/ref compatibility.
- **New training code:** expected for serious models (PyTorch / Lightning, etc.); this file only scopes the **problem**.

## 6. Open decisions (need your input)

Reply to your team (or the implementer) with concrete answers:

1. Which **track A/B/C** is MVP?
2. Where do **ground-truth labels** live (column name + example slide)?
3. **Minimum** number of slides per split you consider credible?
4. Is **inference** online (API per slide) or batch (HPC)?

Until §6 is answered, treat “start training” as **out of scope** except for tabular clinical or TCGA pipelines elsewhere in `ml/`.
