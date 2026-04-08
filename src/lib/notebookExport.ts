/** Minimal Jupyter notebook JSON for reproducibility snippet export. */
export function buildReproduceNotebookCell(params: {
  supabaseUrl: string;
  experimentName: string;
  pipelineConfigSummary: string;
}): string {
  const code = `# Reproduce experiment: ${params.experimentName}
# Configure credentials via environment (never commit secrets)
import os
SUPABASE_URL = os.environ.get("SUPABASE_URL", "${params.supabaseUrl}")
# from supabase import create_client
# client = create_client(SUPABASE_URL, os.environ["SUPABASE_SERVICE_ROLE_OR_ANON"])

pipeline_summary = '''
${params.pipelineConfigSummary}
'''
print(pipeline_summary)
`;
  const nb = {
    nbformat: 4,
    nbformat_minor: 4,
    metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" } },
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: ["# OmicsAI — reproduction stub\n", "Fill in Supabase keys and dataset paths."],
      },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: code.split("\n").map((l) => `${l}\n`) },
    ],
  };
  return JSON.stringify(nb, null, 2);
}
