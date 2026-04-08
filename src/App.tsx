import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import DataManager from "./pages/DataManager";
import PipelineBuilder from "./pages/PipelineBuilder";
import MLExperiments from "./pages/MLExperiments";
import ResultsExplorer from "./pages/ResultsExplorer";
import XAIReports from "./pages/XAIReports";
import PlaceholderPage from "./pages/PlaceholderPage";
import WorkflowExport from "./pages/WorkflowExport";
import Studies from "./pages/Studies";
import Trust from "./pages/Trust";
import TeamAccess from "./pages/TeamAccess";
import AuditLog from "./pages/AuditLog";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/trust" element={<Trust />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/data" element={<DataManager />} />
              <Route path="/pipeline" element={<PipelineBuilder />} />
              <Route path="/experiments" element={<MLExperiments />} />
              <Route path="/results" element={<ResultsExplorer />} />
              <Route path="/xai" element={<XAIReports />} />
              <Route path="/workflows" element={<WorkflowExport />} />
              <Route path="/studies" element={<Studies />} />
              <Route path="/admin/team" element={<TeamAccess />} />
              <Route path="/admin/audit" element={<AuditLog />} />
              <Route path="/admin/settings" element={<PlaceholderPage title="Platform Settings" description="Global configuration, billing, and cluster resource management." />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
