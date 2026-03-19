import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, ChevronDown, Loader2, FileUp } from "lucide-react";

interface DatasetUploadFormProps {
  onSuccess: () => void;
}

export function DatasetUploadForm({ onSuccess }: DatasetUploadFormProps) {
  const [selectedModality, setSelectedModality] = useState<string>("Genomics");
  const [cohort, setCohort] = useState("");
  const [organism, setOrganism] = useState("Homo sapiens");
  const [sampleIdCol, setSampleIdCol] = useState("");
  const [phenotypeCol, setPhenotypeCol] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file || !user) {
      toast({ title: "Missing data", description: "Please select a file to upload.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("omics-data")
        .upload(filePath, file);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("datasets").insert({
        name: file.name.replace(/\.[^.]+$/, ""),
        modality: selectedModality,
        cohort: cohort || null,
        file_path: filePath,
        status: "draft",
        user_id: user.id,
        metadata: { organism, sample_id_column: sampleIdCol, phenotype_column: phenotypeCol },
      });

      if (dbError) throw dbError;

      toast({ title: "Dataset uploaded", description: `${file.name} has been uploaded and registered.` });
      setFile(null);
      setCohort("");
      setSampleIdCol("");
      setPhenotypeCol("");
      onSuccess();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="rounded-xl border-2 border-dashed border-border bg-card/50 p-12 text-center hover:border-primary/40 hover:bg-card transition-all cursor-pointer group"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".vcf,.csv,.hdf5,.loom,.mzML,.mzXML,.cdf,.tsv,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            {file ? <FileUp className="h-7 w-7 text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
          </div>
          <div>
            {file ? (
              <>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB — Click to change</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Drop omics data files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">.vcf, .csv, .hdf5, .loom, .mzML, .mzXML, .cdf — Max 10 GB per file</p>
              </>
            )}
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
              onClick={() => setSelectedModality(mod)}
              className={`flex-1 rounded-lg border p-4 text-center transition-all ${
                selectedModality === mod
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary"
              }`}
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
            <input
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g., TNBC Discovery"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Organism</label>
            <div className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between cursor-pointer">
              <span>{organism}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sample ID Column</label>
            <input
              value={sampleIdCol}
              onChange={(e) => setSampleIdCol(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="sample_id"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phenotype Column</label>
            <input
              value={phenotypeCol}
              onChange={(e) => setPhenotypeCol(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="response_label"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? "Uploading..." : "Validate & Upload"}
        </button>
      </div>
    </motion.div>
  );
}
