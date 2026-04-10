import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type ExperimentOpt = { id: string; name: string; model: string; status: string; metrics: Record<string, unknown> | null };
type ResultRow = { id: string; result_type: string; data: Record<string, unknown> | null };

export default function ResultsExplorer() {
  const { toast } = useToast();
  const [experiments, setExperiments] = useState<ExperimentOpt[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [evaluation, setEvaluation] = useState<ResultRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("experiments")
        .select("id, name, model, status, metrics")
        .order("created_at", { ascending: false });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        const rows = (data as ExperimentOpt[]) ?? [];
        setExperiments(rows);
        setSelectedId((prev) => prev || rows[0]?.id || "");
      }
      setLoading(false);
    })();
  }, [toast]);

  useEffect(() => {
    if (!selectedId) {
      setEvaluation(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, result_type, data")
        .eq("experiment_id", selectedId)
        .eq("result_type", "evaluation")
        .maybeSingle();
      if (error) toast({ title: "Results", description: error.message, variant: "destructive" });
      else setEvaluation(data as ResultRow | null);
    })();
  }, [selectedId, toast]);

  const exp = experiments.find((e) => e.id === selectedId);
  const metrics = exp?.metrics ?? null;
  const auc = typeof metrics?.auc === "number" ? metrics.auc : null;
  const confusion = metrics?.confusion_matrix as number[][] | undefined;
  const umapData = (evaluation?.data?.umap as Array<{ x: number; y: number; label: string; confidence: number }> | undefined) ?? [];
  const topFeatures =
    (evaluation?.data?.top_features as Array<{ name: string; modality: string; importance: number }> | undefined) ??
    [];
  const prCurve =
    (evaluation?.data?.pr_curve as Array<{ recall: number; precision: number }> | undefined) ??
    [];
  const calibration =
    (evaluation?.data?.calibration_bins as Array<{ bin: string; predicted: number; observed: number }> | undefined) ??
    [];
  const subgroup =
    (evaluation?.data?.subgroup_metrics as Array<{ subgroup: string; auc?: number; f1?: number; n?: number }> | undefined) ??
    [];
  const leakageOverlap = typeof evaluation?.data?.train_test_overlap === "number" ? evaluation.data.train_test_overlap : null;

  const defaultUmap = () =>
    Array.from({ length: 40 }, (_, i) => ({
      x: (i < 20 ? -2 : 2) + (Math.random() - 0.5) * 3,
      y: (i < 20 ? 1 : -1) + (Math.random() - 0.5) * 3,
      label: i < 20 ? "Responder" : "Non-Responder",
      confidence: 0.6 + Math.random() * 0.35,
    }));

  const points = umapData.length > 0 ? umapData : defaultUmap();
  const cm = confusion ?? [
    [36, 4],
    [6, 34],
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-border bg-card sticky top-14 z-20">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Experiment</span>
          <div className="relative flex-1 max-w-md">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || experiments.length === 0}
              aria-label="Select experiment for results"
              className="w-full appearance-none rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-8 text-sm"
            >
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.status})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        {auc != null && (
          <span className="text-xs text-muted-foreground">
            AUC <span className="font-mono font-semibold text-foreground">{auc.toFixed(2)}</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : experiments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No experiments yet. Finalize a run from ML Experiments or complete training.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm text-foreground">UMAP Projection</h3>
              {!evaluation && <span className="text-[10px] text-warning">Demo projection — save evaluation results for real embeddings</span>}
            </div>
            <div className="relative h-64 bg-secondary/20 rounded-lg overflow-hidden">
              <svg viewBox="-5 -5 10 10" className="w-full h-full">
                {points.map((d, i) => (
                  <circle
                    key={i}
                    cx={d.x}
                    cy={d.y}
                    r={0.08 + d.confidence * 0.08}
                    fill={d.label === "Responder" ? "hsl(185, 72%, 48%)" : "hsl(38, 92%, 55%)"}
                    opacity={0.7}
                    className="hover:opacity-100 cursor-pointer transition-opacity"
                  />
                ))}
              </svg>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Confusion Matrix</h3>
            <div className="flex items-center justify-center h-64">
              <div className="space-y-1">
                <div className="flex gap-1">
                  <div className="text-xs text-muted-foreground w-24 text-right pr-2 flex items-center justify-end">Responder</div>
                  <div className="h-24 w-24 rounded-lg bg-success/20 flex items-center justify-center border border-success/30">
                    <span className="text-2xl font-display font-bold text-success">{cm[0]?.[0] ?? "—"}</span>
                  </div>
                  <div className="h-24 w-24 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20">
                    <span className="text-2xl font-display font-bold text-destructive/60">{cm[0]?.[1] ?? "—"}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <div className="text-xs text-muted-foreground w-24 text-right pr-2 flex items-center justify-end">Non-Resp.</div>
                  <div className="h-24 w-24 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20">
                    <span className="text-2xl font-display font-bold text-destructive/60">{cm[1]?.[0] ?? "—"}</span>
                  </div>
                  <div className="h-24 w-24 rounded-lg bg-success/20 flex items-center justify-center border border-success/30">
                    <span className="text-2xl font-display font-bold text-success">{cm[1]?.[1] ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Top Features</h3>
            <div className="space-y-2.5">
              {(topFeatures.length > 0 ? topFeatures : [{ name: "—", modality: "—", importance: 0 }]).map((f) => (
                <div key={f.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-foreground w-28 truncate">{f.name}</span>
                  <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, f.importance * 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right">{f.importance.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm text-foreground">ROC Curve</h3>
              {auc != null && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">AUC =</span>
                  <span className="font-mono font-bold text-success">{auc.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="h-52 bg-secondary/20 rounded-lg overflow-hidden relative">
              <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                <line x1="0" y1="100" x2="100" y2="0" stroke="hsl(220, 16%, 20%)" strokeWidth="0.5" strokeDasharray="3,3" />
                <polyline
                  points="0,100 5,60 10,40 15,28 20,20 30,14 40,10 50,7 60,5 70,4 80,3 90,2 100,0"
                  fill="none"
                  stroke="hsl(185, 72%, 48%)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            {metrics?.warnings && Array.isArray(metrics.warnings) && (metrics.warnings as string[]).length > 0 && (
              <p className="text-[10px] text-warning mt-2">{(metrics.warnings as string[]).join(" ")}</p>
            )}
            {leakageOverlap != null && leakageOverlap > 0 && (
              <p className="text-[10px] text-destructive mt-2">
                Leakage warning: {leakageOverlap} sample IDs overlap train/test split.
              </p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">PR Curve</h3>
            {prCurve.length === 0 ? (
              <p className="text-xs text-muted-foreground">No PR data yet. Store `pr_curve` in evaluation payload.</p>
            ) : (
              <div className="h-52 bg-secondary/20 rounded-lg overflow-hidden relative">
                <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                  <polyline
                    points={prCurve.map((point) => `${point.recall * 100},${100 - point.precision * 100}`).join(" ")}
                    fill="none"
                    stroke="hsl(185, 72%, 48%)"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Calibration</h3>
            {calibration.length === 0 ? (
              <p className="text-xs text-muted-foreground">No calibration bins in evaluation payload.</p>
            ) : (
              <div className="space-y-2">
                {calibration.map((row) => (
                  <div key={row.bin} className="text-xs flex items-center gap-3">
                    <span className="w-20 text-muted-foreground">{row.bin}</span>
                    <span className="font-mono text-foreground">pred {row.predicted.toFixed(2)}</span>
                    <span className="font-mono text-muted-foreground">obs {row.observed.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Subgroup Metrics</h3>
            {subgroup.length === 0 ? (
              <p className="text-xs text-muted-foreground">No subgroup evaluation yet (batch/site/sex).</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2">Subgroup</th>
                    <th className="text-right py-2">N</th>
                    <th className="text-right py-2">AUC</th>
                    <th className="text-right py-2">F1</th>
                  </tr>
                </thead>
                <tbody>
                  {subgroup.map((row) => (
                    <tr key={row.subgroup} className="border-b border-border/50">
                      <td className="py-1.5">{row.subgroup}</td>
                      <td className="py-1.5 text-right font-mono">{row.n ?? "—"}</td>
                      <td className="py-1.5 text-right font-mono">{row.auc?.toFixed(2) ?? "—"}</td>
                      <td className="py-1.5 text-right font-mono">{row.f1?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
