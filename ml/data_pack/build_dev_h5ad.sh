#!/usr/bin/env bash
# Build a dev-friendly .h5ad from Visium HD square_*um output (coarser bin + optional cap).
# Usage:
#   ./ml/data_pack/build_dev_h5ad.sh /path/to/binned_outputs/square_016um [MAX_SPOTS] [SEED]
#
# Requires: repo root as cwd, PYTHONPATH=repo root, .venv-spatial activated.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}"

SQUARE_DIR="${1:?Usage: $0 /path/to/square_016um [MAX_SPOTS] [SEED]}"
MAX_SPOTS="${2:-50000}"
SEED="${3:-0}"

OUT="${ROOT}/ml/data_pack/local/$(basename "$SQUARE_DIR")_dev.h5ad"

python ml/data_pack/visium_hd_square_to_h5ad.py \
  --square-dir "$SQUARE_DIR" \
  --output "$OUT" \
  --filter-in-tissue \
  --no-histology \
  --max-spots "$MAX_SPOTS" \
  --random-seed "$SEED" \
  --library-id spatial

echo "Dev .h5ad: $OUT"
echo "Validate: python ml/spatial/validate_sprint_stack.py --h5ad-path \"$OUT\" --max-obs 25000"
