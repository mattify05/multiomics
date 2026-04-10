import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatasetUploadForm } from "@/components/data-manager/DatasetUploadForm";
import { DatasetLibrary } from "@/components/data-manager/DatasetLibrary";
import { QualityReports } from "@/components/data-manager/QualityReports";
import { useStudyContext } from "@/contexts/StudyContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Dataset = {
  id: string;
  name: string;
  modality: string;
  cohort: string | null;
  samples: number | null;
  features: number | null;
  created_at: string;
  status: string;
  file_path: string | null;
  user_id: string;
  study_id: string | null;
  metadata?: Record<string, unknown> | null;
};

export default function DataManager() {
  const [activeTab, setActiveTab] = useState("library");
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedStudyId } = useStudyContext();
  const queryClient = useQueryClient();
  const [geoAccession, setGeoAccession] = useState("");

  const datasetsQuery = useQuery({
    queryKey: ["datasets", selectedStudyId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("datasets")
        .select("id, name, modality, cohort, samples, features, created_at, status, file_path, user_id, study_id, metadata")
        .order("created_at", { ascending: false });

      if (selectedStudyId) {
        query = query.eq("study_id", selectedStudyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Dataset[];
    },
  });

  const invalidateDatasets = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
    },
  });

  const handleUploadSuccess = () => {
    void invalidateDatasets.mutateAsync();
    setActiveTab("library");
  };

  const handleGeoImport = async () => {
    const trimmed = geoAccession.trim().toUpperCase();
    if (!trimmed) return;
    if (!user) return;
    if (!trimmed.startsWith("GSE")) {
      toast({ title: "Invalid accession", description: "Use a GEO series accession like GSE12345.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("datasets").insert({
      name: trimmed,
      modality: "Genomics",
      status: "draft",
      cohort: "Public GEO",
      user_id: user.id,
      study_id: selectedStudyId ?? null,
      metadata: {
        source: "GEO",
        accession: trimmed,
        import_status: "manifest_pending",
        import_note: "MVP stub row created. Hook worker/edge function for manifest fetch next.",
      },
    });
    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      return;
    }
    setGeoAccession("");
    await queryClient.invalidateQueries({ queryKey: ["datasets"] });
    toast({ title: "Accession registered", description: `${trimmed} added as pending public dataset import.` });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="upload" className="data-[state=active]:bg-card data-[state=active]:text-primary">Upload</TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-card data-[state=active]:text-primary">Library</TabsTrigger>
          <TabsTrigger value="quality" className="data-[state=active]:bg-card data-[state=active]:text-primary">Quality Reports</TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-card data-[state=active]:text-primary">Public data</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <DatasetUploadForm onSuccess={handleUploadSuccess} selectedStudyId={selectedStudyId} />
        </TabsContent>

        <TabsContent value="library" className="mt-6">
          <DatasetLibrary
            datasets={datasetsQuery.data ?? []}
            loading={datasetsQuery.isLoading}
            onRefresh={() => invalidateDatasets.mutateAsync()}
            onSwitchToUpload={() => setActiveTab("upload")}
          />
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <QualityReports datasets={datasetsQuery.data ?? []} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <motion.div className="rounded-xl border border-border bg-card p-6 space-y-3 text-sm text-muted-foreground">
            <h3 className="font-display font-semibold text-foreground">Public data connectors</h3>
            <p>
              Import manifests from public repositories, then register files in this workspace. Full ETL pipelines are backend tasks; use these
              portals to locate accession IDs and metadata.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <a href="https://www.ncbi.nlm.nih.gov/geo/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  GEO (Gene Expression Omnibus)
                </a>
              </li>
              <li>
                <a href="https://www.ncbi.nlm.nih.gov/sra" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  SRA (Sequence Read Archive)
                </a>
              </li>
              <li>
                <a href="https://portal.gdc.cancer.gov/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  GDC (TCGA)
                </a>
              </li>
            </ul>
            <p className="text-xs">
              Programmatic access: use Supabase Edge Functions or a worker with service credentials to pull by accession, write to Storage, then
              insert dataset rows — keep JWT-scoped reads in the browser.
            </p>
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">GEO accession import (MVP)</p>
              <div className="flex gap-2">
                <input
                  value={geoAccession}
                  onChange={(event) => setGeoAccession(event.target.value)}
                  placeholder="GSE12345"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleGeoImport()}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Register
                </button>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
