import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Database, Settings2, Rocket, ChevronDown } from "lucide-react";

const steps = [
  { label: "Select Datasets", icon: Database },
  { label: "Configure Pipeline", icon: Settings2 },
  { label: "Review & Launch", icon: Rocket },
];

const mockDatasets = [
  { name: "TCGA_BRCA_Expression", modality: "Genomics", samples: 482, selected: true },
  { name: "BRCA_Proteomics_MaxQuant", modality: "Proteomics", samples: 461, selected: true },
  { name: "MetaboPanel_v2", modality: "Metabolomics", samples: 445, selected: false },
];

export default function PipelineBuilder() {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <button
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                i === currentStep
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : i < currentStep
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-secondary/50 text-muted-foreground border border-border"
              }`}
            >
              {i < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <step.icon className="h-4 w-4" />
              )}
              {step.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {["Genomics", "Proteomics", "Metabolomics"].map((mod) => {
              const datasets = mockDatasets.filter((d) => d.modality === mod);
              return (
                <div key={mod} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-display font-semibold text-sm text-foreground mb-3">{mod}</h3>
                  <div className="space-y-2">
                    {datasets.map((d) => (
                      <label key={d.name} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 cursor-pointer hover:border-primary/30 transition-colors">
                        <input type="checkbox" defaultChecked={d.selected} className="rounded border-border text-primary focus:ring-primary" />
                        <div>
                          <p className="text-sm font-mono font-medium text-foreground">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground">{d.samples} samples</p>
                        </div>
                      </label>
                    ))}
                    {datasets.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-4 text-center">No validated datasets</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-2">Sample Overlap</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display font-bold text-foreground">438</span>
                <span className="text-sm text-muted-foreground">overlapping samples</span>
              </div>
              <div className="text-xs text-success font-medium">✓ Minimum 10 met</div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setCurrentStep(1)} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">
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
                  <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                    <span>{mod === "Genomics" ? "VST (DESeq2)" : "Median Centring"}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Transformation</label>
                  <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                    <span>{mod === "Genomics" ? "log2" : "None"}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Imputation</label>
                  <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                    <span>kNN (k=5)</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-foreground">Batch Correction</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Method</label>
                <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                  <span>ComBat (parametric)</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Batch Variable</label>
                <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground flex items-center justify-between cursor-pointer">
                  <span>sequencing_batch</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-end">
                <button className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
                  Preview on 50 samples
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setCurrentStep(0)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Back
            </button>
            <button onClick={() => setCurrentStep(2)} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-3">Pipeline Summary</h3>
            <pre className="rounded-lg bg-secondary/50 p-4 text-xs font-mono text-secondary-foreground overflow-x-auto">{`pipeline:
  name: "TNBC_Discovery_Run1"
  datasets:
    - TCGA_BRCA_Expression (Genomics, n=482)
    - BRCA_Proteomics_MaxQuant (Proteomics, n=461)
  normalisation:
    genomics: VST (DESeq2), log2, kNN imputation
    proteomics: Median Centring, none, kNN imputation
  batch_correction:
    method: ComBat (parametric)
    variable: sequencing_batch
  samples_overlap: 438`}</pre>
          </div>

          <div className="rounded-xl border border-info/30 bg-info/5 p-4 flex items-center gap-3">
            <div className="text-info text-sm">ℹ</div>
            <div>
              <p className="text-sm font-medium text-foreground">Estimated runtime: ~12 minutes</p>
              <p className="text-xs text-muted-foreground">Based on 438 samples, 2 modalities, ComBat correction</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Run Name</label>
              <input defaultValue="TNBC_Discovery_Run1" className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <input placeholder="Describe this pipeline run..." className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setCurrentStep(1)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Back
            </button>
            <button className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Launch Pipeline
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
