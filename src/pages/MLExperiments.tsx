import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";
import { FlaskConical, Play, ChevronDown, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { invokePipelineOrchestrator } from "@/lib/orchestrator";
import { finalizeExperimentWithDemoArtifacts } from "@/lib/demoArtifacts";
import { formatRelativeTime } from "@/lib/format";
import { buildModelCardMarkdown } from "@/lib/demoArtifacts";
import { buildReproduceNotebookCell } from "@/lib/notebookExport";

const modelCatalogue = [
  { name: "MLP Late Fusion", type: "Classification", desc: "Multi-layer perceptron with modality-specific encoders" },
  { name: "XGBoost", type: "Classification", desc: "Gradient boosted trees for tabular data" },
  { name: "LightGBM", type: "Regression", desc: "Light gradient boosting machine" },
  { name: "Random Forest", type: "Classification", desc: "Ensemble of decision trees" },
  { name: "Cox PH", type: "Survival", desc: "Cox proportional hazards regression" },
  { name: "AutoML", type: "Auto", desc: "Optuna-powered hyperparameter search" },
];

const typeColors: Record<string, string> = {
  Classification: "bg-info/15 text-info border-info/30",
  Regression: "bg-warning/15 text-warning border-warning/30",
  Survival: "bg-destructive/15 text-destructive border-destructive/30",
  Auto: "bg-primary/15 text-primary border-primary/30",
};

type PipelineRun = { id: string; name: string; status: string; dataset_ids: string[] | null };
type ExperimentRow = {
  id: string;
  name: string;
  model: string;
  status: string;
  metrics: Record<string, unknown> | null;
  pipeline_run_id: string | null;
  created_at: string;
  hyperparameters: Record<string, unknown> | null;
};

function normalizeExperimentStatus(s: string): "running" | "completed" | "failed" | "queued" | "pending" | "draft" {
  if (s === "running" || s === "completed" || s === "failed" || s === "queued" || s === "pending" || s === "draft") return s;
  return "queued";
}

export default function MLExperiments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<PipelineRun[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | "">("");
  const [selectedModel, setSelectedModel] = useState("XGBoost");
  const [experimentName, setExperimentName] = useState("");
  const [targetVariable, setTargetVariable] = useState("response_label");
  const [trainTestSplit, setTrainTestSplit] = useState("80/20");
  const [launching, setLaunching] = useState(false);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [selectedRunForChart, setSelectedRunForChart] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [pr, ex] = await Promise.all([
      supabase.from("pipeline_runs").select("id, name, status, dataset_ids").order("created_at", { ascending: false }),
      supabase.from("experiments").select("id, name, model, status, metrics, pipeline_run_id, created_at, hyperparameters").order("created_at", { ascending: false }),
    ]);
    if (pr.error) toast({ title: "Pipelines", description: pr.error.message, variant: "destructive" });
    if (ex.error) toast({ title: "Experiments", description: ex.error.message, variant: "destructive" });
    setPipelines((pr.data as PipelineRun[]) ?? []);
    setExperiments((ex.data as ExperimentRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (!selectedPipelineId && pipelines.length > 0) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  useEffect(() => {
    const running = experiments.find((e) => e.status === "running");
    setSelectedRunForChart(running?.id ?? experiments[0]?.id ?? null);
  }, [experiments]);

  const handleLaunch = async () => {
    if (!user) return;
    const name = experimentName.trim() || `exp_${selectedModel}_${Date.now().toString(36)}`;
    const hyperparameters: Record<string, unknown> = {
      target_variable: targetVariable,
      feature_selection: "All modalities — Top 500",
      train_test_split: trainTestSplit,
      automl: false,
      seed: 42,
      cv_strategy: "5-fold CV (recommended)",
    };
    setLaunching(true);
    try {
      await invokePipelineOrchestrator(supabase, {
        action: "launch_experiment",
        name,
        model: selectedModel,
        hyperparameters,
        pipeline_run_id: selectedPipelineId || null,
      });
      toast({ title: "Experiment started", description: name });
      setExperimentName("");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not launch";
      toast({ title: "Launch failed", description: msg, variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  const handleFinalizeDemo = async (exp: ExperimentRow) => {
    if (!user) return;
    setFinalizingId(exp.id);
    try {
      await finalizeExperimentWithDemoArtifacts(supabase, { experimentId: exp.id, userId: user.id });
      toast({ title: "Artifacts saved", description: "Evaluation + XAI results stored. Open Results / XAI Reports." });
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Finalize failed";
      toast({ title: "Finalize failed", description: msg, variant: "destructive" });
    } finally {
      setFinalizingId(null);
    }
  };

  const downloadModelCard = (exp: ExperimentRow) => {
    const md = buildModelCardMarkdown({
      experimentName: exp.name,
      model: exp.model,
      metrics: exp.metrics,
      hyperparameters: exp.hyperparameters,
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model_card_${exp.name.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadNotebook = () => {
    const pip = pipelines.find((p) => p.id === selectedPipelineId);
    const nb = buildReproduceNotebookCell({
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
      experimentName: experimentName || "my_experiment",
      pipelineConfigSummary: JSON.stringify(pip ?? {}, null, 2),
    });
    const blob = new Blob([nb], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reproduce_experiment.ipynb";
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartExperiment = experiments.find((e) => e.id === selectedRunForChart);

  return (
    <div className="p-6 animate-fade-in">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Pipeline Run</h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pipelines.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pipeline runs. Create one in Pipeline Builder.</p>
            ) : (
              <div className="relative">
                <select
                  value={selectedPipelineId}
                  onChange={(e) => setSelectedPipelineId(e.target.value)}
                  aria-label="Select pipeline run"
                  className="w-full appearance-none rounded-md border border-border bg-secondary/50 px-3 py-2 pr-8 text-sm text-foreground"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground">Model Catalogue</h3>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {modelCatalogue.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setSelectedModel(m.name)}
                  className={`rounded-lg border p-3 text-left transition-all group ${
                    selectedModel === m.name ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-foreground">{m.name}</span>
                  </div>
                  <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${typeColors[m.type]}`}>{m.type}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground">Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Experiment name</label>
                <input
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                  placeholder="my_experiment_v1"
                />
              </div>
              <div>
                <label htmlFor="ml-target-variable" className="text-xs font-medium text-muted-foreground">
                  Target Variable
                </label>
                <input
                  id="ml-target-variable"
                  value={targetVariable}
                  onChange={(e) => setTargetVariable(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Train/Test Split</label>
                <input
                  value={trainTestSplit}
                  onChange={(e) => setTrainTestSplit(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                  placeholder="80/20"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={launching || !user}
              className="w-full mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Launch Training
            </button>
            <button
              type="button"
              onClick={downloadNotebook}
              className="w-full rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary"
            >
              Export Jupyter stub
            </button>
          </div>
        </div>

        <div className="col-span-8">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-display font-semibold text-foreground">Experiment Runs</h3>
              <button
                type="button"
                onClick={() => load()}
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20">
                      <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                      <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">AUC</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">F1</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Age</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {experiments.map((run) => {
                      const m = run.metrics as Record<string, unknown> | null;
                      const auc = typeof m?.auc === "number" ? m.auc : null;
                      const f1 = typeof m?.f1 === "number" ? m.f1 : null;
                      return (
                        <tr
                          key={run.id}
                          className={`hover:bg-secondary/20 transition-colors cursor-pointer ${selectedRunForChart === run.id ? "bg-secondary/10" : ""}`}
                          onClick={() => setSelectedRunForChart(run.id)}
                        >
                          <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">{run.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{run.model}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={normalizeExperimentStatus(run.status)} />
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-foreground">{auc?.toFixed(2) ?? "—"}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-foreground">{f1?.toFixed(2) ?? "—"}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-muted-foreground">{formatRelativeTime(run.created_at)}</td>
                          <td className="px-4 py-3 text-right space-x-1">
                            {run.status === "running" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFinalizeDemo(run);
                                }}
                                disabled={finalizingId === run.id}
                                className="text-[10px] rounded border border-border px-2 py-1 hover:bg-secondary"
                              >
                                {finalizingId === run.id ? "…" : "Finalize demo"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadModelCard(run);
                              }}
                              className="text-[10px] rounded border border-border px-2 py-1 hover:bg-secondary"
                            >
                              Model card
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 rounded-xl border border-border bg-card p-6"
          >
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">
              Training progress {chartExperiment ? `— ${chartExperiment.name}` : ""}
            </h3>
            {!chartExperiment ? (
              <p className="text-sm text-muted-foreground">Select an experiment row. When status is running, use a real training worker to stream metrics here.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {Array.from({ length: 20 }, (_, i) => {
                  const height =
                    chartExperiment.status === "completed"
                      ? 40 + ((i * 13) % 37)
                      : chartExperiment.status === "running"
                        ? 25 + ((i * 17) % 50)
                        : 20 + ((i * 11) % 30);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-primary/30 hover:bg-primary/50 transition-colors"
                      style={{ height: `${Math.min(height, 100)}%` }}
                    />
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
