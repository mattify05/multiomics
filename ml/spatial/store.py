"""In-memory run status store for the spatial API (replace with Redis/DB in production)."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

_lock = threading.Lock()
_runs: Dict[str, "RunRecord"] = {}


@dataclass
class RunRecord:
    run_id: str
    status: str  # queued | running | completed | failed
    pipeline: str
    created_at: str
    updated_at: str
    error: Optional[str] = None
    artifacts: Dict[str, Any] = field(default_factory=dict)


def new_run(pipeline: str) -> RunRecord:
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    rec = RunRecord(
        run_id=run_id,
        status="queued",
        pipeline=pipeline,
        created_at=now,
        updated_at=now,
    )
    with _lock:
        _runs[run_id] = rec
    return rec


def update(run_id: str, **kwargs: Any) -> None:
    with _lock:
        rec = _runs.get(run_id)
        if not rec:
            return
        for k, v in kwargs.items():
            setattr(rec, k, v)
        rec.updated_at = datetime.now(timezone.utc).isoformat()


def get(run_id: str) -> Optional[RunRecord]:
    with _lock:
        return _runs.get(run_id)


def to_public_dict(rec: RunRecord) -> Dict[str, Any]:
    return {
        "run_id": rec.run_id,
        "status": rec.status,
        "pipeline": rec.pipeline,
        "created_at": rec.created_at,
        "updated_at": rec.updated_at,
        "error": rec.error,
        "artifacts": rec.artifacts,
    }
