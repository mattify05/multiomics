import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { reactomeSearchUrl, stringProteinSearchUrl } from "@/lib/reactomeLinks";
import { buildModelCardMarkdown } from "@/lib/demoArtifacts";

type ExperimentOpt = {
  id: string;
  name: string;
  model: string;
  status: string;
  metrics: Record<string, unknown> | null;
  created_at: string;
  hyperparameters: Record<string, unknown> | null;
};

type ShapRow = {
  name: string;
  shap: number;
  direction: "positive" | "negative";
  feature_id?: string;
  gene_symbol?: string;
  uniprot?: string;
  hmdb?: string;
};
type PathwayRow = { name: string; genes: number; fdr: number; shapRank: number };

const defaultShap: ShapRow[] = [
  { name: "EGFR", shap: 0.42, direction: "positive" },
  { name: "phospho-AKT", shap: 0.38, direction: "positive" },
];

const defaultPathways: PathwayRow[] = [
  { name: "PI3K/AKT/mTOR Signaling", genes: 12, fdr: 0.003, shapRank: 1 },
  { name: "EGFR Signaling", genes: 8, fdr: 0.008, shapRank: 2 },
];

export default function XAIReports() {
  const { toast } = useToast();
  const [experiments, setExperiments] = useState<ExperimentOpt[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [xaiData, setXaiData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("experiments")
        .select("id, name, model, status, metrics, created_at, hyperparameters")
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
      setXaiData(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("results")
        .select("data")
        .eq("experiment_id", selectedId)
        .eq("result_type", "xai_report")
        .maybeSingle();
      if (error) toast({ title: "XAI", description: error.message, variant: "destructive" });
      else setXaiData((data?.data as Record<string, unknown>) ?? null);
    })();
  }, [selectedId, toast]);

  const exp = experiments.find((e) => e.id === selectedId);
  const shapFeatures = (xaiData?.shap as ShapRow[] | undefined) ?? defaultShap;
  const pathways = (xaiData?.pathways as PathwayRow[] | undefined) ?? defaultPathways;
  const waterfall = xaiData?.sample_waterfall as { base: number; prediction: number; label: string; sample_id?: string } | undefined;
  const maxShap = Math.max(...shapFeatures.map((f) => f.shap), 0.01);
  const auc = exp?.metrics && typeof exp.metrics.auc === "number" ? exp.metrics.auc : null;

  const exportPdf = () => {
    const md = buildModelCardMarkdown({
      experimentName: exp?.name ?? "report",
      model: exp?.model ?? "",
      metrics: exp?.metrics ?? null,
      hyperparameters: exp?.hyperparameters ?? null,
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xai_report_${(exp?.name ?? "export").replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Markdown report downloaded (use PDF in your toolchain)." });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-[240px]">
          <h2 className="font-display text-lg font-semibold text-foreground">Explainability</h2>
          <div className="relative max-w-md">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || experiments.length === 0}
              aria-label="Select experiment for XAI"
              className="w-full appearance-none rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-8 text-sm"
            >
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.model}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
          {exp && (
            <p className="text-xs text-muted-foreground">
              {exp.model}
              {auc != null ? ` • AUC ${auc.toFixed(2)}` : ""} • {new Date(exp.created_at).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0"
        >
          <Download className="h-4 w-4" /> Export report (MD)
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : experiments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No experiments. Generate XAI artifacts from ML Experiments (Finalize demo).</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Global SHAP — Mean |SHAP|</h3>
            <div className="space-y-2">
              {shapFeatures.map((f) => (
                <div key={f.name} className="flex items-center gap-3">
                  <a
                    href={stringProteinSearchUrl(f.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary w-28 truncate hover:underline"
                    title={f.feature_id ?? f.gene_symbol ?? f.uniprot ?? f.hmdb ?? f.name}
                  >
                    {f.gene_symbol ?? f.name}
                  </a>
                  <span className="text-[10px] text-muted-foreground w-32 truncate">
                    {f.feature_id ?? f.uniprot ?? f.hmdb ?? "unmapped"}
                  </span>
                  <div className="flex-1 h-4 rounded bg-secondary overflow-hidden relative">
                    <div
                      className={`h-full rounded ${f.direction === "positive" ? "bg-primary/50" : "bg-warning/50"}`}
                      style={{ width: `${(f.shap / maxShap) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right">{f.shap.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Sample Waterfall</h3>
            <div className="text-xs text-muted-foreground mb-2">
              Base: <span className="font-mono text-foreground">{waterfall?.base?.toFixed(2) ?? "—"}</span> → Prediction:{" "}
              <span className="font-mono text-success font-semibold">
                {waterfall?.prediction?.toFixed(2) ?? "—"} ({waterfall?.label ?? "—"})
              </span>
            </div>
            {shapFeatures.slice(0, 6).map((f) => (
              <div key={f.name} className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-muted-foreground w-24 text-right truncate">{f.name}</span>
                <div className="flex-1 h-3 relative bg-secondary rounded">
                  <div
                    className={`absolute h-full rounded ${f.direction === "positive" ? "bg-primary/40" : "bg-warning/40"}`}
                    style={{
                      left: f.direction === "positive" ? `${50 - (f.shap / maxShap) * 40}%` : "50%",
                      width: `${(f.shap / maxShap) * 40}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="col-span-2 rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Pathway enrichment — external links</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pathway</th>
                    <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Genes</th>
                    <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">FDR</th>
                    <th className="text-right px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reactome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pathways.map((p) => (
                    <tr key={p.name} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-right text-muted-foreground">{p.genes}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm">{p.fdr.toFixed(3)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <a
                          href={reactomeSearchUrl(p.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-primary hover:text-primary/80"
                          aria-label={`Open ${p.name} in Reactome`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
