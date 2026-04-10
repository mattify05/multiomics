import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useStudyContext } from "@/contexts/StudyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/data": "Data Manager",
  "/studies": "Studies & Samples",
  "/pipeline": "Pipeline Builder",
  "/experiments": "ML Experiment Centre",
  "/results": "Results Explorer",
  "/spatial": "Spatial Studio",
  "/xai": "XAI Reports",
  "/workflows": "Workflow Export",
  "/admin/team": "Team & Access",
  "/admin/audit": "Audit Log",
  "/admin/settings": "Platform Settings",
};

export function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "OmicsAI";
  const { selectedStudyId } = useStudyContext();
  const { data: selectedStudy } = useQuery({
    queryKey: ["study-badge", selectedStudyId],
    queryFn: async () => {
      if (!selectedStudyId) return null;
      const { data, error } = await supabase
        .from("studies")
        .select("id, name")
        .eq("id", selectedStudyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="h-5 w-px bg-border" />
              <h1 className="font-display text-sm font-semibold text-foreground">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                title="Search"
                aria-label="Search"
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                title="Notifications"
                aria-label="Notifications"
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              </button>
              <div className="ml-2 flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5">
                <span className="text-[10px] font-medium text-primary bg-primary/15 px-1.5 py-0.5 rounded">
                  {selectedStudy?.name ?? "All studies"}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="bg-gradient-glow pointer-events-none absolute inset-x-0 top-14 h-32 z-0" />
            <div className="relative z-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
