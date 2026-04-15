import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type OrchestratorAction =
  | { action: "launch_pipeline"; name: string; description?: string | null; config: Record<string, unknown>; dataset_ids: string[] }
  | {
      action: "launch_experiment";
      name: string;
      model: string;
      hyperparameters?: Record<string, unknown>;
      pipeline_run_id?: string | null;
      /** Resolved from the selected pipeline’s ``dataset_ids`` so the tabular worker can load Storage objects. */
      dataset_ids?: string[];
    }
  | { action: "update_experiment_status"; experiment_id: string; status: string; metrics?: Record<string, unknown>; runtime?: string | null }
  | { action: "append_job_log"; job_id: string; line: string }
  | { action: "update_job_status"; job_id: string; status: string }
  | { action: "launch_qc_job"; dataset_id: string; dataset_name: string }
  | {
      action: "dispatch_spatial";
      sprint: "sprint1" | "sprint2" | "sprint3" | "sprint4";
      h5ad_path?: string | null;
      reference_h5ad?: string | null;
    };

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
