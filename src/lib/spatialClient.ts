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

export async function runSpatialQcAnnotation(h5adPath?: string): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/qc-annotation", { h5ad_path: h5adPath ?? null });
}

export async function runSpatialNiches(h5adPath?: string): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/niches", { h5ad_path: h5adPath ?? null });
}

export async function runSpatialLabelTransfer(
  spatialH5ad?: string,
  referenceH5ad?: string,
  refLabelKey = "cell_type"
): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/label-transfer", {
    spatial_h5ad: spatialH5ad ?? null,
    reference_h5ad: referenceH5ad ?? null,
    ref_label_key: refLabelKey,
  });
}

export async function runSpatialBenchmark(): Promise<SpatialRunResponse> {
  return postJson("/run/spatial/benchmark", {});
}

export async function getSpatialStatus(runId: string): Promise<SpatialRunResponse> {
  const root = base();
  if (!root) throw new Error("VITE_SPATIAL_API_URL is not set");
  const res = await fetch(`${root}/status/${runId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SpatialRunResponse>;
}
