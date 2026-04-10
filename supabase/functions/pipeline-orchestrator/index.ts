import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      // In Edge Functions we typically use the anon key (RLS enforced) or service role (privileged).
      // This function uses the caller's JWT via the Authorization header, so anon key is appropriate.
      getRequiredEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case "launch_pipeline": {
        const { name, description, config, dataset_ids } = payload;

        const { data: run, error } = await supabase
          .from("pipeline_runs")
          .insert({
            user_id: user.id,
            name,
            description,
            config,
            dataset_ids,
            status: "running",
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from("jobs").insert({
          user_id: user.id,
          type: "pipeline",
          status: "running",
          pipeline_run_id: run.id,
          started_at: new Date().toISOString(),
          worker_version: "edge-orchestrator-v1",
          logs: [{ ts: new Date().toISOString(), line: `Pipeline ${name} launched` }],
        });

        return new Response(JSON.stringify({ success: true, pipeline_run: run }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "launch_experiment": {
        const { name, model, hyperparameters, pipeline_run_id } = payload;

        const { data: experiment, error } = await supabase
          .from("experiments")
          .insert({
            user_id: user.id,
            name,
            model,
            hyperparameters,
            pipeline_run_id,
            status: "running",
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from("jobs").insert({
          user_id: user.id,
          type: "experiment",
          status: "running",
          experiment_id: experiment.id,
          pipeline_run_id: pipeline_run_id ?? null,
          started_at: new Date().toISOString(),
          worker_version: "edge-orchestrator-v1",
          logs: [{ ts: new Date().toISOString(), line: `Experiment ${name} started for model ${model}` }],
        });

        return new Response(JSON.stringify({ success: true, experiment }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_experiment_status": {
        const { experiment_id, status, metrics, runtime } = payload;

        const updateData: Record<string, unknown> = { status };
        if (metrics) updateData.metrics = metrics;
        if (runtime) updateData.runtime = runtime;
        if (status === "completed" || status === "failed") {
          updateData.completed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from("experiments")
          .update(updateData)
          .eq("id", experiment_id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from("jobs")
          .update({
            status,
            completed_at: status === "completed" || status === "failed" ? new Date().toISOString() : null,
            logs: [
              { ts: new Date().toISOString(), line: `Experiment status changed to ${status}` },
            ],
          })
          .eq("experiment_id", experiment_id)
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true, experiment: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "append_job_log": {
        const { job_id, line } = payload;
        const { data: job, error: getError } = await supabase
          .from("jobs")
          .select("id, logs")
          .eq("id", job_id)
          .eq("user_id", user.id)
          .single();
        if (getError) throw getError;
        const currentLogs = Array.isArray(job.logs) ? job.logs : [];
        const nextLogs = [...currentLogs, { ts: new Date().toISOString(), line }];
        const { error: updateError } = await supabase
          .from("jobs")
          .update({ logs: nextLogs })
          .eq("id", job_id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_job_status": {
        const { job_id, status } = payload;
        const { error } = await supabase
          .from("jobs")
          .update({
            status,
            completed_at: status === "completed" || status === "failed" ? new Date().toISOString() : null,
          })
          .eq("id", job_id)
          .eq("user_id", user.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "dispatch_spatial": {
        const { sprint, h5ad_path, reference_h5ad } = payload as {
          sprint?: string;
          h5ad_path?: string | null;
          reference_h5ad?: string | null;
        };
        const sprintKey = sprint ?? "sprint1";
        const now = new Date().toISOString();
        const { data: job, error } = await supabase
          .from("jobs")
          .insert({
            user_id: user.id,
            type: `spatial_${sprintKey}`,
            status: "queued",
            worker_version: "spatial-edge-dispatch-v1",
            logs: [
              {
                ts: now,
                line: `dispatch_spatial ${sprintKey} h5ad=${h5ad_path ?? "none"} ref=${reference_h5ad ?? "none"}`,
              },
            ],
          })
          .select("id")
          .single();
        if (error) throw error;

        const mlBase = Deno.env.get("ML_SPATIAL_API_URL")?.replace(/\/$/, "");
        if (mlBase) {
          const paths: Record<string, string> = {
            sprint1: "/run/spatial/qc-annotation",
            sprint2: "/run/spatial/niches",
            sprint3: "/run/spatial/label-transfer",
            sprint4: "/run/spatial/benchmark",
          };
          const path = paths[sprintKey] ?? paths.sprint1;
          const body =
            sprintKey === "sprint3"
              ? JSON.stringify({
                  spatial_h5ad: h5ad_path ?? null,
                  reference_h5ad: reference_h5ad ?? null,
                  ref_label_key: "cell_type",
                })
              : sprintKey === "sprint4"
                ? JSON.stringify({})
                : JSON.stringify({ h5ad_path: h5ad_path ?? null });
          try {
            await fetch(`${mlBase}${path}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });
          } catch (_e) {
            // Worker may be offline; job row still records intent
          }
        }

        return new Response(JSON.stringify({ success: true, job_id: job.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "launch_qc_job": {
        const { dataset_id, dataset_name } = payload;
        const now = new Date().toISOString();
        const logs = [
          { ts: now, line: `Queued MultiQC job for ${dataset_name}` },
          { ts: now, line: "Worker placeholder: parse metadata and prepare QC bundle" },
        ];
        const { data: qcJob, error } = await supabase
          .from("jobs")
          .insert({
            user_id: user.id,
            type: "qc",
            status: "queued",
            worker_version: "edge-orchestrator-v1",
            logs,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: datasetError } = await supabase
          .from("datasets")
          .update({
            metadata: {
              qc_job_id: qcJob.id,
              qc_status: "queued",
              qc_note: "Async MultiQC stub queued via orchestrator",
              last_qc_requested_at: now,
            },
          })
          .eq("id", dataset_id)
          .eq("user_id", user.id);
        if (datasetError) throw datasetError;
        return new Response(JSON.stringify({ success: true, job_id: qcJob.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
