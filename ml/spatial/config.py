"""Runtime configuration for spatial pipelines, read from environment."""

from __future__ import annotations

import os


def allow_synthetic_fallback() -> bool:
    """Return True if synthetic demo artifacts are allowed as silent fallbacks.

    Set ``ML_ALLOW_SYNTHETIC_FALLBACK=false`` in production to force failures
    to surface as explicit errors through the API error envelope.
    Default: ``true`` (dev-friendly).
    """
    return os.environ.get("ML_ALLOW_SYNTHETIC_FALLBACK", "true").lower().strip() in ("true", "1", "yes")


def max_obs_hard_limit() -> int:
    """Absolute upper bound for ``max_obs`` accepted by the API."""
    return int(os.environ.get("ML_MAX_OBS_HARD_LIMIT", "200000"))
