#!/usr/bin/env python3
"""
Convert 10x Visium Space Ranger `outs/` to a minimal AnnData .h5ad for the spatial API.

Requires: scanpy, squidpy (optional for reading)

Example:
  python ml/data_pack/convert_visium_to_h5ad.py \\
    --visium-dir /path/to/spatial/outs \\
    --output /path/to/sample.h5ad

If `scanpy.read_visium` is unavailable, install scanpy>=1.9.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--visium-dir", type=str, required=True, help="Path to Space Ranger outs/ directory")
    parser.add_argument("--output", type=str, required=True, help="Output .h5ad path")
    args = parser.parse_args()

    import scanpy as sc

    p = Path(args.visium_dir)
    adata = sc.read_visium(path=p)
    adata.write_h5ad(args.output)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
