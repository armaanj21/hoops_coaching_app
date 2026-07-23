import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  // @ffmpeg/ffmpeg constructs its own Worker internally via a relative URL. Vite's dependency
  // pre-bundling (esbuild, into node_modules/.vite/deps) rewrites that relative path so it no
  // longer resolves to the real worker file, which silently breaks Worker creation — the whole
  // pipeline then hangs forever with no error and no log output, since the worker never starts.
  // Excluding it from pre-bundling serves it straight from node_modules, where the relative path
  // is correct.
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      // No devOptions here on purpose: registering the dev-mode service worker caused a
      // stuck SW that kept polling a stale port after Vite bumped ports. The manifest is
      // served as a static file (public/manifest.webmanifest) during dev instead; the
      // real manifest + service worker are generated fresh by this plugin at build time.
      manifest: {
        name: "Hoops Coaching",
        short_name: "HoopsCoach",
        description: "Assign drills, upload video, get AI-powered basketball feedback",
        theme_color: "#f97316",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
