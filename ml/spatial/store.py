"""
Pluggable run-status store for the spatial API.

Backend selection via ``ML_RUN_STORE_BACKEND`` env var:
  - ``inmemory`` (default): process-local dict; fine for dev / single-process.
  - ``supabase``: durable rows in ``ml_spatial_runs`` table; survives restarts.

Both backends expose the same ``RunStore`` interface consumed by ``ml.api.main``.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger("ml.spatial.store")


@dataclass
class RunRecord:
    run_id: str
    status: str  # queued | running | completed | failed
    pipeline: str
    created_at: str
    updated_at: str
    error: Optional[str] = None
    error_code: Optional[str] = None
    artifacts: Dict[str, Any] = field(default_factory=dict)
    request_id: Optional[str] = None
    elapsed_ms: Optional[float] = None


def to_public_dict(rec: RunRecord) -> Dict[str, Any]:
    d: Dict[str, Any] = {
        "run_id": rec.run_id,
        "status": rec.status,
        "pipeline": rec.pipeline,
        "created_at": rec.created_at,
        "updated_at": rec.updated_at,
        "error": rec.error,
        "error_code": rec.error_code,
        "artifacts": rec.artifacts,
    }
    if rec.request_id:
        d["request_id"] = rec.request_id
    if rec.elapsed_ms is not None:
        d["elapsed_ms"] = rec.elapsed_ms
    return d


class RunStore(ABC):
    @abstractmethod
    def new_run(self, pipeline: str, *, request_id: Optional[str] = None) -> RunRecord: ...

    @abstractmethod
    def update(self, run_id: str, **kwargs: Any) -> None: ...

    @abstractmethod
    def get(self, run_id: str) -> Optional[RunRecord]: ...

    @abstractmethod
    def healthy(self) -> bool: ...


# ---------------------------------------------------------------------------
# In-memory backend
# ---------------------------------------------------------------------------

class InMemoryRunStore(RunStore):
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._runs: Dict[str, RunRecord] = {}

    def new_run(self, pipeline: str, *, request_id: Optional[str] = None) -> RunRecord:
        run_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        rec = RunRecord(
            run_id=run_id,
            status="queued",
            pipeline=pipeline,
            created_at=now,
            updated_at=now,
            request_id=request_id,
        )
        with self._lock:
            self._runs[run_id] = rec
        return rec

    def update(self, run_id: str, **kwargs: Any) -> None:
        with self._lock:
            rec = self._runs.get(run_id)
            if not rec:
                return
            for k, v in kwargs.items():
                setattr(rec, k, v)
            rec.updated_at = datetime.now(timezone.utc).isoformat()

    def get(self, run_id: str) -> Optional[RunRecord]:
        with self._lock:
            return self._runs.get(run_id)

    def healthy(self) -> bool:
        return True


# ---------------------------------------------------------------------------
# Supabase backend
# ---------------------------------------------------------------------------

class SupabaseRunStore(RunStore):
    """Durable store backed by ``ml_spatial_runs`` table in Supabase Postgres."""

    def __init__(self) -> None:
        from supabase import create_client

        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError(
                "SupabaseRunStore requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )
        self._client = create_client(url, key)
        self._table = "ml_spatial_runs"

    def new_run(self, pipeline: str, *, request_id: Optional[str] = None) -> RunRecord:
        run_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": run_id,
            "pipeline": pipeline,
            "status": "queued",
            "created_at": now,
            "updated_at": now,
            "request_id": request_id,
        }
        self._client.table(self._table).insert(row).execute()
        return RunRecord(
            run_id=run_id,
            status="queued",
            pipeline=pipeline,
            created_at=now,
            updated_at=now,
            request_id=request_id,
        )

    def update(self, run_id: str, **kwargs: Any) -> None:
        now = datetime.now(timezone.utc).isoformat()
        row: Dict[str, Any] = {"updated_at": now}
        for k, v in kwargs.items():
            if k == "artifacts":
                row["artifacts"] = json.dumps(v) if isinstance(v, dict) else v
            else:
                row[k] = v
        self._client.table(self._table).update(row).eq("id", run_id).execute()

    def get(self, run_id: str) -> Optional[RunRecord]:
        resp = (
            self._client.table(self._table)
            .select("*")
            .eq("id", run_id)
            .maybe_single()
            .execute()
        )
        r = resp.data
        if not r:
            return None
        arts = r.get("artifacts")
        if isinstance(arts, str):
            arts = json.loads(arts)
        return RunRecord(
            run_id=r["id"],
            status=r["status"],
            pipeline=r["pipeline"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            error=r.get("error"),
            error_code=r.get("error_code"),
            artifacts=arts or {},
            request_id=r.get("request_id"),
            elapsed_ms=r.get("elapsed_ms"),
        )

    def healthy(self) -> bool:
        try:
            self._client.table(self._table).select("id").limit(1).execute()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_store: Optional[RunStore] = None


def get_store() -> RunStore:
    global _store
    if _store is not None:
        return _store
    backend = os.environ.get("ML_RUN_STORE_BACKEND", "inmemory").lower().strip()
    if backend == "supabase":
        logger.info("Initializing SupabaseRunStore")
        _store = SupabaseRunStore()
    else:
        logger.info("Initializing InMemoryRunStore (set ML_RUN_STORE_BACKEND=supabase for durable)")
        _store = InMemoryRunStore()
    return _store


# ---------------------------------------------------------------------------
# Convenience shims (backward-compatible module-level functions)
# ---------------------------------------------------------------------------

def new_run(pipeline: str, *, request_id: Optional[str] = None) -> RunRecord:
    return get_store().new_run(pipeline, request_id=request_id)


def update(run_id: str, **kwargs: Any) -> None:
    get_store().update(run_id, **kwargs)


def get(run_id: str) -> Optional[RunRecord]:
    return get_store().get(run_id)
