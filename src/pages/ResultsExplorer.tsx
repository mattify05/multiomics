import { motion } from "framer-motion";
import { Download, ChevronDown, Filter, ZoomIn } from "lucide-react";

// Mock scatter data for UMAP
const umapData = Array.from({ length: 80 }, (_, i) => ({
  x: (i < 40 ? -2 : 2) + (Math.random() - 0.5) * 3,
  y: (i < 40 ? 1 : -1) + (Math.random() - 0.5) * 3,
  label: i < 40 ? "Responder" : "Non-Responder",
  confidence: 0.6 + Math.random() * 0.35,
}));

const confusionMatrix = [
  [36, 4],
  [6, 34],
];

const topFeatures = [
  { name: "EGFR", modality: "Genomics", importance: 0.92 },
  { name: "phospho-AKT", modality: "Proteomics", importance: 0.87 },
  { name: "TP53_mut", modality: "Genomics", importance: 0.81 },
  { name: "BRCA1_expr", modality: "Genomics", importance: 0.78 },
  { name: "ceramide_C16", modality: "Metabolomics", importance: 0.74 },
  { name: "HER2_prot", modality: "Proteomics", importance: 0.71 },
  { name: "MYC_expr", modality: "Genomics", importance: 0.68 },
  { name: "sphingomyelin", modality: "Metabolomics", importance: 0.65 },
];

export default function ResultsExplorer() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card sticky top-14 z-20">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-2 flex-1">
          {["Phenotype", "Predicted Class", "Batch", "Confidence > 0.8"].map((f) => (
            <button key={f} className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors flex items-center gap-1">
              {f} <ChevronDown className="h-3 w-3" />
            </button>
          ))}
        </div>
        <button className="text-xs text-primary hover:text-primary/80 font-medium">Reset</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* UMAP */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground">UMAP Projection</h3>
            <div className="flex items-center gap-2">
              <div className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                Colour: Predicted Class <ChevronDown className="h-3 w-3" />
              </div>
              <button className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="relative h-64 bg-secondary/20 rounded-lg overflow-hidden">
            <svg viewBox="-5 -5 10 10" className="w-full h-full">
              {umapData.map((d, i) => (
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
            <div className="absolute bottom-2 right-2 flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Responder</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> Non-Responder</span>
            </div>
          </div>
        </motion.div>

        {/* Confusion Matrix */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Confusion Matrix</h3>
            <button className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="space-y-1">
              <div className="flex gap-1">
                <div className="text-xs text-muted-foreground w-24 text-right pr-2 flex items-center justify-end">Responder</div>
                <div className="h-24 w-24 rounded-lg bg-success/20 flex items-center justify-center border border-success/30">
                  <span className="text-2xl font-display font-bold text-success">{confusionMatrix[0][0]}</span>
                </div>
                <div className="h-24 w-24 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20">
                  <span className="text-2xl font-display font-bold text-destructive/60">{confusionMatrix[0][1]}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <div className="text-xs text-muted-foreground w-24 text-right pr-2 flex items-center justify-end">Non-Resp.</div>
                <div className="h-24 w-24 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20">
                  <span className="text-2xl font-display font-bold text-destructive/60">{confusionMatrix[1][0]}</span>
                </div>
                <div className="h-24 w-24 rounded-lg bg-success/20 flex items-center justify-center border border-success/30">
                  <span className="text-2xl font-display font-bold text-success">{confusionMatrix[1][1]}</span>
                </div>
              </div>
              <div className="flex gap-1 ml-24">
                <div className="w-24 text-center text-xs text-muted-foreground pt-1">Predicted R</div>
                <div className="w-24 text-center text-xs text-muted-foreground pt-1">Predicted NR</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Importance */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold text-sm text-foreground mb-4">Top Features</h3>
          <div className="space-y-2.5">
            {topFeatures.map((f) => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-foreground w-28 truncate">{f.name}</span>
                <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${f.importance * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{f.importance.toFixed(2)}</span>
                <span className={`text-[9px] rounded-full border px-1.5 py-0.5 ${
                  f.modality === "Genomics" ? "bg-info/15 text-info border-info/30" :
                  f.modality === "Proteomics" ? "bg-primary/15 text-primary border-primary/30" :
                  "bg-warning/15 text-warning border-warning/30"
                }`}>{f.modality.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ROC Curve Placeholder */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground">ROC Curve</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">AUC =</span>
              <span className="font-mono font-bold text-success">0.89</span>
            </div>
          </div>
          <div className="h-52 bg-secondary/20 rounded-lg overflow-hidden relative">
            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
              {/* Diagonal reference */}
              <line x1="0" y1="100" x2="100" y2="0" stroke="hsl(220, 16%, 20%)" strokeWidth="0.5" strokeDasharray="3,3" />
              {/* ROC curve */}
              <polyline
                points="0,100 5,60 10,40 15,28 20,20 30,14 40,10 50,7 60,5 70,4 80,3 90,2 100,0"
                fill="none"
                stroke="hsl(185, 72%, 48%)"
                strokeWidth="1.5"
              />
              {/* Fill under curve */}
              <polygon
                points="0,100 5,60 10,40 15,28 20,20 30,14 40,10 50,7 60,5 70,4 80,3 90,2 100,0 100,100"
                fill="hsl(185, 72%, 48%)"
                opacity="0.1"
              />
            </svg>
            <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground">False Positive Rate</div>
            <div className="absolute top-2 left-2 text-[10px] text-muted-foreground origin-bottom-left -rotate-90 translate-y-full">True Positive Rate</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
