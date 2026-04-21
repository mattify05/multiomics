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
        const { name, model, hyperparameters, pipeline_run_id, dataset_ids } = payload as {
          name: string;
          model: string;
          hyperparameters?: Record<string, unknown>;
          pipeline_run_id?: string | null;
          dataset_ids?: string[];
        };

        const mergedHyperparameters: Record<string, unknown> = {
          ...(hyperparameters && typeof hyperparameters === "object" ? hyperparameters : {}),
        };
        if (Array.isArray(dataset_ids) && dataset_ids.length > 0) {
          mergedHyperparameters.dataset_ids = dataset_ids;
        }

        const { data: experiment, error } = await supabase
          .from("experiments")
          .insert({
            user_id: user.id,
            name,
            model,
            hyperparameters: mergedHyperparameters,
            pipeline_run_id,
            status: "running",
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .insert({
            user_id: user.id,
            type: "experiment",
            status: "running",
            experiment_id: experiment.id,
            pipeline_run_id: pipeline_run_id ?? null,
            started_at: new Date().toISOString(),
            worker_version: "edge-orchestrator-v1",
            logs: [{ ts: new Date().toISOString(), line: `Experiment ${name} started for model ${model}` }],
          })
          .select("id")
          .single();

        if (jobError) throw jobError;

        const mlTrainUrl = Deno.env.get("ML_TRAINING_WEBHOOK_URL")?.trim();
        const mlTrainSecret = Deno.env.get("ML_TRAINING_WEBHOOK_SECRET")?.trim();
        if (mlTrainUrl && mlTrainSecret && job?.id) {
          const dispatchLog: { ts: string; line: string }[] = [];
          const ts0 = new Date().toISOString();
          dispatchLog.push({ ts: ts0, line: `Dispatching training webhook to ${mlTrainUrl}` });
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const resp = await fetch(mlTrainUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Training-Webhook-Secret": mlTrainSecret,
              },
              body: JSON.stringify({
                experiment_id: experiment.id,
                job_id: job.id,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const ts1 = new Date().toISOString();
            if (!resp.ok) {
              const bodyText = await resp.text().catch(() => "<unreadable body>");
              const snippet = bodyText.slice(0, 500);
              dispatchLog.push({
                ts: ts1,
                line: `Webhook dispatch failed: HTTP ${resp.status} ${resp.statusText} — ${snippet}`,
              });
              await supabase
                .from("jobs")
                .update({
                  status: "failed",
                  logs: [
                    { ts: ts0, line: `Experiment ${name} started for model ${model}` },
                    ...dispatchLog,
                  ],
                })
                .eq("id", job.id);
              await supabase
                .from("experiments")
                .update({ status: "failed", completed_at: ts1 })
                .eq("id", experiment.id);
            } else {
              dispatchLog.push({ ts: ts1, line: `Webhook accepted (HTTP ${resp.status})` });
              await supabase
                .from("jobs")
                .update({
                  logs: [
                    { ts: ts0, line: `Experiment ${name} started for model ${model}` },
                    ...dispatchLog,
                  ],
                })
                .eq("id", job.id);
            }
          } catch (err) {
            const tsErr = new Date().toISOString();
            const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            dispatchLog.push({ ts: tsErr, line: `Webhook dispatch error: ${msg}` });
            await supabase
              .from("jobs")
              .update({
                status: "failed",
                logs: [
                  { ts: ts0, line: `Experiment ${name} started for model ${model}` },
                  ...dispatchLog,
                ],
              })
              .eq("id", job.id);
            await supabase
              .from("experiments")
              .update({ status: "failed", completed_at: tsErr })
              .eq("id", experiment.id);
          }
        }

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
        const {
          sprint,
          h5ad_path,
          reference_h5ad,
          ref_label_key,
          max_obs,
          random_seed,
          profile,
          spatial_max_obs,
          spatial_random_seed,
          min_shared_genes,
          train_h5ad_path,
          test_h5ad_path,
          platform_train,
          platform_test,
          in_domain_f1,
          ood_f1,
        } = payload as {
          sprint?: string;
          h5ad_path?: string | null;
          reference_h5ad?: string | null;
          ref_label_key?: string | null;
          max_obs?: number | null;
          random_seed?: number | null;
          profile?: string | null;
          spatial_max_obs?: number | null;
          spatial_random_seed?: number | null;
          min_shared_genes?: number | null;
          train_h5ad_path?: string | null;
          test_h5ad_path?: string | null;
          platform_train?: string | null;
          platform_test?: string | null;
          in_domain_f1?: number | null;
          ood_f1?: number | null;
        };
        const sprintKey = sprint ?? "sprint1";
        const requestId = crypto.randomUUID();
        const now = new Date().toISOString();
        const { data: job, error } = await supabase
          .from("jobs")
          .insert({
            user_id: user.id,
            type: `spatial_${sprintKey}`,
            status: "queued",
            worker_version: "spatial-edge-dispatch-v2",
            logs: [
              {
                ts: now,
                request_id: requestId,
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
                  ref_label_key: ref_label_key ?? "cell_type",
                  spatial_max_obs: spatial_max_obs ?? null,
                  spatial_random_seed: spatial_random_seed ?? 0,
                  min_shared_genes: min_shared_genes ?? 500,
                })
              : sprintKey === "sprint4"
                ? JSON.stringify({
                    platform_train: platform_train ?? "10x_visium",
                    platform_test: platform_test ?? "stereo_seq",
                    in_domain_f1: in_domain_f1 ?? 0.82,
                    ood_f1: ood_f1 ?? 0.61,
                    train_h5ad_path: train_h5ad_path ?? null,
                    test_h5ad_path: test_h5ad_path ?? null,
                  })
                : JSON.stringify({
                    h5ad_path: h5ad_path ?? null,
                    max_obs: max_obs ?? null,
                    random_seed: random_seed ?? 0,
                    profile: profile === "fast" ? "fast" : "default",
                  });
          try {
            await fetch(`${mlBase}${path}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-request-id": requestId,
              },
              body,
            });
          } catch (_e) {
            // Worker may be offline; job row still records intent
          }
        }

        return new Response(JSON.stringify({ success: true, job_id: job.id, request_id: requestId }), {
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
