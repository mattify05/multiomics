/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SPATIAL_API_URL?: string;
  /** When `"true"`, ML Experiments labels demo finalization as synthetic (real runs use the tabular worker). */
  readonly VITE_TABULAR_TRAINING_ENABLED?: string;
}
