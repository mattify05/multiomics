# Go / No-Go Checklist — Supervised Track A Training

Use this checklist before starting production-grade supervised training on `niche_ref` (or promoting pilot results). Every item must **PASS** or be explicitly waived with a documented reason.

Run this review **1 week** after Production Sprint 1 lands.

---

## 1. Reliability (Production Sprint 1)

| # | Check | How to verify | Pass threshold | Status |
|---|-------|---------------|----------------|--------|
| 1.1 | API smoke tests green | `pytest ml/tests/test_api_smoke.py -v` | 16/16 pass | ☐ |
| 1.2 | Durable store wired | `GET /ready` returns `run_store: SupabaseRunStore, run_store_healthy: true` (or InMemory for dev) | 200 + healthy=true | ☐ |
| 1.3 | Run survives restart | POST a run → restart uvicorn → `GET /status/{run_id}` still returns record (Supabase backend) | Status returned with correct `run_id` | ☐ |
| 1.4 | Synthetic guard active | `ML_ALLOW_SYNTHETIC_FALLBACK=false` + POST without h5ad → error_code `SYNTHETIC_FALLBACK_DISABLED` | 500 + structured error | ☐ |
| 1.5 | Correlation round-trip | Send `x-request-id` header from edge → appears in API logs and `/status` response | `request_id` present in status JSON | ☐ |
| 1.6 | Error envelope complete | POST with bad path, bad profile, max_obs > limit → each returns `{error_code, message, retryable}` | All return structured JSON, no 500 without error_code | ☐ |

**Gate:** All 6 must PASS. Failure → fix before proceeding.

---

## 2. Data Readiness

| # | Check | How to verify | Pass threshold | Status |
|---|-------|---------------|----------------|--------|
| 2.1 | Splits manifest valid | `python ml/spatial/validate_splits_manifest.py` | Exit 0 | ☐ |
| 2.2 | Data snapshot pinned | `python ml/data_pack/verify_snapshot.py` | Exit 0 (all checksums match) | ☐ |
| 2.3 | Label key present | Load each h5ad in manifest → `active_key` column exists in `adata.obs` | Column exists for all slides | ☐ |
| 2.4 | No slide leakage | Same slide ID never in two different splits | Validator exit 0 | ☐ |
| 2.5 | Minimum slides (dev) | ≥ 1 unique slide in train, val, test | Manifest `min_slides.dev` met | ☐ |

**Gate:** All 5 must PASS. Items 2.3 and 2.5 may be waived for single-slide pilot only.

---

## 3. Pilot Baseline (Engineering Validation)

| # | Check | How to verify | Pass threshold | Status |
|---|-------|---------------|----------------|--------|
| 3.1 | Pilot trainer runs | `python ml/spatial/train_pilot.py --fast --max-obs 5000` | Exits 0, produces `pilot_results/pilot_metrics.json` | ☐ |
| 3.2 | Val Macro-F1 > random | `pilot_metrics.json` → `val.macro_f1` | > 1/k where k = number of classes (e.g. > 0.20 for 5 classes) | ☐ |
| 3.3 | No class has 0 support | All classes in `val.per_class` have support ≥ 1 | True | ☐ |
| 3.4 | Train time < 5 min | `train_seconds` in metrics | < 300s with `--max-obs 5000 --fast` | ☐ |
| 3.5 | Artifacts reproducible | Run twice with same `--seed` → identical `pilot_metrics.json` | Byte-identical output | ☐ |

**Gate:** 3.1 + 3.2 must PASS. Others are quality signals.

---

## 4. Upgrade to Production Training (post-pilot)

These are **not required for pilot** but must be true before calling results "production":

| # | Check | Pass threshold |
|---|-------|----------------|
| 4.1 | `niche_ref` labels available | ≥ 1 slide has pathologist/curated `obs["niche_ref"]` |
| 4.2 | Multi-slide splits | ≥ 3 train, ≥ 1 val, ≥ 1 test unique slides |
| 4.3 | Val Macro-F1 ≥ 0.50 | On held-out slides (not spatial-block pseudo-split) |
| 4.4 | Cross-slide consistency | Std of per-slide Macro-F1 < 0.15 |
| 4.5 | Snapshot locked in CI | `verify_snapshot.py` runs in CI before training |

---

## Decision Record

| Date | Decision | Waived items | Reviewer |
|------|----------|--------------|----------|
| _YYYY-MM-DD_ | GO / NO-GO | _e.g. 2.5 waived (single slide)_ | _name_ |

---

## How to Run the Full Check

```bash
# From repo root, spatial venv active
export PYTHONPATH="${PWD}"

# 1. Reliability
pytest ml/tests/test_api_smoke.py -v

# 2. Data readiness
python ml/spatial/validate_splits_manifest.py --warn-missing
python ml/data_pack/verify_snapshot.py          # or --update first

# 3. Pilot baseline
python ml/spatial/train_pilot.py --fast --max-obs 5000

# Review pilot_results/pilot_metrics.json against thresholds above
```
