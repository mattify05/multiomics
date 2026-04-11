#!/usr/bin/env python3
"""
Run Sprint 1 then Sprint 2 on a .h5ad and report timing + approximate RSS (Unix).

Usage (repo root, spatial venv):

  export PYTHONPATH="${PWD}"
  python ml/data_pack/make_synthetic_spatial_h5ad.py
  python ml/spatial/validate_sprint_stack.py --h5ad-path ml/data_pack/local/synthetic_spatial_dev.h5ad --max-obs 500

For a real Visium HD file (path must be readable on this machine):

  python ml/spatial/validate_sprint_stack.py \\
    --h5ad-path ml/data_pack/local/square_016um_dev.h5ad \\
    --max-obs 25000 --random-seed 0

Optional API mode (uvicorn must be running):

  python ml/spatial/validate_sprint_stack.py --api-url http://127.0.0.1:8787 \\
    --h5ad-path /abs/path/to/file.h5ad --max-obs 25000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

from ml.spatial import sprint1, sprint2


def _sprint1_is_synthetic(artifacts: Dict[str, Any]) -> bool:
    note = (artifacts.get("qc_metrics") or {}).get("note")
    return isinstance(note, str) and "Synthetic demo" in note


def _sprint2_is_synthetic(artifacts: Dict[str, Any]) -> bool:
    note = (artifacts.get("graph_metrics") or {}).get("note")
    return isinstance(note, str) and "Synthetic" in note


def _rss_bytes() -> Optional[int]:
    try:
        import resource

        ru = resource.getrusage(resource.RUSAGE_SELF)
        # macOS: ru_maxrss in bytes; Linux: kilobytes
        rss = ru.ru_maxrss
        if sys.platform == "darwin":
            return int(rss)
        return int(rss) * 1024
    except Exception:
        return None


def _post_json(url: str, body: Dict[str, Any], timeout: float = 3600.0) -> Dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_direct(h5ad_path: Path, max_obs: Optional[int], random_seed: int) -> Dict[str, Any]:
    rss0 = _rss_bytes()
    t0 = time.perf_counter()
    art1 = sprint1.run(str(h5ad_path), max_obs=max_obs, random_seed=random_seed)
    t1 = time.perf_counter()
    art2 = sprint2.run(str(h5ad_path), max_obs=max_obs, random_seed=random_seed)
    t2 = time.perf_counter()
    rss1 = _rss_bytes()
    report = {
        "mode": "in_process",
        "h5ad_path": str(h5ad_path.resolve()),
        "max_obs": max_obs,
        "random_seed": random_seed,
        "sprint1_seconds": round(t1 - t0, 3),
        "sprint2_seconds": round(t2 - t1, 3),
        "total_seconds": round(t2 - t0, 3),
        "rss_before_bytes": rss0,
        "rss_after_bytes": rss1,
        "sprint1_n_embedding": len(art1.get("embedding", [])),
        "sprint2_n_niches": len(art2.get("niches", [])),
        "sprint1_qc_metrics": art1.get("qc_metrics"),
        "sprint2_graph_metrics": art2.get("graph_metrics"),
        "sprint1_used_synthetic_fallback": _sprint1_is_synthetic(art1),
        "sprint2_used_synthetic_fallback": _sprint2_is_synthetic(art2),
    }
    return report


def run_api(base: str, h5ad_path: Path, max_obs: Optional[int], random_seed: int) -> Dict[str, Any]:
    base = base.rstrip("/")
    abs_path = str(h5ad_path.resolve())
    body = {"h5ad_path": abs_path, "max_obs": max_obs, "random_seed": random_seed}
    rss0 = _rss_bytes()
    t0 = time.perf_counter()
    r1 = _post_json(f"{base}/run/spatial/qc-annotation", body)
    t1 = time.perf_counter()
    r2 = _post_json(f"{base}/run/spatial/niches", body)
    t2 = time.perf_counter()
    rss1 = _rss_bytes()
    out: Dict[str, Any] = {
        "mode": "http_api",
        "api_base": base,
        "h5ad_path": abs_path,
        "max_obs": max_obs,
        "random_seed": random_seed,
        "sprint1_seconds": round(t1 - t0, 3),
        "sprint2_seconds": round(t2 - t1, 3),
        "total_seconds": round(t2 - t0, 3),
        "rss_before_bytes": rss0,
        "rss_after_bytes": rss1,
        "sprint1_status": r1.get("status"),
        "sprint2_status": r2.get("status"),
        "sprint1_run_id": r1.get("run_id"),
        "sprint2_run_id": r2.get("run_id"),
    }
    if r1.get("status") == "failed":
        out["sprint1_error"] = r1.get("error")
    if r2.get("status") == "failed":
        out["sprint2_error"] = r2.get("error")
    a1 = r1.get("artifacts") or {}
    a2 = r2.get("artifacts") or {}
    out["sprint1_used_synthetic_fallback"] = _sprint1_is_synthetic(a1)
    out["sprint2_used_synthetic_fallback"] = _sprint2_is_synthetic(a2)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate spatial Sprint 1 → 2 on disk")
    ap.add_argument(
        "--h5ad-path",
        type=str,
        default="ml/data_pack/local/synthetic_spatial_dev.h5ad",
        help="Path to .h5ad (worker must use absolute path in API mode)",
    )
    ap.add_argument("--max-obs", type=int, default=None, help="Subsample after load (same as API max_obs)")
    ap.add_argument("--random-seed", type=int, default=0)
    ap.add_argument(
        "--api-url",
        type=str,
        default=None,
        help="If set, POST to FastAPI instead of calling sprints in-process",
    )
    args = ap.parse_args()

    h5ad_path = Path(args.h5ad_path).expanduser()
    if not h5ad_path.is_file():
        print(
            f"Missing {h5ad_path}\n"
            "  Generate dev data:  python ml/data_pack/make_synthetic_spatial_h5ad.py\n"
            "  Or convert Visium HD:  python ml/data_pack/visium_hd_square_to_h5ad.py ...",
            file=sys.stderr,
        )
        sys.exit(1)

    max_obs: Optional[int] = args.max_obs if args.max_obs and args.max_obs > 0 else None

    if args.api_url:
        report = run_api(args.api_url, h5ad_path, max_obs, args.random_seed)
    else:
        report = run_direct(h5ad_path, max_obs, args.random_seed)

    print(json.dumps(report, indent=2))

    if args.api_url:
        if report.get("sprint1_status") != "completed" or report.get("sprint2_status") != "completed":
            sys.exit(2)
        if report.get("sprint1_used_synthetic_fallback") or report.get("sprint2_used_synthetic_fallback"):
            print(
                "ERROR: API returned synthetic demo artifacts (check worker deps, e.g. leidenalg).",
                file=sys.stderr,
            )
            sys.exit(3)
    else:
        if report.get("sprint1_used_synthetic_fallback") or report.get("sprint2_used_synthetic_fallback"):
            print(
                "ERROR: In-process run used synthetic fallback (common fix: pip install -r ml/requirements-spatial.txt).",
                file=sys.stderr,
            )
            sys.exit(3)


if __name__ == "__main__":
    main()
