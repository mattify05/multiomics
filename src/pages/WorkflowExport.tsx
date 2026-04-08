import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WORKFLOW_TEMPLATES, type WorkflowTemplateId } from "@/lib/workflowCatalog";
import { Download, Loader2 } from "lucide-react";

function buildNextflowStub(params: {
  runName: string;
  templateId: WorkflowTemplateId;
  datasetPaths: string[];
}): string {
  const t = WORKFLOW_TEMPLATES.find((x) => x.id === params.templateId) ?? WORKFLOW_TEMPLATES[0];
  return `// OmicsAI-generated Nextflow stub — ${params.runName}
// Template: ${t.label}
// Container: ${t.container}

params.run_name = "${params.runName}"
params.input_manifest = "${params.datasetPaths.join(", ")}"

process ${t.id} {
  container "${t.container}"
  input:
    val x
  output:
    stdout
  script:
    """
    echo "Replace with real workflow task for ${t.id}"
    """
}

workflow {
  ${t.id}( Channel.from(1) )
}
`;
}

function buildSnakemakeStub(params: { runName: string; templateId: WorkflowTemplateId }): string {
  const t = WORKFLOW_TEMPLATES.find((x) => x.id === params.templateId) ?? WORKFLOW_TEMPLATES[0];
  return `# OmicsAI-generated Snakemake stub — ${params.runName}
# ${t.label}

rule all:
    input:
        "out/${params.runName}/done.flag"

rule ${t.id}:
    container:
        "${t.container}"
    output:
        touch("out/${params.runName}/done.flag")
    shell:
        "echo 'Replace with real Snakemake shell block'"
`;
}

function buildCwlStub(params: { runName: string; templateId: WorkflowTemplateId }): string {
  const t = WORKFLOW_TEMPLATES.find((x) => x.id === params.templateId) ?? WORKFLOW_TEMPLATES[0];
  return `cwlVersion: v1.2
class: CommandLineTool
label: ${params.runName}
doc: OmicsAI stub for ${t.label}
requirements:
  DockerRequirement:
    dockerPull: ${t.container}
baseCommand: ["echo", "replace-with-real-command"]
inputs: []
outputs:
  out:
    type: stdout
stdout: out.txt
`;
}

export default function WorkflowExport() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<Array<{ id: string; name: string; config: Record<string, unknown> | null; dataset_ids: string[] | null }>>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [templateId, setTemplateId] = useState<WorkflowTemplateId>("late_fusion_ml");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("pipeline_runs").select("id, name, config, dataset_ids").order("created_at", { ascending: false });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        setRuns((data as typeof runs) ?? []);
        setSelectedRunId((data as typeof runs)?.[0]?.id ?? "");
      }
      setLoading(false);
    })();
  }, [toast]);

  const run = runs.find((r) => r.id === selectedRunId);
  const runName = run?.name ?? "pipeline_export";

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">Workflow export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate portable stubs (Nextflow, Snakemake, CWL) from a registered pipeline run. Pin containers and manifests in your real CI environment.
        </p>
      </div>

      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Pipeline run</label>
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm"
              aria-label="Pipeline run for export"
            >
              {runs.length === 0 ? (
                <option value="">No runs — create one in Pipeline Builder</option>
              ) : (
                runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Workflow template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as WorkflowTemplateId)}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm"
            >
              {WORKFLOW_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const ds = (run?.dataset_ids ?? []).map((id) => `dataset:${id}`);
                download(`${runName}.nf`, buildNextflowStub({ runName, templateId, datasetPaths: ds }), "text/plain");
                toast({ title: "Downloaded", description: "Nextflow stub" });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Nextflow
            </button>
            <button
              type="button"
              onClick={() => {
                download(`${runName}.smk`, buildSnakemakeStub({ runName, templateId }), "text/plain");
                toast({ title: "Downloaded", description: "Snakemake stub" });
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Snakemake
            </button>
            <button
              type="button"
              onClick={() => {
                download(`${runName}.cwl`, buildCwlStub({ runName, templateId }), "text/yaml");
                toast({ title: "Downloaded", description: "CWL stub" });
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> CWL
            </button>
          </div>

          {run?.config && (
            <pre className="rounded-xl border border-border bg-card p-4 text-xs overflow-auto max-h-64">{JSON.stringify(run.config, null, 2)}</pre>
          )}
        </>
      )}
    </div>
  );
}
