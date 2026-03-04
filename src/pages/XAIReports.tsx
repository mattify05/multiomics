import { motion } from "framer-motion";
import { Download, ChevronDown, ExternalLink } from "lucide-react";

const shapFeatures = [
  { name: "EGFR", shap: 0.42, direction: "positive" },
  { name: "phospho-AKT", shap: 0.38, direction: "positive" },
  { name: "TP53_mut", shap: 0.31, direction: "positive" },
  { name: "BRCA1_expr", shap: 0.28, direction: "negative" },
  { name: "ceramide_C16", shap: 0.24, direction: "positive" },
  { name: "HER2_prot", shap: 0.21, direction: "positive" },
  { name: "MYC_expr", shap: 0.19, direction: "negative" },
  { name: "sphingomyelin", shap: 0.17, direction: "positive" },
  { name: "PIK3CA_mut", shap: 0.15, direction: "positive" },
  { name: "lactate_level", shap: 0.13, direction: "negative" },
];

const pathways = [
  { name: "PI3K/AKT/mTOR Signaling", genes: 12, fdr: 0.003, shapRank: 1 },
  { name: "EGFR Signaling", genes: 8, fdr: 0.008, shapRank: 2 },
  { name: "p53 Pathway", genes: 6, fdr: 0.015, shapRank: 4 },
  { name: "Sphingolipid Metabolism", genes: 5, fdr: 0.022, shapRank: 6 },
  { name: "MAPK Cascade", genes: 9, fdr: 0.031, shapRank: 3 },
  { name: "Apoptosis", genes: 4, fdr: 0.045, shapRank: 7 },
];

export default function XAIReports() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">TNBC_MLP_v1 — Explainability Report</h2>
          <p className="text-xs text-muted-foreground mt-0.5">MLP Late Fusion • AUC 0.89 • 438 samples • Generated 2h ago</p>
        </div>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">
          <Download className="h-4 w-4" /> Export PDF Report
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Global SHAP Bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold text-sm text-foreground mb-4">Global SHAP — Mean |SHAP| (Top 10)</h3>
          <div className="space-y-2">
            {shapFeatures.map((f) => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-foreground w-28 truncate">{f.name}</span>
                <div className="flex-1 h-4 rounded bg-secondary overflow-hidden relative">
                  <div
                    className={`h-full rounded ${f.direction === "positive" ? "bg-primary/50" : "bg-warning/50"}`}
                    style={{ width: `${(f.shap / 0.42) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{f.shap.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-primary/50" /> Increases prediction</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-warning/50" /> Decreases prediction</span>
          </div>
        </motion.div>

        {/* Sample Waterfall */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Sample Waterfall</h3>
            <div className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
              Sample: TCGA-A2-A0T2 <ChevronDown className="h-3 w-3" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground mb-2">
              Base value: <span className="font-mono text-foreground">0.45</span> → Prediction: <span className="font-mono text-success font-semibold">0.91 (Responder)</span>
            </div>
            {shapFeatures.slice(0, 6).map((f, i) => (
              <div key={f.name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-24 text-right truncate">{f.name}</span>
                <div className="flex-1 h-3 relative">
                  <div
                    className={`absolute h-full rounded ${f.direction === "positive" ? "bg-primary/40" : "bg-warning/40"}`}
                    style={{
                      left: f.direction === "positive" ? `${50 - f.shap * 50}%` : `${50}%`,
                      width: `${f.shap * 50}%`,
                    }}
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground w-10">
                  {f.direction === "positive" ? "+" : "-"}{f.shap.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pathway Overlay */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Pathway Enrichment Overlay (KEGG/Reactome)</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>FDR &lt; 0.05 highlighted</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pathway</th>
                  <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Gene Set Size</th>
                  <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">FDR</th>
                  <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">SHAP Rank</th>
                  <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Enrichment</th>
                  <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pathways.map((p) => (
                  <tr key={p.name} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-right text-muted-foreground">{p.genes}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-sm font-mono font-medium ${p.fdr < 0.01 ? "text-success" : p.fdr < 0.05 ? "text-warning" : "text-muted-foreground"}`}>
                        {p.fdr.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono text-right text-foreground">#{p.shapRank}</td>
                    <td className="px-4 py-2.5">
                      <div className="h-2 rounded-full bg-secondary w-24 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${(1 / p.fdr) / 400 * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="text-primary hover:text-primary/80">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
