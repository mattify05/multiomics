import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import DataManager from "./pages/DataManager";
import PipelineBuilder from "./pages/PipelineBuilder";
import MLExperiments from "./pages/MLExperiments";
import ResultsExplorer from "./pages/ResultsExplorer";
import XAIReports from "./pages/XAIReports";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/data" element={<DataManager />} />
            <Route path="/pipeline" element={<PipelineBuilder />} />
            <Route path="/experiments" element={<MLExperiments />} />
            <Route path="/results" element={<ResultsExplorer />} />
            <Route path="/xai" element={<XAIReports />} />
            <Route path="/workflows" element={<PlaceholderPage title="Workflow Export" description="Download and publish reproducible workflow manifests in Nextflow, Snakemake, and CWL formats." />} />
            <Route path="/admin/team" element={<PlaceholderPage title="Team & Access" description="Manage team members, roles, and SSO configuration for your organization." />} />
            <Route path="/admin/audit" element={<PlaceholderPage title="Audit Log" description="Immutable event log viewer with HIPAA-compliant export capabilities." />} />
            <Route path="/admin/settings" element={<PlaceholderPage title="Platform Settings" description="Global configuration, billing, and cluster resource management." />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
