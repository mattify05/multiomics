import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { invokePipelineOrchestrator } from "@/lib/orchestrator";

/**
 * Generates a deterministic synthetic classification CSV (100 samples × 50 features + label),
 * with two informative features so a Random Forest cleanly separates the classes.
 */
export function buildSyntheticClassificationCsv(opts?: {
  nSamples?: number;
  nFeatures?: number;
  seed?: number;
}): string {
  const nSamples = opts?.nSamples ?? 100;
  const nFeatures = opts?.nFeatures ?? 50;
  let s = (opts?.seed ?? 42) >>> 0;
  // Mulberry32 PRNG for reproducibility
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box-Muller for normal samples
  const randn = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const header = ["sample_id", ...Array.from({ length: nFeatures }, (_, i) => `feat_${i + 1}`), "label"];
  const lines: string[] = [header.join(",")];
  for (let i = 0; i < nSamples; i++) {
    const label = i % 2; // balanced
    const row: (string | number)[] = [`s_${String(i + 1).padStart(4, "0")}`];
    for (let j = 0; j < nFeatures; j++) {
      // Inject signal into features 1 & 2: shift mean by ±1.5 by class
      const shift = j < 2 ? (label === 1 ? 1.5 : -1.5) : 0;
      row.push((randn() + shift).toFixed(4));
    }
    row.push(label);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export interface SmokeTestResult {
  datasetId: string;
  pipelineRunId: string;
  experimentId: string;
  experimentName: string;
}

/**
 * End-to-end smoke test: builds a synthetic CSV, uploads it to omics-data,
 * registers the dataset, creates a pipeline run, and launches a Random Forest
 * experiment via the pipeline-orchestrator edge function.
 */
export async function runSmokeTest(
  supabase: SupabaseClient<Database>,
  userId: string,
  studyId?: string | null,
): Promise<SmokeTestResult> {
  const stamp = Date.now().toString(36);
  const csv = buildSyntheticClassificationCsv();
  const blob = new Blob([csv], { type: "text/csv" });
  const fileName = `smoke_${stamp}.csv`;
  const datasetSlug = `smoke-${stamp}`;
  const objectPath = `${userId}/${datasetSlug}/${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from("omics-data")
    .upload(objectPath, blob, { contentType: "text/csv", upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // 2. Register dataset row
  const { data: dataset, error: dsError } = await supabase
    .from("datasets")
    .insert({
      user_id: userId,
      name: `Smoke test ${stamp}`,
      modality: "Tabular",
      cohort: "synthetic",
      samples: 100,
      features: 50,
      status: "ready",
      file_path: objectPath,
      study_id: studyId ?? null,
      metadata: { synthetic: true, generator: "buildSyntheticClassificationCsv", seed: 42 },
    })
    .select("id")
    .single();
  if (dsError || !dataset) throw new Error(`Dataset insert failed: ${dsError?.message ?? "no row"}`);

  // 3. Create pipeline run via orchestrator
  const pipelineRes = (await invokePipelineOrchestrator(supabase, {
    action: "launch_pipeline",
    name: `smoke_pipeline_${stamp}`,
    description: "Auto-generated smoke test pipeline",
    config: { normalization: "none", batch_correction: "none", smoke: true },
    dataset_ids: [dataset.id],
  })) as { pipeline_run?: { id: string } };
  const pipelineRunId = pipelineRes.pipeline_run?.id;
  if (!pipelineRunId) throw new Error("Orchestrator did not return a pipeline_run id");

  // 4. Launch experiment via orchestrator
  const experimentName = `smoke_exp_${stamp}`;
  const experimentRes = (await invokePipelineOrchestrator(supabase, {
    action: "launch_experiment",
    name: experimentName,
    model: "Random Forest",
    hyperparameters: {
      label_column: "label",
      target_variable: "label",
      train_test_split: "80/20",
      stratify: true,
      seed: 42,
    },
    pipeline_run_id: pipelineRunId,
    dataset_ids: [dataset.id],
  })) as { experiment?: { id: string } };
  const experimentId = experimentRes.experiment?.id;
  if (!experimentId) throw new Error("Orchestrator did not return an experiment id");

  return { datasetId: dataset.id, pipelineRunId, experimentId, experimentName };
}
