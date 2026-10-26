import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "apps/web",
  plugins: [
    react(),
    {
      name: "offline-shell",
      generateBundle(_options, bundle) {
        const files = [
          "/",
          ...Object.keys(bundle)
            .filter((x) => !x.endsWith(".map"))
            .map((x) => "/" + x),
        ];
        const version = Object.keys(bundle).join("|");
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='teleo-${version}';const FILES=${JSON.stringify(files)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('teleo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/')));else e.respondWith(caches.match(e.request,{ignoreVary:true}).then(c=>c||fetch(e.request)))})`,
        });
      },
    },
  ],
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } } },
});
