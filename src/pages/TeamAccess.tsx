import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Shield, ChevronDown, Search, UserPlus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type AppRole = "lab_owner" | "analyst" | "viewer";

interface TeamMember {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role: AppRole;
  role_id: string;
}

const roleConfig: Record<AppRole, { label: string; color: string; description: string }> = {
  lab_owner: {
    label: "Lab Owner",
    color: "bg-primary/15 text-primary border-primary/30",
    description: "Full access to all data, users, and settings",
  },
  analyst: {
    label: "Analyst",
    color: "bg-info/15 text-info border-info/30",
    description: "Can create and manage own datasets, pipelines, and experiments",
  },
  viewer: {
    label: "Viewer",
    color: "bg-muted text-muted-foreground border-border",
    description: "Read-only access to shared results and reports",
  },
};

export default function TeamAccess() {
  const { hasRole } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const isLabOwner = hasRole("lab_owner");

  const fetchMembers = async () => {
    setLoading(true);
    // Fetch profiles (lab_owner sees all, others see own)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, created_at");

    if (profilesError) {
      toast({ title: "Error loading team", description: profilesError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("id, user_id, role");

    if (rolesError) {
      toast({ title: "Error loading roles", description: rolesError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const merged: TeamMember[] = (profiles ?? []).map((p) => {
      const userRole = roles?.find((r) => r.user_id === p.id);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        role: (userRole?.role as AppRole) ?? "viewer",
        role_id: userRole?.id ?? "",
      };
    });

    setMembers(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleRoleChange = async (member: TeamMember, newRole: AppRole) => {
    if (!isLabOwner) return;
    setChangingRole(member.id);

    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", member.id);

    if (error) {
      toast({ title: "Error updating role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated", description: `${member.full_name || member.email} is now ${roleConfig[newRole].label}` });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );
    }
    setChangingRole(null);
  };

  const filtered = members.filter(
    (m) =>
      (m.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (m.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const roleCounts = members.reduce(
    (acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (!isLabOwner) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-4" />
          <h2 className="font-display text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">Only Lab Owners can manage team members and roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["lab_owner", "analyst", "viewer"] as AppRole[]).map((role) => (
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${roleConfig[role].color}`}>
                {roleConfig[role].label}
              </span>
              <span className="text-2xl font-display font-bold text-foreground">{roleCounts[role] || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">{roleConfig[role].description}</p>
          </motion.div>
        ))}
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display font-semibold text-foreground">Team Members</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="rounded-lg border border-border bg-secondary/50 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading team members…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No members found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Member</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((member) => {
                const initials = member.full_name
                  ? member.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                  : member.email?.slice(0, 2).toUpperCase() ?? "??";

                return (
                  <tr key={member.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">{initials}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{member.full_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value as AppRole)}
                          disabled={changingRole === member.id}
                          className={`appearance-none rounded-full border px-3 py-1 pr-7 text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary ${roleConfig[member.role].color} bg-transparent`}
                        >
                          <option value="lab_owner">Lab Owner</option>
                          <option value="analyst">Analyst</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
