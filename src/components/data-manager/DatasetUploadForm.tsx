import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, ChevronDown, Loader2, FileUp } from "lucide-react";

interface DatasetUploadFormProps {
  onSuccess: () => void;
  selectedStudyId?: string | null;
}

export function DatasetUploadForm({ onSuccess, selectedStudyId }: DatasetUploadFormProps) {
  const [selectedModality, setSelectedModality] = useState<string>("Genomics");
  const [cohort, setCohort] = useState("");
  const [organism, setOrganism] = useState("Homo sapiens");
  const [sampleIdCol, setSampleIdCol] = useState("");
  const [phenotypeCol, setPhenotypeCol] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sampleManifestFile, setSampleManifestFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const parseManifest = async (manifest: File) => {
    const text = await manifest.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delimiter).map((header) => header.trim().toLowerCase());
    const subjectIdx = headers.findIndex((header) => ["subject_id", "sample_id", "sample"].includes(header));
    const timepointIdx = headers.findIndex((header) => header === "timepoint");
    if (subjectIdx === -1) return [];

    return lines.slice(1).map((line) => {
      const cols = line.split(delimiter);
      return {
        subject_id: (cols[subjectIdx] ?? "").trim(),
        timepoint: timepointIdx >= 0 ? (cols[timepointIdx] ?? "").trim() : "",
      };
    }).filter((row) => row.subject_id.length > 0);
  };

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

      const { data: datasetRow, error: dbError } = await supabase.from("datasets").insert({
        name: file.name.replace(/\.[^.]+$/, ""),
        modality: selectedModality,
        cohort: cohort || null,
        file_path: filePath,
        status: "draft",
        user_id: user.id,
        study_id: selectedStudyId ?? null,
        metadata: { organism, sample_id_column: sampleIdCol, phenotype_column: phenotypeCol },
      }).select("id").single();

      if (dbError) throw dbError;

      if (datasetRow?.id && selectedStudyId && sampleManifestFile) {
        const manifestRows = await parseManifest(sampleManifestFile);
        if (manifestRows.length > 0) {
          const { data: existingSamples, error: existingError } = await supabase
            .from("samples")
            .select("id, subject_id")
            .eq("study_id", selectedStudyId);
          if (existingError) throw existingError;

          const subjectToSampleId = new Map((existingSamples ?? []).map((sample) => [sample.subject_id, sample.id]));
          const missing = manifestRows.filter((row) => !subjectToSampleId.has(row.subject_id));

          if (missing.length > 0) {
            const { data: createdSamples, error: createSamplesError } = await supabase
              .from("samples")
              .insert(
                missing.map((row) => ({
                  study_id: selectedStudyId,
                  user_id: user.id,
                  subject_id: row.subject_id,
                  timepoint: row.timepoint || null,
                  biospecimen_id: null,
                  metadata: {},
                })),
              )
              .select("id, subject_id");
            if (createSamplesError) throw createSamplesError;
            for (const sample of createdSamples ?? []) {
              subjectToSampleId.set(sample.subject_id, sample.id);
            }
          }

          const links = manifestRows
            .map((row) => {
              const sampleId = subjectToSampleId.get(row.subject_id);
              if (!sampleId) return null;
              return { dataset_id: datasetRow.id, sample_id: sampleId };
            })
            .filter((row): row is { dataset_id: string; sample_id: string } => row !== null);

          if (links.length > 0) {
            const { error: linkError } = await supabase.from("dataset_samples").upsert(links, {
              onConflict: "dataset_id,sample_id",
            });
            if (linkError) throw linkError;
          }
        }
      }

      toast({ title: "Dataset uploaded", description: `${file.name} has been uploaded and registered.` });
      setFile(null);
      setCohort("");
      setSampleIdCol("");
      setPhenotypeCol("");
      setSampleManifestFile(null);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
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
          aria-label="Select omics dataset file"
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

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sample manifest (optional)</p>
            <p className="text-xs text-muted-foreground">Attach CSV/TSV with `subject_id` (or `sample_id`) and optional `timepoint` to populate lineage.</p>
          </div>
          <button
            type="button"
            onClick={() => manifestInputRef.current?.click()}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            {sampleManifestFile ? "Change manifest" : "Attach manifest"}
          </button>
        </div>
        <input
          ref={manifestInputRef}
          type="file"
          aria-label="Select sample manifest file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(event) => setSampleManifestFile(event.target.files?.[0] ?? null)}
        />
        {sampleManifestFile ? (
          <p className="text-xs text-muted-foreground">{sampleManifestFile.name}</p>
        ) : null}
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
