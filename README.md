# 📋 Clipboard

> A lightweight, shareable online clipboard built on **Cloudflare Workers** + **KV** — no accounts, no fuss. Just visit a URL, paste your text, and share the link.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)](https://hono.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Instant sharing** — every clipboard lives at `https://<your-worker>.workers.dev/<key>`
- **Auto-generated keys** — visiting the root `/` redirects you to a fresh random key
- **Persistent storage** — content is backed by [Cloudflare KV](https://developers.cloudflare.com/kv/), globally distributed
- **Zero infrastructure** — runs entirely on Cloudflare's edge network, no servers to manage
- **React SPA** — fast, responsive frontend served as static assets

---

## Project Structure

```
clipboard/
├── src/
│   ├── index.ts          # Hono worker — API routes (GET /api/:key, PUT /api/:key)
│   └── client/
│       ├── main.tsx      # React app entry point
│       ├── App.tsx       # Main clipboard component (key routing, editor, save)
│       └── index.css     # Styles
├── index.html            # Vite HTML shell
├── wrangler.jsonc        # Cloudflare Workers config (KV bindings, assets)
├── vite.config.ts        # Vite + Cloudflare plugin config
├── tsconfig.json
└── package.json
```

### How it works

```
Browser (React SPA)
      │
      │  GET  /api/:key   →  read from KV
      │  PUT  /api/:key   →  write to KV
      ▼
Hono Worker (src/index.ts)
      │
      ▼
Cloudflare KV (CLIPBOARD_KV binding)
```

Static assets (`dist/client/`) are served directly by Cloudflare's asset pipeline — the Worker only handles `/api/*` requests.

---

## Deployment

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| npm | >= 9 | bundled with Node |
| Wrangler CLI | >= 4 | `npm install -g wrangler` |
| Cloudflare account | — | [dash.cloudflare.com](https://dash.cloudflare.com) |

---

### Step 1 — Authenticate Wrangler

```bash
wrangler login
```

This opens a browser window to authorise Wrangler against your Cloudflare account.

---

### Step 2 — Create the KV Namespace

Cloudflare KV requires you to create namespaces before you can use them.

```bash
# Production namespace
wrangler kv namespace create CLIPBOARD_KV

# Preview namespace (used by `wrangler dev`)
wrangler kv namespace create CLIPBOARD_KV --preview
```

Each command prints an `id`. Copy both IDs into `wrangler.jsonc`:

```jsonc
// wrangler.jsonc
"kv_namespaces": [
  {
    "binding": "CLIPBOARD_KV",
    "id":         "<paste production id here>",
    "preview_id": "<paste preview id here>"
  }
]
```

---

### Step 3 — Install Dependencies

```bash
npm install
```

---

### Step 4 — (Optional) Regenerate TypeScript Types

Wrangler can auto-generate a `worker-configuration.d.ts` file that gives you full type-safety for your bindings:

```bash
npm run cf-typegen
```

---

### Step 5 — Local Development

```bash
npm run dev
```

Vite starts a local dev server (typically at `http://localhost:5173`). The `@cloudflare/vite-plugin` emulates Workers bindings locally — your KV reads/writes hit the **preview** namespace in real Cloudflare KV.

---

### Step 6 — Deploy to Cloudflare Workers

```bash
npm run deploy
```

This runs `vite build` (outputs to `dist/`) followed by `wrangler deploy`. Wrangler uploads:
- **Worker script** (`src/index.ts`, bundled)
- **Static assets** (`dist/client/`) — served by Cloudflare's asset pipeline

Your clipboard is now live at:

```
https://clipboard.<your-account>.workers.dev
```

> **Tip:** To use a **custom domain**, add a route or custom domain in the Cloudflare dashboard under **Workers & Pages → your worker → Settings → Domains & Routes**.

---

### Updating an existing deployment

Simply re-run:

```bash
npm run deploy
```

Wrangler performs an atomic deployment — the new version is live instantly with zero downtime.

---

## Configuration Reference

| Field | File | Description |
|-------|------|-------------|
| `name` | `wrangler.jsonc` | Worker name (also the default subdomain) |
| `compatibility_date` | `wrangler.jsonc` | Pins the Workers runtime version |
| `kv_namespaces[].id` | `wrangler.jsonc` | Production KV namespace ID |
| `kv_namespaces[].preview_id` | `wrangler.jsonc` | Dev/preview KV namespace ID |
| `assets.directory` | `wrangler.jsonc` | Output dir for the built React SPA |

---

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Hono — Ultra-fast web framework for the Edge](https://hono.dev)
- [`@cloudflare/vite-plugin` Docs](https://developers.cloudflare.com/workers/vite-plugin/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

---

## License

[MIT](LICENSE)
