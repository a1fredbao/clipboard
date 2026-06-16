import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Integrate Cloudflare Workers runtime into the Vite dev server.
    // This plugin picks up wrangler.jsonc automatically and ensures the local
    // environment (KV bindings, secrets, etc.) matches production.
    cloudflare(),
    // Standard React fast-refresh support.
    react(),
  ],
});
