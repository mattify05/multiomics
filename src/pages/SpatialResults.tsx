import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Map, PlayCircle, BarChart3, Dna } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  demoSprint1,
  demoSprint2,
  demoSprint3,
  demoSprint4,
} from "@/lib/spatialDemo";
import {
  isSpatialApiConfigured,
  runSpatialBenchmark,
  runSpatialLabelTransfer,
  runSpatialNiches,
  runSpatialQcAnnotation,
  type SpatialRunResponse,
} from "@/lib/spatialClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Artifacts = Record<string, unknown>;

function SpatialScatter({
  points,
  xKey,
  yKey,
  labelKey,
  title,
}: {
  points: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  labelKey: string;
  title: string;
}) {
  if (!points.length) return <p className="text-xs text-muted-foreground">No points.</p>;
  const xs = points.map((p) => Number(p[xKey]));
  const ys = points.map((p) => Number(p[yKey]));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.05;
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const labels = [...new Set(points.map((p) => String(p[labelKey] ?? "")))];
  const colors = ["#22d3ee", "#fbbf24", "#a78bfa", "#34d399", "#fb7185"];
  const colorOf = (l: string) => colors[labels.indexOf(l) % colors.length];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <svg viewBox="0 0 100 100" className="w-full h-48 rounded-lg bg-secondary/30 border border-border">
        {points.map((p, i) => {
          const x = pad * 100 + ((Number(p[xKey]) - minX) / dx) * (100 - 2 * pad * 100);
          const y = pad * 100 + ((Number(p[yKey]) - minY) / dy) * (100 - 2 * pad * 100);
          const lab = String(p[labelKey] ?? "");
          return (
            <circle
              key={i}
              cx={x}
              cy={100 - y}
              r={1.2}
              fill={colorOf(lab)}
              opacity={0.75}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {labels.map((l) => (
          <span key={l} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: colorOf(l) }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SpatialResults() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [s1, setS1] = useState<Artifacts | null>(null);
  const [s2, setS2] = useState<Artifacts | null>(null);
  const [s3, setS3] = useState<Artifacts | null>(null);
  const [s4, setS4] = useState<Artifacts | null>(null);
  const [lastRun, setLastRun] = useState<SpatialRunResponse | null>(null);
  const apiOk = isSpatialApiConfigured();

  const loadDemo = () => {
    setS1(demoSprint1 as unknown as Artifacts);
    setS2(demoSprint2 as unknown as Artifacts);
    setS3(demoSprint3 as unknown as Artifacts);
    setS4(demoSprint4 as unknown as Artifacts);
    toast({ title: "Demo loaded", description: "Synthetic spatial artifacts for UI preview." });
  };

  const run = async (
    key: "s1" | "s2" | "s3" | "s4",
    fn: () => Promise<SpatialRunResponse>,
    fallback: Artifacts
  ) => {
    setLoading(key);
    try {
      if (apiOk) {
        const res = await fn();
        setLastRun(res);
        if (res.status === "failed") {
          toast({ title: "Spatial job failed", description: res.error ?? "Unknown", variant: "destructive" });
          return;
        }
        const art = res.artifacts as Artifacts;
        if (key === "s1") setS1(art);
        if (key === "s2") setS2(art);
        if (key === "s3") setS3(art);
        if (key === "s4") setS4(art);
        toast({ title: "Run complete", description: `run_id=${res.run_id}` });
      } else {
        if (key === "s1") setS1(fallback);
        if (key === "s2") setS2(fallback);
        if (key === "s3") setS3(fallback);
        if (key === "s4") setS4(fallback);
        toast({
          title: "Offline demo",
          description: "Set VITE_SPATIAL_API_URL and run uvicorn ml.api.main:app for live runs.",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Request failed";
      toast({ title: "Spatial API error", description: msg, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const emb = (s1?.embedding as Array<Record<string, unknown>> | undefined) ?? [];
  const smap = (s1?.spatial_map as Array<Record<string, unknown>> | undefined) ?? [];
  const niches = (s2?.niches as Array<Record<string, unknown>> | undefined) ?? [];
  const bench = s4?.benchmark_metrics as Record<string, unknown> | undefined;
  const failures = (s4?.failure_cases as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
            Spatial Studio
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Phase 3 spatial transcriptomics: QC, niches, label transfer, and cross-platform benchmarks. Connect the
            FastAPI service via <code className="text-xs bg-secondary px-1 rounded">VITE_SPATIAL_API_URL</code> or use
            demo mode.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDemo}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Load all demos
          </button>
        </div>
      </div>

      <Tabs defaultValue="sprint1" className="w-full">
        <TabsList className="bg-secondary/50 border border-border flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="sprint1">Sprint 1 — QC / annotation</TabsTrigger>
          <TabsTrigger value="sprint2">Sprint 2 — Niches</TabsTrigger>
          <TabsTrigger value="sprint3">Sprint 3 — Label transfer</TabsTrigger>
          <TabsTrigger value="sprint4">Sprint 4 — Benchmark</TabsTrigger>
        </TabsList>

        <TabsContent value="sprint1" className="mt-4 space-y-4">
          <motion.div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-sm flex items-center gap-2">
                <Dna className="h-4 w-4" /> QC + UMAP + spatial map
              </h2>
              <button
                type="button"
                disabled={loading === "s1"}
                onClick={() =>
                  void run("s1", () => runSpatialQcAnnotation(undefined), demoSprint1 as unknown as Artifacts)
                }
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground flex items-center gap-2 disabled:opacity-50"
              >
                {loading === "s1" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run Sprint 1
              </button>
            </div>
            {s1?.qc_metrics && (
              <pre className="text-xs font-mono bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                {JSON.stringify(s1.qc_metrics, null, 2)}
              </pre>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <SpatialScatter
                points={emb}
                xKey="umap_x"
                yKey="umap_y"
                labelKey="label"
                title="UMAP (latent)"
              />
              <SpatialScatter points={smap} xKey="x" yKey="y" labelKey="label" title="Spatial layout" />
            </div>
            {s1?.feature_importance && (
              <div>
                <p className="text-xs font-medium mb-2">Top markers</p>
                <ul className="text-xs font-mono space-y-1">
                  {(
                    (s1.feature_importance as { top_markers?: Array<{ gene_symbol?: string; importance?: number }> })
                      .top_markers ?? []
                  ).map((g, i) => (
                    <li key={i}>
                      {g.gene_symbol} — {g.importance?.toFixed?.(3) ?? "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="sprint2" className="mt-4">
          <motion.div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-sm">Niche detection</h2>
              <button
                type="button"
                disabled={loading === "s2"}
                onClick={() => void run("s2", () => runSpatialNiches(undefined), demoSprint2 as unknown as Artifacts)}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground flex items-center gap-2 disabled:opacity-50"
              >
                {loading === "s2" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run Sprint 2
              </button>
            </div>
            <SpatialScatter
              points={niches.map((n, i) => ({
                ...n,
                x: (i % 12) * 6,
                y: Math.floor(i / 12) * 6,
                label: String(n.niche_id),
              }))}
              xKey="x"
              yKey="y"
              labelKey="label"
              title="Niche layout (demo projection)"
            />
            {s2?.niche_markers && (
              <pre className="text-xs font-mono bg-secondary/40 rounded-lg p-3 overflow-auto max-h-48">
                {JSON.stringify(s2.niche_markers, null, 2)}
              </pre>
            )}
            {s2?.graph_metrics && (
              <pre className="text-xs text-muted-foreground">{JSON.stringify(s2.graph_metrics, null, 2)}</pre>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="sprint3" className="mt-4">
          <motion.div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-sm">Label transfer + composition</h2>
              <button
                type="button"
                disabled={loading === "s3"}
                onClick={() =>
                  void run("s3", () => runSpatialLabelTransfer(undefined, undefined), demoSprint3 as unknown as Artifacts)
                }
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground flex items-center gap-2 disabled:opacity-50"
              >
                {loading === "s3" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run Sprint 3
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium mb-2">Integration QC</p>
                <pre className="font-mono bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                  {JSON.stringify(s3?.integration_qc ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-medium mb-2">Composition</p>
                <pre className="font-mono bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                  {JSON.stringify(s3?.celltype_composition ?? [], null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="sprint4" className="mt-4">
          <motion.div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Cross-platform benchmark
              </h2>
              <button
                type="button"
                disabled={loading === "s4"}
                onClick={() => void run("s4", () => runSpatialBenchmark(), demoSprint4 as unknown as Artifacts)}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground flex items-center gap-2 disabled:opacity-50"
              >
                {loading === "s4" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run Sprint 4
              </button>
            </div>
            {bench && (
              <pre className="text-xs font-mono bg-secondary/40 rounded-lg p-3 overflow-auto">
                {JSON.stringify(bench, null, 2)}
              </pre>
            )}
            {s4?.shift_report && (
              <pre className="text-xs font-mono text-muted-foreground">{JSON.stringify(s4.shift_report, null, 2)}</pre>
            )}
            <div>
              <p className="text-xs font-medium mb-2">Failure cases (sample)</p>
              <div className="max-h-40 overflow-auto text-xs font-mono border border-border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="p-2">spot</th>
                      <th className="p-2">pred</th>
                      <th className="p-2">true</th>
                      <th className="p-2">conf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.slice(0, 20).map((f, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="p-2">{String(f.spot_id)}</td>
                        <td className="p-2">{String(f.predicted)}</td>
                        <td className="p-2">{String(f.true_label)}</td>
                        <td className="p-2">{Number(f.confidence).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {lastRun && (
        <p className="text-[10px] text-muted-foreground font-mono">Last API run: {lastRun.run_id} ({lastRun.pipeline})</p>
      )}
    </div>
  );
}
