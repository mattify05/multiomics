# Local spatial `.h5ad` (not in git)

Only **`*.h5ad`** files here are gitignored. Use this folder for **worker-readable** paths that stay stable on your machine.

## Quick dev loop

1. **Synthetic smoke file** (no 10x download):

   ```bash
   export PYTHONPATH="${PWD}"   # repo root
   python ml/data_pack/make_synthetic_spatial_h5ad.py
   python ml/spatial/validate_sprint_stack.py
   ```

2. **Real Visium HD, smaller dev file** (coarser bin + cap + no H&E to save RAM):

   ```bash
   chmod +x ml/data_pack/build_dev_h5ad.sh
   ./ml/data_pack/build_dev_h5ad.sh "/path/to/binned_outputs/square_016um" 50000 0
   ```

3. **Point the API** at the absolute path of the file under this directory, with `max_obs` for interactive runs (see `ml/spatial/PERFORMANCE.md`).

Naming suggestion: `{square_name}_dev.h5ad` or `{cohort}_{slide}_016um.h5ad`.
