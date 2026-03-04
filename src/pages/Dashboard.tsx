import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import {
  Database,
  FlaskConical,
  BarChart3,
  Clock,
  TrendingUp,
  Activity,
  FileText,
  ArrowRight,
} from "lucide-react";

const recentAnalyses = [
  { name: "TNBC_Discovery_Run1", model: "MLP Late Fusion", status: "completed" as const, auc: 0.89, date: "2h ago" },
  { name: "KRAS_Resistance_v3", model: "XGBoost", status: "running" as const, auc: null, date: "15m ago" },
  { name: "PanCancer_Subtype", model: "Random Forest", status: "completed" as const, auc: 0.84, date: "1d ago" },
  { name: "MetaboScreen_Pilot", model: "LightGBM", status: "failed" as const, auc: null, date: "2d ago" },
  { name: "BRCA_Biomarker_v2", model: "Neural Network", status: "queued" as const, auc: null, date: "3d ago" },
];

const systemStatus = [
  { name: "Compute Cluster", status: "Healthy", load: 42 },
  { name: "Storage (GCS)", status: "Healthy", load: 68 },
  { name: "ML Pipeline Queue", status: "2 pending", load: 35 },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Datasets" value={24} subtitle="3 modalities" icon={Database} trend={{ value: "+3 this week", positive: true }} index={0} />
        <StatCard title="Pipeline Runs" value={18} subtitle="2 active" icon={Activity} trend={{ value: "5 completed today", positive: true }} index={1} />
        <StatCard title="ML Experiments" value={42} subtitle="Best AUC: 0.92" icon={FlaskConical} trend={{ value: "+12% accuracy", positive: true }} index={2} />
        <StatCard title="XAI Reports" value={15} subtitle="3 pending review" icon={BarChart3} index={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Analyses */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="font-display font-semibold text-foreground">Recent Analyses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest ML experiment runs</p>
            </div>
            <button className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentAnalyses.map((analysis) => (
              <div key={analysis.name} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors cursor-pointer">
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
                  {analysis.auc && (
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold text-foreground">{analysis.auc.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">AUC</p>
                    </div>
                  )}
                  <StatusBadge status={analysis.status} />
                  <span className="text-xs text-muted-foreground w-14 text-right">{analysis.date}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* System Status + Quick Actions */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 className="font-display font-semibold text-foreground mb-4">System Status</h2>
            <div className="space-y-3">
              {systemStatus.map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.name}</span>
                    <span className="text-xs font-medium text-success">{s.status}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: `${s.load}%` }}
                    />
                  </div>
                </div>
              ))}
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
                { label: "Upload Dataset", icon: Database },
                { label: "New Pipeline Run", icon: Activity },
                { label: "Launch Experiment", icon: FlaskConical },
                { label: "Generate Report", icon: FileText },
              ].map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-secondary-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <action.icon className="h-4 w-4 text-primary" />
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
