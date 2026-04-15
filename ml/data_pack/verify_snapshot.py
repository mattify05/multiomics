#!/usr/bin/env python3
"""
Verify (or update) the pinned data snapshot checksums.

Usage:
  # Check all files match their recorded checksums:
  python ml/data_pack/verify_snapshot.py

  # Compute and write checksums + shape metadata back into the manifest:
  python ml/data_pack/verify_snapshot.py --update

  # Use a custom manifest path:
  python ml/data_pack/verify_snapshot.py --manifest ml/data_pack/data_snapshot.yaml

Exit codes:
  0  all OK (or --update succeeded)
  1  checksum mismatch / missing file
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from typing import Any, Dict, List

import yaml


def sha256_file(path: Path, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def h5ad_shape(path: Path) -> tuple[int, int]:
    import anndata as ad

    adata = ad.read_h5ad(path, backed="r")
    shape = (adata.n_obs, adata.n_vars)
    adata.file.close()
    return shape


def verify(manifest: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for entry in manifest.get("files", []):
        fid = entry.get("id", "?")
        rel = entry.get("path")
        expected_sha = entry.get("sha256")
        if not rel:
            errors.append(f"[{fid}] missing 'path'")
            continue
        p = Path(rel)
        if not p.is_file():
            errors.append(f"[{fid}] file not found: {rel}")
            continue
        if expected_sha is None:
            errors.append(f"[{fid}] sha256 is null — run with --update first")
            continue
        actual = sha256_file(p)
        if actual != expected_sha:
            errors.append(
                f"[{fid}] checksum mismatch: expected {expected_sha[:16]}… got {actual[:16]}…"
            )
    return errors


def update(manifest: Dict[str, Any]) -> int:
    updated = 0
    for entry in manifest.get("files", []):
        fid = entry.get("id", "?")
        rel = entry.get("path")
        if not rel:
            continue
        p = Path(rel)
        if not p.is_file():
            print(f"SKIP [{fid}] file not found: {rel}", file=sys.stderr)
            continue
        entry["sha256"] = sha256_file(p)
        try:
            n_obs, n_vars = h5ad_shape(p)
            entry["n_obs"] = n_obs
            entry["n_vars"] = n_vars
        except Exception as exc:
            print(f"WARN [{fid}] could not read shape: {exc}", file=sys.stderr)
        updated += 1
        print(f"  [{fid}] sha256={entry['sha256'][:16]}… n_obs={entry.get('n_obs')} n_vars={entry.get('n_vars')}")
    return updated


def main() -> None:
    ap = argparse.ArgumentParser(description="Verify or update data snapshot checksums")
    ap.add_argument(
        "--manifest",
        default="ml/data_pack/data_snapshot.yaml",
        help="Path to snapshot manifest YAML",
    )
    ap.add_argument(
        "--update",
        action="store_true",
        help="Compute checksums and write them back into the manifest",
    )
    args = ap.parse_args()

    mpath = Path(args.manifest)
    if not mpath.is_file():
        print(f"ERROR: manifest not found: {mpath}", file=sys.stderr)
        sys.exit(1)

    with open(mpath) as f:
        manifest = yaml.safe_load(f)

    if args.update:
        n = update(manifest)
        with open(mpath, "w") as f:
            yaml.dump(manifest, f, default_flow_style=False, sort_keys=False)
        print(f"Updated {n} file(s) in {mpath}")
        return

    errors = verify(manifest)
    if errors:
        print(f"SNAPSHOT VERIFICATION FAILED ({len(errors)} error(s)):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    n_files = len(manifest.get("files", []))
    print(f"OK  snapshot verified  {n_files} file(s) match")


if __name__ == "__main__":
    main()
