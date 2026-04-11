# Spatial pipelines — performance and optimization

Visium HD at **8 µm** can reach **hundreds of thousands of spots** and **multi‑GB** `.h5ad` files. The default Sprint 1–2 paths (PCA, kNN graph, UMAP, Squidpy spatial neighbors) scale superlinearly in spots and can exhaust RAM on a laptop.

## What this repo already does

1. **API subsampling** — `POST /run/spatial/qc-annotation` and `/run/spatial/niches` accept `max_obs` and `random_seed` to subsample **after** full load (same as Sprint 3 `spatial_max_obs` for the spatial side only).
2. **Converter** — `visium_hd_square_to_h5ad.py` supports `--max-spots` (same caveat: full MTX is still read first).
3. **Benchmark metadata** — Sprint 4 can attach `cohort_summary` from `.h5ad` using **backed** reads (`h5ad_metadata_summary`) to avoid loading `X`.

## Recommended strategies (pick one or combine)

| Strategy | Effect |
|----------|--------|
| **`square_016um`** (or coarser) | Fewer bins → smaller matrix and graphs for the same tissue area. |
| **`max_obs` / `--max-spots`** | Caps spots for dev, UI, and CI; document the seed for reproducibility. |
| **`--filter-in-tissue`** | Drops off‑tissue bins when you only care about tissue spots. |
| **Pre‑subset before sharing** | Write a smaller `.h5ad` once on a large machine, point the API at that file. |
| **Stronger worker** | More RAM + CPU for production runs without subsampling. |

## Memory caveat: subsampling order

Subsample helpers run **after** `read_h5ad` / `read_10x_mtx`. Peak memory is still dominated by the **full** object unless you build a smaller file upstream (coarser binning, Space Ranger subset, or custom row‑subset MTX export).

## Future optimizations (not implemented here)

- **Backed AnnData** for QC steps that only need slices of `X` (requires pipeline refactor).
- **Approximate neighbors** (e.g. `pynndescent`, HNSW) or **PCA‑only** maps without UMAP for very large `n_obs`.
- **Chunked / out‑of‑core** normalization and HVG selection.
- **GPU** (RAPIDS / cuGraph) for neighbors and UMAP in a dedicated environment.

## Plotting

Nested `adata.uns['spatial'][library_id]` with **hires** images is convenient for `scanpy.pl.spatial` but **loading full‑resolution PNGs** increases memory. Use `--no-histology` when you only need coordinates and scale factors.

## Validating Sprint 1 → 2 (timing + memory)

From the **repo root**, with `ml/requirements-spatial.txt` installed and `PYTHONPATH` set:

```bash
export PYTHONPATH="${PWD}"
python ml/data_pack/make_synthetic_spatial_h5ad.py
python ml/spatial/validate_sprint_stack.py --h5ad-path ml/data_pack/local/synthetic_spatial_dev.h5ad --max-obs 500
```

For **real** slides, build a dev `.h5ad` under `ml/data_pack/local/` (see `ml/data_pack/local/README.md` and `build_dev_h5ad.sh`), then:

```bash
python ml/spatial/validate_sprint_stack.py \
  --h5ad-path ml/data_pack/local/square_016um_dev.h5ad \
  --max-obs 25000 \
  --random-seed 0
```

The script prints JSON with `sprint1_seconds`, `sprint2_seconds`, `rss_before_bytes`, `rss_after_bytes` (approximate; on Linux `rss` is derived from `ru_maxrss`). **Record your machine RAM, CPU, and file `n_obs` here when you benchmark a real slide:**

| Date | Machine | n_obs (file) | max_obs | Sprint 1 s | Sprint 2 s | Peak RSS note |
|------|---------|----------------|---------|------------|------------|----------------|
| _fill in_ | | | | | | |

Optional **HTTP** mode (same body as the API; path must be **absolute** on the worker host):

```bash
python ml/spatial/validate_sprint_stack.py \
  --api-url http://127.0.0.1:8787 \
  --h5ad-path "$(pwd)/ml/data_pack/local/synthetic_spatial_dev.h5ad" \
  --max-obs 500
```

**Dependencies:** install `ml/requirements-spatial.txt` (includes **`leidenalg`** for `scanpy.tl.leiden`). If validation exits with code **3**, the sprints fell back to **synthetic** artifacts — usually missing `leidenalg` or a broken Squidpy import (some CI sandboxes block `sysctl` / `psutil`; run the validator on a normal shell or worker VM).

**Example (synthetic dev file, laptop):** ~8 s total, ~550 MB RSS after run (order-of-magnitude; varies by CPU and Scanpy build). Fill the table above with your **real** slide numbers.

## Modeling scope (before “training”)

Fill in [`MODELING_TARGET.md`](MODELING_TARGET.md) so the prediction task, label column, and slide-level splits are explicit.

