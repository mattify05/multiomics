import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import {
  Database,
  FlaskConical,
  BarChart3,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format";
import { Link } from "react-router-dom";
import { resolveExecutionBackendFromEnv } from "@/lib/executionBackend";
import { useMemo } from "react";
function normalizeExperimentStatus(s: string): "running" | "completed" | "failed" | "queued" | "pending" | "draft" {
  if (s === "running" || s === "completed" || s === "failed" || s === "queued" || s === "pending" || s === "draft") return s;
  return "queued";
}

export default function Dashboard() {
  const backend = useMemo(() => resolveExecutionBackendFromEnv(), []);

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [datasetsRes, runsRes, experimentsRes, xaiCountRes, jobsRes] =
        await Promise.all([
          supabase.from("datasets").select("id, modality", { count: "exact" }),
          supabase.from("pipeline_runs").select("id, status", { count: "exact" }),
          supabase.from("experiments").select("id, metrics", { count: "exact" }),
          supabase.from("results").select("id", { count: "exact", head: true }).eq("result_type", "xai_report"),
          supabase.from("jobs").select("id, status", { count: "exact" }),
        ]);

      if (datasetsRes.error) throw datasetsRes.error;
      if (runsRes.error) throw runsRes.error;
      if (experimentsRes.error) throw experimentsRes.error;
      if (jobsRes.error) throw jobsRes.error;

      const datasets = datasetsRes.data ?? [];
      const runs = runsRes.data ?? [];
      const experiments = experimentsRes.data ?? [];
      const jobs = jobsRes.data ?? [];

      const modalities = new Set(datasets.map((d) => d.modality));
      const activeRuns = runs.filter((r) => r.status === "running" || r.status === "pending" || r.status === "queued").length;
      const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "pending" || j.status === "queued").length;
      let bestAuc: number | null = null;
      for (const e of experiments) {
        const m = e.metrics as Record<string, unknown> | null;
        const auc = typeof m?.auc === "number" ? m.auc : null;
        if (auc != null && (bestAuc == null || auc > bestAuc)) bestAuc = auc;
      }
      return {
        datasetCount: datasetsRes.count ?? 0,
        modalityCount: modalities.size,
        runCount: runsRes.count ?? 0,
        activeRuns,
        expCount: experimentsRes.count ?? 0,
        bestAuc,
        xaiCount: xaiCountRes.count ?? 0,
        jobCount: jobsRes.count ?? 0,
        activeJobs,
      };
    },
  });

  const recentExperimentsQuery = useQuery({
    queryKey: ["dashboard-recent-experiments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("experiments")
        .select("id, name, model, status, metrics, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const q = statsQuery.data;
  const loading = statsQuery.isLoading || recentExperimentsQuery.isLoading;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Datasets"
          value={loading ? "…" : q?.datasetCount ?? 0}
          subtitle={loading ? undefined : `${q?.modalityCount ?? 0} modalities`}
          icon={Database}
          trend={undefined}
          index={0}
        />
        <StatCard
          title="Pipeline Runs"
          value={loading ? "…" : q?.runCount ?? 0}
          subtitle={loading ? undefined : `${q?.activeRuns ?? 0} active`}
          icon={Activity}
          trend={undefined}
          index={1}
        />
        <StatCard
          title="ML Experiments"
          value={loading ? "…" : q?.expCount ?? 0}
          subtitle={
            loading
              ? undefined
              : q?.bestAuc != null
                ? `Best AUC: ${q.bestAuc.toFixed(2)}`
                : "No metrics yet"
          }
          icon={FlaskConical}
          trend={undefined}
          index={2}
        />
        <StatCard
          title="Jobs"
          value={loading ? "…" : q?.jobCount ?? 0}
          subtitle={loading ? undefined : `${q?.activeJobs ?? 0} active · ${q?.xaiCount ?? 0} XAI reports`}
          icon={BarChart3}
          index={3}
        />
      </div>

      {statsQuery.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Could not load dashboard stats: {(statsQuery.error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="font-display font-semibold text-foreground">Recent Analyses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest ML experiment runs (from your workspace)</p>
            </div>
            <Link to="/experiments" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentExperimentsQuery.isError && (
              <div className="p-4 text-sm text-destructive">Could not load experiments.</div>
            )}
            {!recentExperimentsQuery.isError && (recentExperimentsQuery.data?.length ?? 0) === 0 && !recentExperimentsQuery.isLoading && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No experiments yet. Launch one from <Link to="/experiments" className="text-primary underline">ML Experiments</Link>.
              </div>
            )}
            {recentExperimentsQuery.data?.map((analysis) => {
              const m = analysis.metrics as Record<string, unknown> | null;
              const auc = typeof m?.auc === "number" ? m.auc : null;
              return (
                <Link key={analysis.id} to="/results" className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{analysis.name}</p>
                      <p className="text-xs text-muted-foreground">{analysis.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {auc != null && (
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold text-foreground">{auc.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">AUC</p>
                      </div>
                    )}
                    <StatusBadge status={normalizeExperimentStatus(analysis.status)} />
                    <span className="text-xs text-muted-foreground w-14 text-right">{formatRelativeTime(analysis.created_at)}</span>
                  </div>
                </Link>
              );
            })}
            {recentExperimentsQuery.isLoading && (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading experiments…</div>
            )}
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 className="font-display font-semibold text-foreground mb-4">Compute</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Execution backend</span>
                  <span className="text-xs font-medium text-foreground">{backend.kind}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{backend.description}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Active pipeline runs</span>
                  <span className="text-xs font-medium text-success">{loading ? "…" : `${q?.activeRuns ?? 0}`}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${Math.min(100, ((q?.activeRuns ?? 0) / Math.max(1, q?.runCount ?? 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 className="font-display font-semibold text-foreground mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "Upload Dataset", icon: Database, to: "/data" },
                { label: "New Pipeline Run", icon: Activity, to: "/pipeline" },
                { label: "Launch Experiment", icon: FlaskConical, to: "/experiments" },
                { label: "View Results", icon: BarChart3, to: "/results" },
              ].map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-secondary-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <action.icon className="h-4 w-4 text-primary" />
                  {action.label}
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
