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

        return new Response(JSON.stringify({ success: true, experiment: data }), {
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
