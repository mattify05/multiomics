import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type StudyRow = Database["public"]["Tables"]["studies"]["Row"];
type SampleRow = Database["public"]["Tables"]["samples"]["Row"];

export default function Studies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [studyName, setStudyName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [timepoint, setTimepoint] = useState("");

  const loadStudies = async () => {
    const { data, error } = await supabase.from("studies").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Studies", description: error.message, variant: "destructive" });
      return;
    }
    setStudies((data as StudyRow[]) ?? []);
    setSelectedStudyId((prev) => prev || (data as StudyRow[])?.[0]?.id || "");
  };

  const loadSamples = async (studyId: string) => {
    if (!studyId) {
      setSamples([]);
      return;
    }
    const { data, error } = await supabase.from("samples").select("*").eq("study_id", studyId);
    if (error) toast({ title: "Samples", description: error.message, variant: "destructive" });
    else setSamples((data as SampleRow[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadStudies();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial bootstrap
  }, []);

  useEffect(() => {
    void loadSamples(selectedStudyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when study selection changes only
  }, [selectedStudyId]);

  const createStudy = async () => {
    if (!user || !studyName.trim()) return;
    const { error } = await supabase.from("studies").insert({
      user_id: user.id,
      name: studyName.trim(),
      description: null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Study created" });
      setStudyName("");
      await loadStudies();
    }
  };

  const addSample = async () => {
    if (!user || !selectedStudyId || !subjectId.trim()) return;
    const { error } = await supabase.from("samples").insert({
      study_id: selectedStudyId,
      user_id: user.id,
      subject_id: subjectId.trim(),
      timepoint: timepoint.trim(),
      biospecimen_id: null,
      metadata: {},
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Sample added" });
      setSubjectId("");
      setTimepoint("");
      await loadSamples(selectedStudyId);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="font-display text-lg font-semibold text-foreground">Studies &amp; sample registry</h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Group datasets and cross-omics joins by <strong className="text-foreground">study</strong>. Link assay tables to{" "}
        <strong className="text-foreground">samples</strong> (subject / timepoint). Assign datasets to a study from Data Manager (use
        metadata until UI dropdown is wired everywhere).
      </p>

      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-display font-semibold text-sm">Studies</h2>
            <div className="flex gap-2">
              <input
                value={studyName}
                onChange={(e) => setStudyName(e.target.value)}
                placeholder="TNBC Discovery"
                className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
              />
              <button type="button" onClick={createStudy} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground flex items-center gap-1">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {studies.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudyId(s.id)}
                    className={`w-full text-left rounded-md px-2 py-1.5 ${selectedStudyId === s.id ? "bg-primary/15 text-primary" : "hover:bg-secondary"}`}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
              {studies.length === 0 && <li className="text-muted-foreground">No studies yet.</li>}
            </ul>
          </motion.div>

          <motion.div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-display font-semibold text-sm">Samples in study</h2>
            {!selectedStudyId ? (
              <p className="text-xs text-muted-foreground">Select or create a study.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    placeholder="subject_id"
                    className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                  />
                  <input
                    value={timepoint}
                    onChange={(e) => setTimepoint(e.target.value)}
                    placeholder="timepoint (e.g. T0)"
                    className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                  />
                </div>
                <button type="button" onClick={addSample} className="rounded-lg border border-border px-3 py-2 text-sm">
                  Add sample
                </button>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2">Subject</th>
                      <th className="text-left py-2">Timepoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-1.5 font-mono">{s.subject_id}</td>
                        <td className="py-1.5">{s.timepoint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
