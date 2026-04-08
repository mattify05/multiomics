import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("react-router")) return "react-router";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("recharts")) return "recharts";
          if (id.includes("lucide-react")) return "lucide";
          if (id.includes("@radix-ui")) return "radix";
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules\\react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules\\react\\")
          )
            return "react-vendor";
          return "vendor";
        },
      },
    },
  },
}));
