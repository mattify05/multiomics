/**
 * Client for the Python FastAPI spatial service (Phase 3).
 * Set VITE_SPATIAL_API_URL (e.g. http://localhost:8787). If unset, callers should use demo data.
 */
const base = (): string | undefined => {
  const u = import.meta.env.VITE_SPATIAL_API_URL as string | undefined;
  return u?.replace(/\/$/, "") || undefined;
};

export type SpatialRunResponse = {
  run_id: string;
  status: string;
  pipeline: string;
  created_at: string;
  updated_at: string;
  error: string | null;
  artifacts: Record<string, unknown>;
};

export type H5adRunOptions = {
  /** Subsample spots after load (uniform random); caps memory/time on Visium HD. */
  max_obs?: number;
  random_seed?: number;
};

async function postJson(path: string, body: Record<string, unknown>): Promise<SpatialRunResponse> {
  const root = base();
  if (!root) throw new Error("VITE_SPATIAL_API_URL is not set");
  const res = await fetch(`${root}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json() as Promise<SpatialRunResponse>;
}

export function isSpatialApiConfigured(): boolean {
  return Boolean(base());
}

export async function runSpatialQcAnnotation(
  h5adPath?: string,
  opts?: H5adRunOptions
): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/qc-annotation", {
    h5ad_path: h5adPath ?? null,
    max_obs: opts?.max_obs ?? null,
    random_seed: opts?.random_seed ?? 0,
  });
}

export async function runSpatialNiches(h5adPath?: string, opts?: H5adRunOptions): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/niches", {
    h5ad_path: h5adPath ?? null,
    max_obs: opts?.max_obs ?? null,
    random_seed: opts?.random_seed ?? 0,
  });
}

export type LabelTransferOptions = {
  spatial_max_obs?: number;
  spatial_random_seed?: number;
  min_shared_genes?: number;
};

export async function runSpatialLabelTransfer(
  spatialH5ad?: string,
  referenceH5ad?: string,
  refLabelKey = "cell_type",
  opts?: LabelTransferOptions
): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/label-transfer", {
    spatial_h5ad: spatialH5ad ?? null,
    reference_h5ad: referenceH5ad ?? null,
    ref_label_key: refLabelKey,
    spatial_max_obs: opts?.spatial_max_obs ?? null,
    spatial_random_seed: opts?.spatial_random_seed ?? 0,
    min_shared_genes: opts?.min_shared_genes ?? 500,
  });
}

export type BenchmarkOptions = {
  platform_train?: string;
  platform_test?: string;
  in_domain_f1?: number;
  ood_f1?: number;
  train_h5ad_path?: string | null;
  test_h5ad_path?: string | null;
};

export async function runSpatialBenchmark(opts?: BenchmarkOptions): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/benchmark", {
    platform_train: opts?.platform_train ?? "10x_visium",
    platform_test: opts?.platform_test ?? "stereo_seq",
    in_domain_f1: opts?.in_domain_f1 ?? 0.82,
    ood_f1: opts?.ood_f1 ?? 0.61,
    train_h5ad_path: opts?.train_h5ad_path ?? null,
    test_h5ad_path: opts?.test_h5ad_path ?? null,
  });
}

export async function getSpatialStatus(runId: string): Promise<SpatialRunResponse> {
  const root = base();
  if (!root) throw new Error("VITE_SPATIAL_API_URL is not set");
  const res = await fetch(`${root}/status/${runId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SpatialRunResponse>;
}
