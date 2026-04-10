import { motion } from "framer-motion";
import { Filter, ChevronDown, Loader2, Save } from "lucide-react";
import type { Dataset } from "@/pages/DataManager";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokePipelineOrchestrator } from "@/lib/orchestrator";

interface QualityReportsProps {
  datasets: Dataset[];
}

function parseDelimitedSample(text: string): {
  rowsApprox: number;
  cols: number;
  missingRate: number;
  delimiter: string;
} | null {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const first = lines[0];
  const delim = first.includes("\t") ? "\t" : ",";
  const headerCols = first.split(delim).length;
  let missing = 0;
  let cells = 0;
  const sampleRows = Math.min(lines.length - 1, 500);
  for (let i = 1; i <= sampleRows; i++) {
    const parts = lines[i].split(delim);
    cells += parts.length;
    for (const p of parts) {
      if (p.trim() === "" || p.toLowerCase() === "na" || p.toLowerCase() === "nan") missing++;
    }
  }
  return {
    rowsApprox: lines.length - 1,
    cols: headerCols,
    missingRate: cells > 0 ? missing / cells : 0,
    delimiter: delim === "\t" ? "TAB" : "comma",
  };
}

export function QualityReports({ datasets }: QualityReportsProps) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [queueing, setQueueing] = useState(false);

  const selected = datasets.find((d) => d.id === selectedId);

  const runQc = async () => {
    if (!selected?.file_path) {
      toast({ title: "No file", description: "Dataset has no storage path.", variant: "destructive" });
      return;
    }
    const lower = selected.file_path.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".tsv") && !lower.endsWith(".txt")) {
      toast({
        title: "Unsupported type",
        description: "MVP QC parses delimiter-separated text (.csv, .tsv, .txt). Use MultiQC integration for FASTQ/mzML later.",
      });
      return;
    }
    setLoading(true);
    try {
      const { data: signed, error: signErr } = await supabase.storage.from("omics-data").createSignedUrl(selected.file_path, 120);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No signed URL");
      const res = await fetch(signed.signedUrl);
      const blob = await res.blob();
      const text = await blob.slice(0, 2_000_000).text();
      const parsed = parseDelimitedSample(text);
      if (!parsed) {
        toast({ title: "Parse failed", description: "Could not parse file sample.", variant: "destructive" });
        setSummary(null);
        return;
      }
      const qc = {
        generated_at: new Date().toISOString(),
        file_path: selected.file_path,
        modality: selected.modality,
        ...parsed,
        note: "Client-side sample of first ~2MB. Full-file MultiQC recommended for production.",
      };
      setSummary(qc);
      toast({ title: "QC summary ready", description: `${parsed.rowsApprox} rows (approx), ${parsed.cols} columns` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "QC failed";
      toast({ title: "QC failed", description: msg, variant: "destructive" });
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const saveToDataset = async () => {
    if (!selected || !summary) return;
    setSaving(true);
    try {
      const meta = selected.metadata ?? {};
      const { error } = await supabase
        .from("datasets")
        .update({
          metadata: { ...meta, qc_summary: summary },
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast({ title: "Saved", description: "QC summary stored on dataset metadata." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const queueAsyncQc = async () => {
    if (!selected) return;
    setQueueing(true);
    try {
      await invokePipelineOrchestrator(supabase, {
        action: "launch_qc_job",
        dataset_id: selected.id,
        dataset_name: selected.name,
      });
      toast({
        title: "QC queued",
        description: "Async MultiQC placeholder job has been queued. Worker integration can append logs in jobs table.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Queue failed";
      toast({ title: "Queue failed", description: msg, variant: "destructive" });
    } finally {
      setQueueing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10">
              <Filter className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">Quality Reports</h3>
              <p className="text-sm text-muted-foreground">
                MVP: delimiter-separated files get a client-side sample parse. Attach MultiQC/FastQC jobs for NGS and metabolomics raw data.
              </p>
            </div>
          </div>
          <div className="relative max-w-md">
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setSummary(null);
              }}
              aria-label="Select dataset for QC"
              className="w-full appearance-none rounded-md border border-border bg-secondary/50 px-3 py-2 pr-8 text-sm text-foreground"
            >
              <option value="">{datasets.length ? "Select dataset…" : "No datasets"}</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.modality})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runQc}
              disabled={!selectedId || loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run QC preview
            </button>
            <button
              type="button"
              onClick={saveToDataset}
              disabled={!summary || saving}
              className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
            >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to dataset metadata
            </button>
            <button
              type="button"
              onClick={queueAsyncQc}
              disabled={!selectedId || queueing}
              className="rounded-lg border border-info/40 bg-info/10 px-4 py-2 text-sm text-info disabled:opacity-50"
            >
              {queueing ? "Queueing…" : "Queue async MultiQC job"}
            </button>
          </div>
        </div>
        {summary && (
          <pre className="flex-1 max-h-64 overflow-auto rounded-lg bg-secondary/50 p-4 text-xs font-mono text-left">
            {JSON.stringify(summary, null, 2)}
          </pre>
        )}
      </div>
    </motion.div>
  );
}
