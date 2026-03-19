import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, Search, Download, Eye, Plus, Database as DbIcon, ChevronDown, Trash2, Loader2, FileUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatasetUploadForm } from "@/components/data-manager/DatasetUploadForm";
import { DatasetLibrary } from "@/components/data-manager/DatasetLibrary";
import { QualityReports } from "@/components/data-manager/QualityReports";

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
};

export default function DataManager() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("library");
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDatasets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading datasets", description: error.message, variant: "destructive" });
    } else {
      setDatasets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUploadSuccess = () => {
    fetchDatasets();
    setActiveTab("library");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="upload" className="data-[state=active]:bg-card data-[state=active]:text-primary">Upload</TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-card data-[state=active]:text-primary">Library</TabsTrigger>
          <TabsTrigger value="quality" className="data-[state=active]:bg-card data-[state=active]:text-primary">Quality Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <DatasetUploadForm onSuccess={handleUploadSuccess} />
        </TabsContent>

        <TabsContent value="library" className="mt-6">
          <DatasetLibrary
            datasets={datasets}
            loading={loading}
            onRefresh={fetchDatasets}
            onSwitchToUpload={() => setActiveTab("upload")}
          />
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <QualityReports datasets={datasets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
