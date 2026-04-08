import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

/** Inserts evaluation + XAI result rows and marks experiment completed (demo / local compute substitute). */
export async function finalizeExperimentWithDemoArtifacts(
  supabase: SupabaseClient<Database>,
  params: { experimentId: string; userId: string }
) {
  const metrics: Json = {
    auc: 0.87,
    f1: 0.82,
    pr_auc: 0.84,
    calibration: { brier: 0.12 },
    confusion_matrix: [
      [34, 6],
      [5, 35],
    ],
    train_test_split: "80/20 stratified",
    cv_strategy: "5-fold CV (recommended for production)",
    seed: 42,
    warnings: [] as string[],
  };

  const umapPoints = Array.from({ length: 40 }, (_, i) => ({
    x: (i < 20 ? -1.8 : 1.8) + (Math.random() - 0.5) * 2.4,
    y: (i < 20 ? 1.2 : -1.2) + (Math.random() - 0.5) * 2.4,
    label: i < 20 ? "Responder" : "Non-Responder",
    confidence: 0.65 + Math.random() * 0.3,
  }));

  const topFeatures = [
    { name: "EGFR", modality: "Genomics", importance: 0.92 },
    { name: "phospho-AKT", modality: "Proteomics", importance: 0.87 },
    { name: "TP53_mut", modality: "Genomics", importance: 0.81 },
  ];

  const shapFeatures = [
    { name: "EGFR", shap: 0.42, direction: "positive" as const },
    { name: "phospho-AKT", shap: 0.38, direction: "positive" as const },
    { name: "TP53_mut", shap: 0.31, direction: "positive" as const },
  ];

  const pathways = [
    { name: "PI3K/AKT/mTOR Signaling", genes: 12, fdr: 0.003, shapRank: 1 },
    { name: "EGFR Signaling", genes: 8, fdr: 0.008, shapRank: 2 },
  ];

  const { error: upErr } = await supabase
    .from("experiments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metrics,
      runtime: "demo_finalize",
    })
    .eq("id", params.experimentId)
    .eq("user_id", params.userId);

  if (upErr) throw upErr;

  const evaluationData: Json = {
    umap: umapPoints,
    top_features: topFeatures,
  };

  const xaiData: Json = {
    shap: shapFeatures,
    pathways,
    sample_waterfall: {
      base: 0.45,
      prediction: 0.91,
      label: "Responder",
      sample_id: "DEMO-SAMPLE-001",
    },
  };

  const { error: insErr } = await supabase.from("results").insert([
    {
      user_id: params.userId,
      experiment_id: params.experimentId,
      result_type: "evaluation",
      data: evaluationData,
    },
    {
      user_id: params.userId,
      experiment_id: params.experimentId,
      result_type: "xai_report",
      data: xaiData,
    },
  ]);

  if (insErr) throw insErr;
}

export function buildModelCardMarkdown(params: {
  experimentName: string;
  model: string;
  metrics: Record<string, unknown> | null;
  hyperparameters: Record<string, unknown> | null;
}): string {
  return `# Model card: ${params.experimentName}

## Model
- **Algorithm**: ${params.model}

## Training configuration
\`\`\`json
${JSON.stringify(params.hyperparameters ?? {}, null, 2)}
\`\`\`

## Metrics
\`\`\`json
${JSON.stringify(params.metrics ?? {}, null, 2)}
\`\`\`

## Limitations
- Demo artifacts may be synthesized for local testing. Production deployments must attach real validation slices, subgroup analysis, and data lineage.

## Intended use
- Research use only unless separately validated for clinical decision support.
`;
}
