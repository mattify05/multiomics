import { Fragment, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Search, Download, Filter, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface AuditEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
}

const actionColors: Record<string, string> = {
  INSERT: "bg-success/15 text-success border-success/30",
  UPDATE: "bg-info/15 text-info border-info/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

const tableOptions = ["All Tables", "datasets", "pipeline_runs", "experiments", "results", "user_roles"];
const actionOptions = ["All Actions", "INSERT", "UPDATE", "DELETE"];

export default function AuditLog() {
  const { hasRole } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("All Tables");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isLabOwner = hasRole("lab_owner");

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (tableFilter !== "All Tables") {
      query = query.eq("table_name", tableFilter);
    }
    if (actionFilter !== "All Actions") {
      query = query.eq("action", actionFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error loading audit log", description: error.message, variant: "destructive" });
    } else {
      setEntries((data as AuditEntry[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLabOwner) fetchLogs();
  }, [isLabOwner, tableFilter, actionFilter]);

  const filtered = entries.filter(
    (e) =>
      e.table_name.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      (e.record_id?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (e.user_id?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const exportCSV = () => {
    const headers = ["Timestamp", "Action", "Table", "Record ID", "User ID", "IP Address"];
    const rows = filtered.map((e) => [
      new Date(e.created_at).toISOString(),
      e.action,
      e.table_name,
      e.record_id ?? "",
      e.user_id ?? "",
      e.ip_address ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filtered.length} entries exported to CSV` });
  };

  if (!isLabOwner) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-4" />
          <h2 className="font-display text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">Only Lab Owners can view the audit log.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: entries.length, color: "text-foreground" },
          { label: "Inserts", value: entries.filter((e) => e.action === "INSERT").length, color: "text-success" },
          { label: "Updates", value: entries.filter((e) => e.action === "UPDATE").length, color: "text-info" },
          { label: "Deletes", value: entries.filter((e) => e.action === "DELETE").length, color: "text-destructive" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters & Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-5 border-b border-border flex-wrap gap-3">
          <h3 className="font-display font-semibold text-foreground">Audit Log</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs…"
                className="rounded-lg border border-border bg-secondary/50 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-52"
              />
            </div>

            <div className="relative">
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                aria-label="Filter by table"
                className="appearance-none rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-8 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {tableOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter by action"
                className="appearance-none rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-8 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {actionOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={exportCSV}
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No audit entries found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Table</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Record ID</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">User ID</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="hover:bg-secondary/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${actionColors[entry.action] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.table_name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground truncate max-w-[140px]">
                      {entry.record_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground truncate max-w-[140px]">
                      {entry.user_id?.slice(0, 8) ?? "system"}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandedId === entry.id ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 bg-secondary/10">
                        <div className="grid grid-cols-2 gap-4">
                          {entry.old_data && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Previous Data</p>
                              <pre className="rounded-lg bg-secondary/50 p-3 text-xs font-mono text-secondary-foreground overflow-auto max-h-48">
                                {JSON.stringify(entry.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.new_data && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">New Data</p>
                              <pre className="rounded-lg bg-secondary/50 p-3 text-xs font-mono text-secondary-foreground overflow-auto max-h-48">
                                {JSON.stringify(entry.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
