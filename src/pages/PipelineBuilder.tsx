import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Database, Settings2, Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { invokePipelineOrchestrator } from "@/lib/orchestrator";
import { Link } from "react-router-dom";

const steps = [
  { label: "Select Datasets", icon: Database },
  { label: "Configure Pipeline", icon: Settings2 },
  { label: "Review & Launch", icon: Rocket },
];

type DatasetRow = {
  id: string;
  name: string;
  modality: string;
  samples: number | null;
};

const MODALITIES = ["Genomics", "Proteomics", "Metabolomics"] as const;

export default function PipelineBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [runName, setRunName] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [normGenomics, setNormGenomics] = useState("VST (DESeq2)");
  const [normProteomics, setNormProteomics] = useState("Median Centring");
  const [batchMethod, setBatchMethod] = useState("ComBat (parametric)");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("datasets").select("id, name, modality, samples").order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) toast({ title: "Could not load datasets", description: error.message, variant: "destructive" });
        else {
          setDatasets(data ?? []);
          const initial = new Set((data ?? []).slice(0, 2).map((d) => d.id));
          setSelectedIds(initial);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const selectedList = useMemo(() => datasets.filter((d) => selectedIds.has(d.id)), [datasets, selectedIds]);

  const overlapEstimate = useMemo(() => {
    const counts = selectedList.map((d) => d.samples ?? 0).filter((n) => n > 0);
    if (counts.length < 2) return null;
    return Math.min(...counts);
  }, [selectedList]);

  const toggleDataset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLaunch = async () => {
    if (!user || selectedList.length === 0) {
      toast({ title: "Select datasets", description: "Choose at least one dataset.", variant: "destructive" });
      return;
    }
    const name = runName.trim() || `pipeline_${new Date().toISOString().slice(0, 19)}`;
    setLaunching(true);
    try {
      const config = {
        normalization: {
          genomics: { method: normGenomics, transform: "log2", imputation: "kNN (k=5)" },
          proteomics: { method: normProteomics, transform: "none", imputation: "kNN (k=5)" },
        },
        batch_correction: { method: batchMethod, variable: "sequencing_batch" },
        overlap_estimate: overlapEstimate,
        template: "late_fusion_prep",
        execution_backend: "local_stub",
      };
      await invokePipelineOrchestrator(supabase, {
        action: "launch_pipeline",
        name,
        description: runDescription.trim() || null,
        config,
        dataset_ids: selectedList.map((d) => d.id),
      });
      toast({ title: "Pipeline launched", description: `${name} is recorded as running.` });
      setRunName("");
      setRunDescription("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Launch failed";
      toast({ title: "Launch failed", description: msg, variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                i === currentStep
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : i < currentStep
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-secondary/50 text-muted-foreground border border-border"
              }`}
            >
              {i < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              {step.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {currentStep === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : datasets.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No datasets yet.{" "}
              <Link to="/data" className="text-primary underline">
                Upload in Data Manager
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {MODALITIES.map((mod) => {
                const modDatasets = datasets.filter((d) => d.modality === mod);
                return (
                  <div key={mod} className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-display font-semibold text-sm text-foreground mb-3">{mod}</h3>
                    <div className="space-y-2">
                      {modDatasets.map((d) => (
                        <label
                          key={d.id}
                          className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 cursor-pointer hover:border-primary/30 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleDataset(d.id)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <div>
                            <p className="text-sm font-mono font-medium text-foreground">{d.name}</p>
                            <p className="text-[10px] text-muted-foreground">{d.samples ?? "—"} samples</p>
                          </div>
                        </label>
                      ))}
                      {modDatasets.length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-4 text-center">No datasets for this modality</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-2">Sample overlap (estimate)</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Until <Link to="/studies" className="text-primary underline">sample registry</Link> links assays, overlap is approximated from the
              smallest sample count among selected datasets.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display font-bold text-foreground">{overlapEstimate ?? "—"}</span>
                <span className="text-sm text-muted-foreground">estimated overlap</span>
              </div>
              {overlapEstimate != null && overlapEstimate >= 10 && (
                <div className="text-xs text-success font-medium">Minimum sample threshold met (10+)</div>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              disabled={selectedList.length === 0}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {currentStep === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {["Genomics", "Proteomics"].map((mod) => (
            <div key={mod} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm text-foreground">{mod} Normalisation</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Method</label>
                  {mod === "Genomics" ? (
                    <input
                      value={normGenomics}
                      onChange={(e) => setNormGenomics(e.target.value)}
                      aria-label="Genomics normalization method"
                      className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                    />
                  ) : (
                    <input
                      value={normProteomics}
                      onChange={(e) => setNormProteomics(e.target.value)}
                      aria-label="Proteomics normalization method"
                      className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Transformation</label>
                  <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
                    {mod === "Genomics" ? "log2" : "None"}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Imputation</label>
                  <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">kNN (k=5)</div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Batch Correction</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Method</label>
                <input
                  value={batchMethod}
                  onChange={(e) => setBatchMethod(e.target.value)}
                  aria-label="Batch correction method"
                  className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Batch Variable</label>
                <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">sequencing_batch</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(0)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-3">Pipeline Summary</h3>
            <pre className="rounded-lg bg-secondary/50 p-4 text-xs font-mono text-secondary-foreground overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(
                {
                  datasets: selectedList.map((d) => ({ id: d.id, name: d.name, modality: d.modality, samples: d.samples })),
                  normalization: { genomics: normGenomics, proteomics: normProteomics },
                  batch_correction: batchMethod,
                  overlap_estimate: overlapEstimate,
                },
                null,
                2
              )}
            </pre>
          </div>

          <div className="rounded-xl border border-info/30 bg-info/5 p-4 flex items-center gap-3">
            <div className="text-info text-sm">ℹ</div>
            <div>
              <p className="text-sm font-medium text-foreground">Execution</p>
              <p className="text-xs text-muted-foreground">
                Runs are recorded in Supabase; attach AWS Batch, GCP Life Sciences, or Seqera Tower to execute workflows for real.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Run Name</label>
              <input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder={`pipeline_${new Date().toISOString().slice(0, 10)}`}
                className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <input
                value={runDescription}
                onChange={(e) => setRunDescription(e.target.value)}
                placeholder="Describe this pipeline run..."
                className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={launching || selectedList.length === 0}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Launch Pipeline
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
