# Spatial data pack (10x, Stereo-seq, Dryad MERFISH)

Curate downloads separately (licenses / registration). Use this pack to **normalize metadata** and convert everything to **AnnData `.h5ad`** before training.

## Recommended first downloads

### 10x Genomics (train / validate — start here)

1. **Visium human breast cancer** (tumor microenvironment) — search [10x datasets](https://www.10xgenomics.com/resources/datasets) for Visium breast; download `filtered_feature_bc_matrix`, `spatial/` folder, and high-res image.
2. **Visium human or mouse brain** — clear anatomical domains for niche benchmarking.

Per dataset, keep: matrix, spatial coordinates (`spatial/tissue_positions_list.csv` for classic Visium, or **`spatial/tissue_positions.parquet`** for Visium HD), `scalefactors_json.json`, `tissue_hires_image.png` (or equivalent).

### Stereo-seq (cns.lifetech — out-of-distribution test)

- **Mouse brain** Stereo-seq showcase datasets (high resolution). Use after 10x pipeline is stable. Download expression + cell/bin coordinates + any region labels.

### Dryad (MERFISH — technology transfer)

- Search [Dryad](https://datadryad.org) for MERFISH + **gene panel manifest** + cell/spot annotations. Use as **held-out** technology transfer, not primary training, until panel harmonization is implemented.

## Files in this folder

| File | Purpose |
|------|---------|
| `datasets.yaml` | Human-readable registry of cohorts, URLs, and suggested use (train/OOD/test) |
| `convert_visium_to_h5ad.py` | Example script stub — point `visium_out` at Space Ranger `outs/` and run to emit `sample.h5ad` with `obsm['spatial']` |
| `visium_hd_square_to_h5ad.py` | **Visium HD** `binned_outputs/square_*um/`: MTX + Parquet join; `obsm['spatial']` = `(pxl_col_in_fullres, pxl_row_in_fullres)`; `uns['spatial'][library_id]` with **nested** `scalefactors` + optional `images` (Scanpy-compatible); sets `obs`: `sample_id`, `slide_id`, `platform` |
| `local/` | Default location for large `.h5ad` outputs (**only `*.h5ad` gitignored**); see `local/README.md` |
| `make_synthetic_spatial_h5ad.py` | Small spatial `.h5ad` for dev/CI (no download) |
| `build_dev_h5ad.sh` | Wrapper: Visium HD → `local/{square}_dev.h5ad` with `--filter-in-tissue`, `--no-histology`, `--max-spots` |

### Dev workflow (stable path + validation)

1. **Synthetic** (always available): `python ml/data_pack/make_synthetic_spatial_h5ad.py` → `ml/data_pack/local/synthetic_spatial_dev.h5ad`
2. **Real Visium HD (recommended dev settings):** coarser bin (`square_016um`) + `./ml/data_pack/build_dev_h5ad.sh "/path/to/square_016um" 50000 0`
3. **Validate Sprints 1–2:** `python ml/spatial/validate_sprint_stack.py --h5ad-path … --max-obs …` (see `ml/spatial/PERFORMANCE.md`)
4. **Define training scope:** edit `ml/spatial/MODELING_TARGET.md` (task, labels, splits)

**Visium HD example** (`PYTHONPATH` = repo root, venv activated):

```bash
export PYTHONPATH="${PWD}"
python ml/data_pack/visium_hd_square_to_h5ad.py \
  --square-dir "/path/to/extracted/binned_outputs/square_008um" \
  --output "ml/data_pack/local/square_008um.h5ad" \
  --cohort-id "my_cohort" \
  --library-id spatial
```

Useful flags: `--filter-in-tissue`, `--no-histology` (skip H&E PNG load), `--max-spots N` + `--random-seed` (subsample after full MTX load — see `ml/spatial/PERFORMANCE.md`). For faster iteration, prefer **`square_016um`** or API **`max_obs`** instead of the full 008µm grid.

Registry: cohort `tenx_visium_hd` in `datasets.yaml`.

## Harmonization checklist

- Map genes to stable `feature_id` (Ensembl) and `gene_symbol` in `adata.var`.
- Store `obs`: `sample_id`, `slide_id`, `platform` (`10x_visium` | `10x_visium_hd` | `stereo_seq` | `merfish`), optional `cohort_id`, optional `region_label`.
- Split by **slide / patient**, never by random spots.
