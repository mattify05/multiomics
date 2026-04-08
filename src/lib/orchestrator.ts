import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type OrchestratorAction =
  | { action: "launch_pipeline"; name: string; description?: string | null; config: Record<string, unknown>; dataset_ids: string[] }
  | { action: "launch_experiment"; name: string; model: string; hyperparameters?: Record<string, unknown>; pipeline_run_id?: string | null }
  | { action: "update_experiment_status"; experiment_id: string; status: string; metrics?: Record<string, unknown>; runtime?: string | null };

export async function invokePipelineOrchestrator(
  supabase: SupabaseClient<Database>,
  body: OrchestratorAction
) {
  const { data, error } = await supabase.functions.invoke("pipeline-orchestrator", {
    body,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}
