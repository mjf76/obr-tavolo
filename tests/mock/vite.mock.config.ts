import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve(__dirname, "../.."),
  plugins: [react()],
  resolve: { alias: { "@owlbear-rodeo/sdk": resolve(__dirname, "obr.ts") } },
  server: { port: 5174 },
});
