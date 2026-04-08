export type WorkflowTemplateId = "rna_quant" | "proteomics_lfq" | "metabolomics_peak_table" | "late_fusion_ml";

export interface WorkflowTemplate {
  id: WorkflowTemplateId;
  label: string;
  modality: string;
  description: string;
  container: string;
  nextflowModule?: string;
  snakemakeRule?: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "rna_quant",
    label: "RNA-seq quantification (salmon)",
    modality: "Genomics",
    description: "Pseudo-alignment and transcript abundance with pinned reference and decoys.",
    container: "quay.io/biocontainers/salmon:1.10.2--h6dccd9a_0",
    nextflowModule: "modules/local/salmon_quant.nf",
    snakemakeRule: "rules/salmon_quant.smk",
  },
  {
    id: "proteomics_lfq",
    label: "Proteomics LFQ (MaxQuant-style)",
    modality: "Proteomics",
    description: "Feature detection, matching, and label-free quantification for DDA data.",
    container: "ghcr.io/multiomics/maxquant-mock:0.1.0",
    nextflowModule: "modules/local/proteomics_lfq.nf",
    snakemakeRule: "rules/proteomics_lfq.smk",
  },
  {
    id: "metabolomics_peak_table",
    label: "Metabolomics feature table",
    modality: "Metabolomics",
    description: "Peak picking, alignment, and feature × sample matrix export.",
    container: "ghcr.io/multiomics/xcms-mock:0.1.0",
    nextflowModule: "modules/local/metabolomics_matrix.nf",
    snakemakeRule: "rules/metabolomics_matrix.smk",
  },
  {
    id: "late_fusion_ml",
    label: "Late-fusion ML (tabular)",
    modality: "Multi",
    description: "Modality-specific encoders merged before classification head; outputs metrics + SHAP bundle.",
    container: "ghcr.io/multiomics/late_fusion_sklearn:0.1.0",
    nextflowModule: "modules/local/late_fusion.nf",
    snakemakeRule: "rules/late_fusion.smk",
  },
];

export function templateById(id: WorkflowTemplateId): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
