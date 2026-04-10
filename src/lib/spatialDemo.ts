/** Offline demo payloads when the spatial API is not configured (same shape as API `artifacts`). */

export const demoSprint1 = {
  qc_metrics: {
    n_spots_input: 450,
    n_spots_kept: 400,
    n_genes_input: 220,
    n_genes_kept: 200,
    pct_mito_median: 0.04,
    filtered_spot_fraction: 0.11,
    note: "Demo data — set VITE_SPATIAL_API_URL and run ml/api for live pipelines",
  },
  embedding: Array.from({ length: 80 }, (_, i) => ({
    spot_id: `demo_spot_${i}`,
    umap_x: (i % 20) * 0.2 - 2,
    umap_y: Math.floor(i / 20) * 0.4 - 1,
    label: i % 3 === 0 ? "niche_1" : i % 3 === 1 ? "niche_2" : "niche_3",
    confidence: 0.75 + (i % 10) * 0.02,
  })),
  spatial_map: Array.from({ length: 80 }, (_, i) => ({
    spot_id: `demo_spot_${i}`,
    x: (i % 20) * 12,
    y: Math.floor(i / 20) * 12,
    label: i % 3 === 0 ? "niche_1" : i % 3 === 1 ? "niche_2" : "niche_3",
    confidence: 0.75 + (i % 10) * 0.02,
  })),
  annotation: Array.from({ length: 80 }, (_, i) => ({
    spot_id: `demo_spot_${i}`,
    predicted_label: i % 3 === 0 ? "niche_1" : i % 3 === 1 ? "niche_2" : "niche_3",
    confidence: 0.75 + (i % 10) * 0.02,
  })),
  feature_importance: {
    top_markers: [
      { gene_symbol: "CD8A", feature_id: "ENSG00000153563", importance: 0.42 },
      { gene_symbol: "COL1A1", feature_id: "ENSG00000108821", importance: 0.38 },
      { gene_symbol: "EPCAM", feature_id: "ENSG00000119888", importance: 0.31 },
    ],
  },
};

export const demoSprint2 = {
  niches: Array.from({ length: 60 }, (_, i) => ({
    spot_id: `demo_spot_${i}`,
    niche_id: String(i % 5),
    confidence: 0.6 + (i % 8) * 0.04,
  })),
  niche_markers: {
    "0": ["CD8A", "GZMB", "PRF1"],
    "1": ["COL1A1", "DCN", "ACTA2"],
    "2": ["EPCAM", "KRT8", "KRT18"],
    "3": ["PECAM1", "VWF"],
    "4": ["CD68", "CSF1R"],
  },
  graph_metrics: { spatial_neighbors_k: 6, note: "Demo niche graph metrics" },
};

export const demoSprint3 = {
  label_transfer: Array.from({ length: 50 }, (_, i) => ({
    spot_id: `demo_spot_${i}`,
    transferred_label: ["T_cell", "Macrophage", "Epithelial", "Fibroblast"][i % 4],
    uncertainty: 0.1 + (i % 5) * 0.04,
  })),
  integration_qc: {
    n_shared_genes: 12000,
    mean_confidence: 0.81,
    per_class_coverage: { T_cell: 0.25, Macrophage: 0.2, Epithelial: 0.35, Fibroblast: 0.2 },
  },
  celltype_composition: [
    { region: "core", T_cell: 0.2, Macrophage: 0.15, Epithelial: 0.45, Fibroblast: 0.2 },
    { region: "margin", T_cell: 0.35, Macrophage: 0.2, Epithelial: 0.25, Fibroblast: 0.2 },
  ],
};

export const demoSprint4 = {
  benchmark_metrics: {
    in_domain: { f1: 0.82, accuracy: 0.79, auroc: 0.88 },
    out_of_domain: { f1: 0.61, accuracy: 0.58, auroc: 0.72 },
    platform_train: "10x_visium",
    platform_test: "stereo_seq",
  },
  shift_report: { delta_f1: 0.21, by_tissue: { breast: 0.64, brain: 0.58 } },
  failure_cases: Array.from({ length: 12 }, (_, i) => ({
    spot_id: `fail_${i}`,
    predicted: "Epithelial",
    true_label: "CAF",
    confidence: 0.4 + i * 0.01,
  })),
};
