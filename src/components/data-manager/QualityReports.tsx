import { motion } from "framer-motion";
import { Filter, ChevronDown } from "lucide-react";
import type { Dataset } from "@/pages/DataManager";

interface QualityReportsProps {
  datasets: Dataset[];
}

export function QualityReports({ datasets }: QualityReportsProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Filter className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-foreground">Quality Reports</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Select a dataset to view QC metrics including distribution plots, PCA projections, RLE heatmaps, and outlier detection.
        </p>
        <div className="mt-2 w-64 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between cursor-pointer">
          <span>{datasets.length > 0 ? "Select dataset..." : "No datasets available"}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.div>
  );
}
