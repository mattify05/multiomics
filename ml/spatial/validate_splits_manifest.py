#!/usr/bin/env python3
"""
Validate the splits manifest before training.

Checks:
  1. YAML schema: required keys, types, non-empty splits.
  2. No slide ID appears in more than one split (leakage guard),
     unless single-slide pilot mode is explicitly enabled.
  3. h5ad paths exist on disk (warning only if --warn-missing, error by default).
  4. Active label key is one of interim_key / production_key.

Exit codes:
  0  all checks pass
  1  validation errors (blocks training / CI)

Usage:
  export PYTHONPATH="${PWD}"
  python ml/spatial/validate_splits_manifest.py
  python ml/spatial/validate_splits_manifest.py --manifest ml/spatial/splits_manifest.yaml --warn-missing
  python ml/spatial/validate_splits_manifest.py --allow-single-slide-pilot
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

import yaml


REQUIRED_TOP_KEYS = {"version", "track", "label", "split_unit", "slides", "min_slides", "metrics", "random_seed"}
REQUIRED_LABEL_KEYS = {"interim_key", "production_key", "active_key"}
REQUIRED_SPLIT_NAMES = {"train", "val", "test"}


def load_manifest(path: Path) -> Dict[str, Any]:
    with open(path) as f:
        return yaml.safe_load(f)


def _single_slide_pilot_enabled(manifest: Dict[str, Any], cli_allow: bool) -> bool:
    if cli_allow:
        return True
    return bool(manifest.get("single_slide_pilot", False))


def _is_valid_single_slide_pilot(slides: Dict[str, Any]) -> bool:
    """Allow exactly one shared slide id/path across train/val/test for pilot mode."""
    ids: Set[str] = set()
    paths: Set[str] = set()
    for split_name in REQUIRED_SPLIT_NAMES:
        entries = slides.get(split_name, [])
        if len(entries) != 1:
            return False
        sid = entries[0].get("id")
        h5ad = entries[0].get("h5ad")
        if not sid or not h5ad:
            return False
        ids.add(str(sid))
        paths.add(str(h5ad))
    return len(ids) == 1 and len(paths) == 1


def validate(
    manifest: Dict[str, Any],
    *,
    warn_missing_files: bool = False,
    allow_single_slide_pilot: bool = False,
) -> List[str]:
    errors: List[str] = []

    missing_top = REQUIRED_TOP_KEYS - set(manifest.keys())
    if missing_top:
        errors.append(f"Missing top-level keys: {sorted(missing_top)}")

    label = manifest.get("label", {})
    if not isinstance(label, dict):
        errors.append("'label' must be a mapping")
    else:
        missing_label = REQUIRED_LABEL_KEYS - set(label.keys())
        if missing_label:
            errors.append(f"Missing label keys: {sorted(missing_label)}")
        active = label.get("active_key")
        valid_keys = {label.get("interim_key"), label.get("production_key")}
        if active and active not in valid_keys:
            errors.append(f"active_key '{active}' not in {{interim_key, production_key}}")

    slides = manifest.get("slides", {})
    if not isinstance(slides, dict):
        errors.append("'slides' must be a mapping with train/val/test")
    else:
        missing_splits = REQUIRED_SPLIT_NAMES - set(slides.keys())
        if missing_splits:
            errors.append(f"Missing split groups: {sorted(missing_splits)}")

        pilot_mode = _single_slide_pilot_enabled(manifest, allow_single_slide_pilot)
        pilot_ok = pilot_mode and _is_valid_single_slide_pilot(slides)
        if pilot_mode and not pilot_ok:
            errors.append(
                "single_slide_pilot enabled, but manifest is not a valid single-slide layout "
                "(requires exactly one identical slide id/path in each split)"
            )

        all_ids: Dict[str, str] = {}
        for split_name in REQUIRED_SPLIT_NAMES:
            entries = slides.get(split_name, [])
            if not entries:
                errors.append(f"Split '{split_name}' is empty")
                continue
            for entry in entries:
                sid = entry.get("id")
                h5ad = entry.get("h5ad")
                if not sid:
                    errors.append(f"Entry in '{split_name}' missing 'id'")
                if not h5ad:
                    errors.append(f"Entry in '{split_name}' missing 'h5ad'")
                if sid and sid in all_ids and all_ids[sid] != split_name and not pilot_ok:
                    errors.append(
                        f"Slide '{sid}' appears in both '{all_ids[sid]}' and '{split_name}' — leakage risk"
                    )
                if sid:
                    all_ids[sid] = split_name
                if h5ad:
                    p = Path(h5ad)
                    if not p.is_file():
                        msg = f"h5ad not found: {h5ad} (slide {sid}, split {split_name})"
                        if warn_missing_files:
                            print(f"WARNING: {msg}", file=sys.stderr)
                        else:
                            errors.append(msg)

    return errors


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate splits manifest for spatial training")
    ap.add_argument(
        "--manifest",
        type=str,
        default="ml/spatial/splits_manifest.yaml",
        help="Path to splits manifest YAML",
    )
    ap.add_argument(
        "--warn-missing",
        action="store_true",
        help="Treat missing h5ad files as warnings instead of errors",
    )
    ap.add_argument(
        "--allow-single-slide-pilot",
        action="store_true",
        help="Allow the same single slide in train/val/test (dev pilot mode only)",
    )
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.is_file():
        print(f"ERROR: manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest(manifest_path)
    errors = validate(
        manifest,
        warn_missing_files=args.warn_missing,
        allow_single_slide_pilot=args.allow_single_slide_pilot,
    )

    if errors:
        print(f"VALIDATION FAILED ({len(errors)} error(s)):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    n_train = len(manifest.get("slides", {}).get("train", []))
    n_val = len(manifest.get("slides", {}).get("val", []))
    n_test = len(manifest.get("slides", {}).get("test", []))
    total = n_train + n_val + n_test
    unique_ids: Set[str] = set()
    for split in manifest.get("slides", {}).values():
        for entry in split:
            unique_ids.add(entry.get("id", ""))
    print(
        f"OK  manifest valid  "
        f"train={n_train} val={n_val} test={n_test} "
        f"unique_slides={len(unique_ids)} "
        f"active_label={manifest.get('label', {}).get('active_key')} "
        f"single_slide_pilot={_single_slide_pilot_enabled(manifest, args.allow_single_slide_pilot)}"
    )


if __name__ == "__main__":
    main()
