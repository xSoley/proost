import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

/** Inscrit les fichiers du build dans le service worker, pour un hors ligne complet dès la 1re visite */
function swPrecache(): Plugin {
  return {
    name: "proost-sw-precache",
    apply: "build",
    closeBundle() {
      const dist = path.resolve("dist");
      const sw = path.join(dist, "sw.js");
      if (!fs.existsSync(sw)) return;
      const assets = fs.readdirSync(path.join(dist, "assets")).map(f => `/assets/${f}`);
      const build = Date.now().toString(36);
      fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace("__BUILD__", build).replace("__ASSETS__", JSON.stringify(assets)));
    }
  };
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  server: { host: true }
});
