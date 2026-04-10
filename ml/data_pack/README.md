# Spatial data pack (10x, Stereo-seq, Dryad MERFISH)

Curate downloads separately (licenses / registration). Use this pack to **normalize metadata** and convert everything to **AnnData `.h5ad`** before training.

## Recommended first downloads

### 10x Genomics (train / validate — start here)

1. **Visium human breast cancer** (tumor microenvironment) — search [10x datasets](https://www.10xgenomics.com/resources/datasets) for Visium breast; download `filtered_feature_bc_matrix`, `spatial/` folder, and high-res image.
2. **Visium human or mouse brain** — clear anatomical domains for niche benchmarking.

Per dataset, keep: matrix, `spatial/tissue_positions*.csv`, `scalefactors_json.json`, `tissue_hires_image.png` (or equivalent).

### Stereo-seq (cns.lifetech — out-of-distribution test)

- **Mouse brain** Stereo-seq showcase datasets (high resolution). Use after 10x pipeline is stable. Download expression + cell/bin coordinates + any region labels.

### Dryad (MERFISH — technology transfer)

- Search [Dryad](https://datadryad.org) for MERFISH + **gene panel manifest** + cell/spot annotations. Use as **held-out** technology transfer, not primary training, until panel harmonization is implemented.

## Files in this folder

| File | Purpose |
|------|---------|
| `datasets.yaml` | Human-readable registry of cohorts, URLs, and suggested use (train/OOD/test) |
| `convert_visium_to_h5ad.py` | Example script stub — point `visium_out` at Space Ranger `outs/` and run to emit `sample.h5ad` with `obsm['spatial']` |

## Harmonization checklist

- Map genes to stable `feature_id` (Ensembl) and `gene_symbol` in `adata.var`.
- Store `obs`: `sample_id`, `slide_id`, `platform` (`10x_visium` | `stereo_seq` | `merfish`), `cohort`, optional `region_label`.
- Split by **slide / patient**, never by random spots.
