import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";
import { FlaskConical, Play, ChevronDown, BarChart3, Layers } from "lucide-react";

const modelCatalogue = [
  { name: "MLP Late Fusion", type: "Classification", desc: "Multi-layer perceptron with modality-specific encoders" },
  { name: "XGBoost", type: "Classification", desc: "Gradient boosted trees for tabular data" },
  { name: "LightGBM", type: "Regression", desc: "Light gradient boosting machine" },
  { name: "Random Forest", type: "Classification", desc: "Ensemble of decision trees" },
  { name: "Cox PH", type: "Survival", desc: "Cox proportional hazards regression" },
  { name: "AutoML", type: "Auto", desc: "Optuna-powered hyperparameter search" },
];

const experimentRuns = [
  { name: "TNBC_MLP_v1", model: "MLP Late Fusion", status: "completed" as const, auc: 0.89, f1: 0.85, runtime: "28m", date: "2h ago" },
  { name: "TNBC_XGB_v1", model: "XGBoost", status: "running" as const, auc: null, f1: null, runtime: "12m", date: "15m ago" },
  { name: "TNBC_RF_baseline", model: "Random Forest", status: "completed" as const, auc: 0.82, f1: 0.79, runtime: "8m", date: "5h ago" },
  { name: "TNBC_AutoML_50t", model: "AutoML", status: "completed" as const, auc: 0.91, f1: 0.87, runtime: "45m", date: "1d ago" },
];

const typeColors: Record<string, string> = {
  Classification: "bg-info/15 text-info border-info/30",
  Regression: "bg-warning/15 text-warning border-warning/30",
  Survival: "bg-destructive/15 text-destructive border-destructive/30",
  Auto: "bg-primary/15 text-primary border-primary/30",
};

export default function MLExperiments() {
  return (
    <div className="p-6 animate-fade-in">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel — Config */}
        <div className="col-span-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Pipeline Run</h3>
            <div className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
              <span>TNBC_Discovery_Run1 — 438 samples</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground">Model Catalogue</h3>
            <div className="grid grid-cols-2 gap-2">
              {modelCatalogue.map((m) => (
                <button key={m.name} className="rounded-lg border border-border bg-secondary/30 p-3 text-left hover:border-primary/30 hover:bg-secondary transition-all group">
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
                <label className="text-xs font-medium text-muted-foreground">Target Variable</label>
                <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                  <span>response_label</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Feature Selection</label>
                <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                  <span>All modalities — Top 500</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Train/Test Split</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-4/5 bg-primary rounded-full" />
                  </div>
                  <span className="text-xs font-mono text-foreground">80/20</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">AutoML (Optuna)</label>
                <div className="h-5 w-9 rounded-full bg-primary/30 relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-primary transition-transform" />
                </div>
              </div>
            </div>
            <button className="w-full mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <Play className="h-4 w-4" /> Launch Training
            </button>
          </div>
        </div>

        {/* Right Panel — Experiment Tracker */}
        <div className="col-span-8">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-display font-semibold text-foreground">Experiment Runs</h3>
              <button className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Compare Selected
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">AUC</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">F1</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Runtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {experimentRuns.map((run) => (
                  <tr key={run.name} className="hover:bg-secondary/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">{run.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{run.model}</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-sm font-mono text-right text-foreground">{run.auc?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-mono text-right text-foreground">{run.f1?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-mono text-right text-muted-foreground">{run.runtime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Metric Visualization Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 rounded-xl border border-border bg-card p-6"
          >
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Training Progress — TNBC_XGB_v1</h3>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 20 }, (_, i) => {
                const height = 30 + Math.random() * 60 + i * 2;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-primary/30 hover:bg-primary/50 transition-colors"
                    style={{ height: `${Math.min(height, 100)}%` }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>Epoch 1</span>
              <span>Epoch 20</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
