/**
 * Abstraction for where pipeline/experiment jobs actually run.
 * Implementations: LocalStub, AwsBatchDispatch, GcpLifeSciences, SeqeraTower, KubernetesJobs.
 * The Supabase edge function remains the authentication + dispatch entrypoint for the web app.
 */
export type ExecutionBackendKind = "local_stub" | "aws_batch" | "gcp_life_sciences" | "seqera_tower" | "kubernetes";

export interface ExecutionBackend {
  readonly kind: ExecutionBackendKind;
  readonly description: string;
  /** Returns true when this backend can accept a new job (quota / queue depth). */
  canDispatch(): Promise<{ ok: boolean; reason?: string }>;
}

export class LocalStubExecutionBackend implements ExecutionBackend {
  readonly kind: ExecutionBackendKind = "local_stub";
  readonly description =
    "Development stub: records pipeline_run in Postgres; no cluster submission. Swap for cloud batch in production.";

  async canDispatch() {
    return { ok: true };
  }
}

export function resolveExecutionBackendFromEnv(): ExecutionBackend {
  return new LocalStubExecutionBackend();
}
