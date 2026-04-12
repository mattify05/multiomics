"""Scanpy Leiden kwargs: prefer igraph backend when available (faster, fewer warnings)."""

from __future__ import annotations

from typing import Any, Dict


def leiden_kwds() -> Dict[str, Any]:
    try:
        import igraph as _ig  # noqa: F401

        return {"flavor": "igraph", "n_iterations": 2, "directed": False}
    except ImportError:
        return {}
