import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": r("./src/shared"), "@features": r("./src/features"), "@styles": r("./src/styles") } },
  server: { proxy: { "/api": "http://127.0.0.1:8788" } },
  test: { environment: "node" },
} as any);
