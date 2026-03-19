import { useState } from "react";
import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Eye, Plus, Database as DbIcon, Trash2, Loader2 } from "lucide-react";
import type { Dataset } from "@/pages/DataManager";

const modalityColors: Record<string, string> = {
  Genomics: "bg-info/15 text-info border-info/30",
  Proteomics: "bg-primary/15 text-primary border-primary/30",
  Metabolomics: "bg-warning/15 text-warning border-warning/30",
};

interface DatasetLibraryProps {
  datasets: Dataset[];
  loading: boolean;
  onRefresh: () => void;
  onSwitchToUpload: () => void;
}

export function DatasetLibrary({ datasets, loading, onRefresh, onSwitchToUpload }: DatasetLibraryProps) {
  const [search, setSearch] = useState("");
  const [activeModality, setActiveModality] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = datasets.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeModality && d.modality !== activeModality) return false;
    return true;
  });

  const handleDelete = async (dataset: Dataset) => {
    setDeleting(dataset.id);
    try {
      if (dataset.file_path) {
        await supabase.storage.from("omics-data").remove([dataset.file_path]);
      }
      const { error } = await supabase.from("datasets").delete().eq("id", dataset.id);
      if (error) throw error;
      toast({ title: "Dataset deleted", description: `${dataset.name} has been removed.` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (dataset: Dataset) => {
    if (!dataset.file_path) return;
    const { data, error } = await supabase.storage.from("omics-data").createSignedUrl(dataset.file_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", description: error?.message || "Could not generate download link.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search datasets..."
          />
        </div>
        <div className="flex gap-1.5">
          {["Genomics", "Proteomics", "Metabolomics"].map((mod) => (
            <button
              key={mod}
              onClick={() => setActiveModality(activeModality === mod ? null : mod)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeModality === mod
                  ? modalityColors[mod]
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
        <button
          onClick={onSwitchToUpload}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Upload
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <DbIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {datasets.length === 0 ? "No datasets yet. Upload your first dataset to get started." : "No datasets match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Modality</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cohort</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Samples</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Features</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DbIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground font-mono">{d.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${modalityColors[d.modality] || "border-border text-muted-foreground"}`}>
                      {d.modality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.cohort || "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{d.samples?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{d.features?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status as any} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleDownload(d)}
                        disabled={!d.file_path}
                        className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        disabled={deleting === d.id}
                        className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        {deleting === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
