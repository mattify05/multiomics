import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EdgeClient = any;

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

const nowIso = () => new Date().toISOString();

async function appendJobLogs(
  supabase: EdgeClient,
  jobId: string,
  entries: Array<{ ts: string; line: string }>,
  userId?: string,
) {
  let query = supabase.from("jobs").select("logs").eq("id", jobId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.single();
  if (error) throw error;

  const currentLogs = Array.isArray((data as { logs?: unknown[] } | null)?.logs)
    ? ((data as { logs?: unknown[] }).logs ?? [])
    : [];
  let updateQuery = supabase
    .from("jobs")
    .update({ logs: [...currentLogs, ...entries], updated_at: nowIso() })
    .eq("id", jobId);

  if (userId) updateQuery = updateQuery.eq("user_id", userId);

  const { error: updateError } = await updateQuery;
  if (updateError) throw updateError;
}

async function markExperimentDispatchFailed(
  supabase: EdgeClient,
  userId: string,
  experimentId: string,
  jobId: string,
  message: string,
) {
  const ts = nowIso();
  await appendJobLogs(supabase, jobId, [{ ts, line: message }], userId);
  const { error: jobError } = await supabase
    .from("jobs")
    .update({ status: "failed", updated_at: ts })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (jobError) throw jobError;

  const { error: experimentError } = await supabase
    .from("experiments")
    .update({
      status: "failed",
      completed_at: ts,
      metrics: { error: message },
    })
    .eq("id", experimentId)
    .eq("user_id", userId);
  if (experimentError) throw experimentError;
}

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
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
            status: "queued",
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
            status: "queued",
            experiment_id: experiment.id,
            pipeline_run_id: pipeline_run_id ?? null,
            worker_version: "edge-orchestrator-v1",
            logs: [{ ts: nowIso(), line: `Experiment ${name} queued for model ${model}` }],
          })
          .select("id")
          .single();

        if (jobError) throw jobError;

        const mlTrainUrl = Deno.env.get("ML_TRAINING_WEBHOOK_URL")?.trim();
        const mlTrainSecret = Deno.env.get("ML_TRAINING_WEBHOOK_SECRET")?.trim();

        if (!job?.id) {
          throw new Error("Experiment job could not be created");
        }

        if (!mlTrainUrl || !mlTrainSecret) {
          await markExperimentDispatchFailed(
            supabase,
            user.id,
            experiment.id,
            job.id,
            "Training webhook is not configured on the backend",
          );
        } else {
          waitUntil((async () => {
            const ts0 = nowIso();
            try {
              await appendJobLogs(supabase, job.id, [{ ts: ts0, line: `Dispatching training webhook to ${mlTrainUrl}` }], user.id);

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 45000);
              try {
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
                const ts1 = nowIso();

                if (!resp.ok) {
                  const bodyText = await resp.text().catch(() => "<unreadable body>");
                  const snippet = bodyText.slice(0, 500);
                  await markExperimentDispatchFailed(
                    supabase,
                    user.id,
                    experiment.id,
                    job.id,
                    `Webhook dispatch failed: HTTP ${resp.status} ${resp.statusText} — ${snippet}`,
                  );
                  return;
                }

                await appendJobLogs(supabase, job.id, [{ ts: ts1, line: `Webhook accepted (HTTP ${resp.status})` }], user.id);
              } finally {
                clearTimeout(timeoutId);
              }
            } catch (err) {
              const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
              await markExperimentDispatchFailed(
                supabase,
                user.id,
                experiment.id,
                job.id,
                `Webhook dispatch error: ${msg}`,
              );
            }
          })());
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
        if (status === "running") {
          updateData.started_at = nowIso();
        }
        if (status === "completed" || status === "failed") {
          updateData.completed_at = nowIso();
        }

        const { data, error } = await supabase
          .from("experiments")
          .update(updateData)
          .eq("id", experiment_id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        const jobStatusUpdate: Record<string, unknown> = { status, updated_at: nowIso() };
        if (status === "running") {
          jobStatusUpdate.started_at = nowIso();
        }
        await supabase
          .from("jobs")
          .update(jobStatusUpdate)
          .eq("experiment_id", experiment_id)
          .eq("user_id", user.id);

        const { data: relatedJobs, error: relatedJobsError } = await supabase
          .from("jobs")
          .select("id")
          .eq("experiment_id", experiment_id)
          .eq("user_id", user.id);
        if (relatedJobsError) throw relatedJobsError;

        await Promise.all((relatedJobs ?? []).map((job) =>
          appendJobLogs(supabase, job.id, [{ ts: nowIso(), line: `Experiment status changed to ${status}` }], user.id)
        ));

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
        await appendJobLogs(supabase, job.id, [{ ts: nowIso(), line }], user.id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_job_status": {
        const { job_id, status } = payload;
        const updateData: Record<string, unknown> = { status, updated_at: nowIso() };
        if (status === "running") {
          updateData.started_at = nowIso();
        }

        const { error } = await supabase
          .from("jobs")
          .update(updateData)
          .eq("id", job_id)
          .eq("user_id", user.id);
        if (error) throw error;

        await appendJobLogs(supabase, job_id, [{ ts: nowIso(), line: `Job status changed to ${status}` }], user.id);
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
