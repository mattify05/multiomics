#!/usr/bin/env python3
"""
Build AnnData from Visium HD Space Ranger `square_*um` output (Parquet positions + MTX counts).

Visium HD stores coordinates in spatial/tissue_positions.parquet (not tissue_positions_list.csv).
This script:
  - reads filtered_feature_bc_matrix/ (MTX + barcodes + features)
  - reads spatial/tissue_positions.parquet and joins on barcode
  - sets adata.obsm['spatial'] as [[pxl_col_in_fullres, pxl_row_in_fullres], ...] (x, y in fullres pixels)
  - sets adata.uns['spatial'][library_id] with scalefactors + optional H&E images (Scanpy-compatible)
  - optional harmonization columns on obs (sample_id, slide_id, cohort_id, platform)

Example:
  python ml/data_pack/visium_hd_square_to_h5ad.py \\
    --square-dir "/Users/you/.../extracted/binned_outputs/square_008um" \\
    --output "/path/outside/repo/square_008um.h5ad"
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import scanpy as sc

# Repo-root imports when PYTHONPATH is set to project root
from ml.data_pack.visium_hd_spatial_uns import build_nested_spatial_uns
from ml.spatial.h5ad_load import subsample_obs


def _read_positions_parquet(path: Path) -> pd.DataFrame:
    df = pd.read_parquet(path)
    required = {"barcode", "pxl_row_in_fullres", "pxl_col_in_fullres"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"tissue_positions.parquet missing columns: {missing}. Found: {list(df.columns)}")
    return df.set_index("barcode", verify_integrity=False)


def _infer_bin_um_from_dir(square_dir: Path) -> Optional[int]:
    m = re.search(r"square_(\d+)um", square_dir.name)
    return int(m.group(1)) if m else None


def build_anndata(
    square_dir: Path,
    filter_in_tissue: bool = False,
    sample_id: Optional[str] = None,
    slide_id: Optional[str] = None,
    cohort_id: Optional[str] = None,
    platform: str = "10x_visium_hd",
    library_id: str = "spatial",
    attach_histology: bool = True,
    max_spots: Optional[int] = None,
    random_seed: int = 0,
) -> sc.AnnData:
    mtx_dir = square_dir / "filtered_feature_bc_matrix"
    spatial_dir = square_dir / "spatial"
    parquet_path = spatial_dir / "tissue_positions.parquet"

    if not mtx_dir.is_dir():
        raise FileNotFoundError(f"Missing matrix dir: {mtx_dir}")
    if not parquet_path.is_file():
        raise FileNotFoundError(f"Missing {parquet_path} (Visium HD uses Parquet, not tissue_positions_list.csv)")

    adata = sc.read_10x_mtx(
        str(mtx_dir),
        var_names="gene_symbols",
        make_unique=True,
        cache=False,
        gex_only=False,
    )
    pos = _read_positions_parquet(parquet_path)

    aligned = pos.reindex(adata.obs_names)
    missing = aligned["pxl_row_in_fullres"].isna().sum()
    if missing:
        raise ValueError(f"{missing} barcodes in matrix missing from tissue_positions.parquet")

    spatial_xy = np.column_stack(
        [
            aligned["pxl_col_in_fullres"].to_numpy(dtype=float),
            aligned["pxl_row_in_fullres"].to_numpy(dtype=float),
        ]
    )
    adata.obsm["spatial"] = spatial_xy

    adata.uns["spatial"] = build_nested_spatial_uns(spatial_dir, library_id=library_id, attach_images=attach_histology)

    if "array_row" in aligned.columns:
        adata.obs["array_row"] = aligned["array_row"].values
    if "array_col" in aligned.columns:
        adata.obs["array_col"] = aligned["array_col"].values
    if "in_tissue" in aligned.columns:
        adata.obs["in_tissue"] = aligned["in_tissue"].values

    sid = sample_id or square_dir.name
    lid = slide_id or square_dir.parent.name
    adata.obs["sample_id"] = sid
    adata.obs["slide_id"] = lid
    if cohort_id is not None:
        adata.obs["cohort_id"] = cohort_id
    adata.obs["platform"] = platform

    bin_um = _infer_bin_um_from_dir(square_dir)
    adata.uns["visium_hd"] = {
        "source_square_dir": str(square_dir.resolve()),
        "spatial_columns": ["pxl_col_in_fullres", "pxl_row_in_fullres"],
        "library_id": library_id,
        "bin_um": bin_um,
        "note": "obsm['spatial'] is (x,y) full-resolution pixels matching 10x tissue_positions.parquet",
    }
    if cohort_id is not None:
        adata.uns["visium_hd"]["cohort_id"] = cohort_id

    if filter_in_tissue:
        if "in_tissue" not in adata.obs.columns:
            raise ValueError("--filter-in-tissue requires in_tissue in tissue_positions.parquet")
        mask = adata.obs["in_tissue"].astype(int) == 1
        adata = adata[mask].copy()

    if max_spots is not None and adata.n_obs > max_spots:
        print(
            f"Warning: subsampling {adata.n_obs} -> {max_spots} spots (seed={random_seed}); "
            "full matrix was loaded first — see ml/spatial/PERFORMANCE.md for memory tips.",
            file=sys.stderr,
        )
        adata = subsample_obs(adata, max_spots, random_seed)

    return adata


def main() -> None:
    parser = argparse.ArgumentParser(description="Visium HD square_*um → AnnData .h5ad")
    parser.add_argument(
        "--square-dir",
        type=str,
        required=True,
        help="Path to e.g. .../binned_outputs/square_008um (contains filtered_feature_bc_matrix/ and spatial/)",
    )
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output .h5ad path (use a directory outside git, e.g. ml/data_pack/local/ is gitignored)",
    )
    parser.add_argument(
        "--filter-in-tissue",
        action="store_true",
        help="Keep only spots with in_tissue==1 in the Parquet",
    )
    parser.add_argument("--sample-id", type=str, default=None, help="adata.obs['sample_id'] (default: square folder name)")
    parser.add_argument("--slide-id", type=str, default=None, help="adata.obs['slide_id'] (default: parent folder name)")
    parser.add_argument("--cohort-id", type=str, default=None, help="Optional adata.obs['cohort_id'] and uns['visium_hd']")
    parser.add_argument(
        "--platform",
        type=str,
        default="10x_visium_hd",
        help="adata.obs['platform'] (default: 10x_visium_hd)",
    )
    parser.add_argument(
        "--library-id",
        type=str,
        default="spatial",
        help="Key under uns['spatial'] for Scanpy spatial plots (default: spatial)",
    )
    parser.add_argument(
        "--no-histology",
        action="store_true",
        help="Do not load tissue_{hires,lowres}_image.png (only scalefactors in uns['spatial'])",
    )
    parser.add_argument(
        "--max-spots",
        type=int,
        default=None,
        help="Random subsample to N spots after build (full MTX still loaded — for smaller dev files)",
    )
    parser.add_argument("--random-seed", type=int, default=0, help="RNG seed for --max-spots")

    args = parser.parse_args()

    square_dir = Path(args.square_dir).expanduser().resolve()
    out_path = Path(args.output).expanduser().resolve()

    adata = build_anndata(
        square_dir,
        filter_in_tissue=args.filter_in_tissue,
        sample_id=args.sample_id,
        slide_id=args.slide_id,
        cohort_id=args.cohort_id,
        platform=args.platform,
        library_id=args.library_id,
        attach_histology=not args.no_histology,
        max_spots=args.max_spots,
        random_seed=args.random_seed,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    adata.write_h5ad(out_path)
    print(f"Wrote {out_path}  n_obs={adata.n_obs} n_vars={adata.n_vars}")
    print("obsm keys:", list(adata.obsm.keys()))
    lib = args.library_id
    if isinstance(adata.uns.get("spatial"), dict) and lib in adata.uns["spatial"]:
        slot = adata.uns["spatial"][lib]
        print("uns['spatial'][library_id] image keys:", list(slot.get("images", {}).keys()))
        print("uns['spatial'][library_id] scalefactor keys:", list(slot.get("scalefactors", {}).keys()))


if __name__ == "__main__":
    main()
