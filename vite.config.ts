import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * URL pubblico dell'estensione.
 * - in sviluppo: http://localhost:5173
 * - in produzione: GitHub Pages (modificabile con la variabile OBR_SITE)
 */
const PROD_SITE = process.env.OBR_SITE ?? "https://mjf76.github.io/obr-tavolo";
const DEV_SITE = "http://localhost:5173";
const PROD_BASE = new URL(PROD_SITE + "/").pathname; // es. "/obr-tavolo/"

function manifest(site: string) {
  return {
    name: "OBR Tavolo",
    version: "0.3.1",
    manifest_version: 1,
    description: "Controller da telefono per giocare in presenza: PG, movimento, schede D&D 5.5",
    author: "Michael Fargion",
    icon: `${site}/icon.svg`,
    background_url: `${site}/background.html`,
    action: {
      title: "OBR Tavolo",
      icon: `${site}/icon.svg`,
      popover: `${site}/index.html`,
      width: 380,
      height: 560,
    },
  };
}

/** Genera manifest.json con URL assoluti (OBR li richiede corretti anche su sottocartelle). */
function obrManifest(): Plugin {
  return {
    name: "obr-manifest",
    configureServer(server) {
      server.middlewares.use("/manifest.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify(manifest(DEV_SITE), null, 2));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest(PROD_SITE), null, 2),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : PROD_BASE,
  plugins: [react(), obrManifest()],
  server: { port: 5173, strictPort: true, cors: true },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        controller: resolve(__dirname, "controller.html"),
        player: resolve(__dirname, "player.html"),
        assign: resolve(__dirname, "assign.html"),
        background: resolve(__dirname, "background.html"),
      },
    },
  },
}));
