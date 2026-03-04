import { useState } from "react";
import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";
import { Upload, Search, Filter, Download, Eye, Plus, Database as DbIcon, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockDatasets = [
  { id: 1, name: "TCGA_BRCA_Expression", modality: "Genomics", cohort: "TNBC Discovery", samples: 482, features: 18543, date: "2026-02-28", status: "validated" as const },
  { id: 2, name: "BRCA_Proteomics_MaxQuant", modality: "Proteomics", cohort: "TNBC Discovery", samples: 461, features: 8234, date: "2026-02-28", status: "validated" as const },
  { id: 3, name: "MetaboPanel_v2", modality: "Metabolomics", cohort: "TNBC Discovery", samples: 445, features: 1256, date: "2026-03-01", status: "validated" as const },
  { id: 4, name: "PanCancer_RNA", modality: "Genomics", cohort: "Pan-Cancer Pilot", samples: 2048, features: 20501, date: "2026-03-02", status: "completed" as const },
  { id: 5, name: "KRAS_Phospho", modality: "Proteomics", cohort: "KRAS Resistance", samples: 156, features: 4521, date: "2026-03-03", status: "warning" as const },
  { id: 6, name: "Lipid_Screen_Raw", modality: "Metabolomics", cohort: "MetaboScreen", samples: 89, features: 3200, date: "2026-03-04", status: "draft" as const },
];

const modalityColors: Record<string, string> = {
  Genomics: "bg-info/15 text-info border-info/30",
  Proteomics: "bg-primary/15 text-primary border-primary/30",
  Metabolomics: "bg-warning/15 text-warning border-warning/30",
};

export default function DataManager() {
  const [search, setSearch] = useState("");
  const [activeModality, setActiveModality] = useState<string | null>(null);

  const filtered = mockDatasets.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeModality && d.modality !== activeModality) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="upload" className="data-[state=active]:bg-card data-[state=active]:text-primary">Upload</TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-card data-[state=active]:text-primary">Library</TabsTrigger>
          <TabsTrigger value="quality" className="data-[state=active]:bg-card data-[state=active]:text-primary">Quality Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Upload Zone */}
            <div className="rounded-xl border-2 border-dashed border-border bg-card/50 p-12 text-center hover:border-primary/40 hover:bg-card transition-all cursor-pointer group">
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Drop omics data files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">.vcf, .csv, .hdf5, .loom, .mzML, .mzXML, .cdf — Max 10 GB per file</p>
                </div>
              </div>
            </div>

            {/* Modality Selector */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm text-foreground">Data Modality</h3>
              <div className="flex gap-3">
                {["Genomics", "Proteomics", "Metabolomics"].map((mod) => (
                  <button
                    key={mod}
                    className="flex-1 rounded-lg border border-border bg-secondary/30 p-4 text-center hover:border-primary/40 hover:bg-secondary transition-all"
                  >
                    <p className="text-sm font-medium text-foreground">{mod}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {mod === "Genomics" ? "VCF, CSV, HDF5, LOOM" : mod === "Proteomics" ? "mzML, MaxQuant" : "mzXML, CDF, XCMS"}
                    </p>
                  </button>
                ))}
              </div>

              {/* Metadata Form */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cohort Name</label>
                  <input className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., TNBC Discovery" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Organism</label>
                  <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between cursor-pointer">
                    <span>Homo sapiens</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sample ID Column</label>
                  <input className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="sample_id" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phenotype Column</label>
                  <input className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="response_label" />
                </div>
              </div>

              <button className="w-full mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                Validate & Upload
              </button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="library" className="mt-6">
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
              <button className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Upload
              </button>
            </div>

            {/* Table */}
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
                    <tr key={d.id} className="hover:bg-secondary/20 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <DbIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground font-mono">{d.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${modalityColors[d.modality]}`}>
                          {d.modality}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{d.cohort}</td>
                      <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{d.samples.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{d.features.toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
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
                <span>Select dataset...</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
