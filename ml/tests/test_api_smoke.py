"""
Reliability acceptance smoke tests for the spatial ML API (Production Sprint 1).

Run with pytest from the repo root (spatial venv active):

    export PYTHONPATH="${PWD}"
    pytest ml/tests/test_api_smoke.py -v

Tests use FastAPI's TestClient (in-process); no running server needed.
"""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _inmemory_store(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force InMemoryRunStore so tests don't need Supabase."""
    monkeypatch.setenv("ML_RUN_STORE_BACKEND", "inmemory")
    import ml.spatial.store as store_mod

    store_mod._store = None


@pytest.fixture()
def client() -> TestClient:
    from ml.api.main import app

    return TestClient(app)


# -----------------------------------------------------------------
# Health / readiness
# -----------------------------------------------------------------

class TestHealthReady:
    def test_health(self, client: TestClient) -> None:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_ready_inmemory(self, client: TestClient) -> None:
        r = client.get("/ready")
        assert r.status_code == 200
        body = r.json()
        assert body["ready"] is True
        assert body["run_store_healthy"] is True
        assert "InMemoryRunStore" in body["run_store"]


# -----------------------------------------------------------------
# Correlation ID round-trip
# -----------------------------------------------------------------

class TestCorrelationId:
    def test_server_generates_request_id(self, client: TestClient) -> None:
        r = client.post("/run/spatial/qc-annotation", json={})
        assert "x-request-id" in r.headers
        assert len(r.headers["x-request-id"]) > 0

    def test_client_request_id_echoed(self, client: TestClient) -> None:
        req_id = str(uuid.uuid4())
        r = client.post(
            "/run/spatial/qc-annotation",
            json={},
            headers={"x-request-id": req_id},
        )
        assert r.headers["x-request-id"] == req_id


# -----------------------------------------------------------------
# Error contract – structured error envelope
# -----------------------------------------------------------------

class TestErrorContract:
    def test_bad_profile_422(self, client: TestClient) -> None:
        r = client.post("/run/spatial/qc-annotation", json={"profile": "turbo"})
        assert r.status_code == 422

    def test_max_obs_exceeds_limit(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ML_MAX_OBS_HARD_LIMIT", "100")
        r = client.post("/run/spatial/qc-annotation", json={"max_obs": 101})
        assert r.status_code == 422

    def test_relative_path_rejected(self, client: TestClient) -> None:
        r = client.post("/run/spatial/qc-annotation", json={"h5ad_path": "relative/path.h5ad"})
        assert r.status_code == 422

    def test_missing_file_prod_mode(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ML_ALLOW_SYNTHETIC_FALLBACK", "false")
        r = client.post(
            "/run/spatial/qc-annotation",
            json={"h5ad_path": "/nonexistent/file.h5ad"},
        )
        body = r.json()
        assert r.status_code in (404, 500)
        assert body.get("error_code") in ("MISSING_FILE", "RUNNER_EXCEPTION")
        assert "retryable" in body

    def test_unknown_run_id_404(self, client: TestClient) -> None:
        r = client.get(f"/status/{uuid.uuid4()}")
        assert r.status_code == 404


# -----------------------------------------------------------------
# Synthetic guard – prod mode blocks fallback
# -----------------------------------------------------------------

class TestSyntheticGuard:
    def test_dev_mode_returns_synthetic(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ML_ALLOW_SYNTHETIC_FALLBACK", "true")
        r = client.post("/run/spatial/qc-annotation", json={})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "completed"
        note = body.get("artifacts", {}).get("qc_metrics", {}).get("note", "")
        assert "Synthetic" in note

    def test_prod_mode_blocks_synthetic(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ML_ALLOW_SYNTHETIC_FALLBACK", "false")
        r = client.post("/run/spatial/qc-annotation", json={})
        body = r.json()
        assert body.get("error_code") == "SYNTHETIC_FALLBACK_DISABLED"
        assert r.status_code == 500


# -----------------------------------------------------------------
# Run durability (InMemory baseline — Supabase tested in integration)
# -----------------------------------------------------------------

class TestRunDurability:
    def test_run_persisted_and_retrievable(self, client: TestClient) -> None:
        r = client.post("/run/spatial/qc-annotation", json={})
        assert r.status_code == 200
        run_id = r.json()["run_id"]

        r2 = client.get(f"/status/{run_id}")
        assert r2.status_code == 200
        assert r2.json()["run_id"] == run_id
        assert r2.json()["status"] in ("completed", "failed")

    def test_run_has_elapsed_ms(self, client: TestClient) -> None:
        r = client.post("/run/spatial/qc-annotation", json={})
        body = r.json()
        if body["status"] == "completed":
            assert "elapsed_ms" in body
            assert body["elapsed_ms"] >= 0


# -----------------------------------------------------------------
# Label transfer validation
# -----------------------------------------------------------------

class TestLabelTransferValidation:
    def test_min_shared_genes_lower_bound(self, client: TestClient) -> None:
        r = client.post(
            "/run/spatial/label-transfer",
            json={"min_shared_genes": 10},
        )
        assert r.status_code == 422

    def test_min_shared_genes_upper_bound(self, client: TestClient) -> None:
        r = client.post(
            "/run/spatial/label-transfer",
            json={"min_shared_genes": 100000},
        )
        assert r.status_code == 422


# -----------------------------------------------------------------
# Benchmark validation
# -----------------------------------------------------------------

class TestBenchmarkValidation:
    def test_f1_out_of_range(self, client: TestClient) -> None:
        r = client.post(
            "/run/spatial/benchmark",
            json={"in_domain_f1": 1.5},
        )
        assert r.status_code == 422
