import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Cloudflare Workers environment bindings defined in wrangler.jsonc. */
type Bindings = {
  CLIPBOARD_KV: KVNamespace;
};

/** Shape of the JSON body accepted by PUT /api/:key */
interface PutBody {
  value: string;
}

/** Shape of every API response */
interface ApiResponse {
  key: string;
  value: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How long clipboard entries live in KV before being automatically deleted.
 * 30 days expressed in seconds.
 */
const TTL_SECONDS = 60 * 60 * 24 * 30;

/** Maximum allowed content size (512 KiB). */
const MAX_BYTES = 512 * 1024;

/** Only allow keys that are alphanumeric (plus hyphens/underscores), 1–128 chars. */
const KEY_RE = /^[a-z0-9_-]{1,128}$/i;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Bindings }>();

// Allow cross-origin requests so the React dev server can talk to the worker
// during local development (the Cloudflare Vite plugin proxies requests, so
// this is a no-op in production but harmless either way).
app.use("/api/*", cors());

// ---------------------------------------------------------------------------
// GET /api/:key
// ---------------------------------------------------------------------------

/**
 * Retrieve clipboard content stored under `key`.
 * Returns 200 with `{ key, value }` or 404 if the key does not exist.
 */
app.get("/api/:key", async (c) => {
  const key = c.req.param("key");

  if (!KEY_RE.test(key)) {
    throw new HTTPException(400, { message: "Invalid key format" });
  }

  const value = await c.env.CLIPBOARD_KV.get(key, { type: "text" });

  if (value === null) {
    return c.json<ApiResponse>({ key, value: null }, 404);
  }

  return c.json<ApiResponse>({ key, value });
});

// ---------------------------------------------------------------------------
// PUT /api/:key
// ---------------------------------------------------------------------------

/**
 * Store or overwrite clipboard content under `key`.
 * Body: `{ "value": "<text>" }`
 * Returns 200 with the saved `{ key, value }`.
 */
app.put("/api/:key", async (c) => {
  const key = c.req.param("key");

  if (!KEY_RE.test(key)) {
    throw new HTTPException(400, { message: "Invalid key format" });
  }

  // Parse and validate body
  let body: PutBody;
  try {
    body = await c.req.json<PutBody>();
  } catch {
    throw new HTTPException(400, { message: "Request body must be valid JSON" });
  }

  if (typeof body.value !== "string") {
    throw new HTTPException(400, { message: '`value` must be a string' });
  }

  if (new TextEncoder().encode(body.value).length > MAX_BYTES) {
    throw new HTTPException(413, {
      message: `Content exceeds maximum size of ${MAX_BYTES / 1024} KiB`,
    });
  }

  await c.env.CLIPBOARD_KV.put(key, body.value, {
    expirationTtl: TTL_SECONDS,
  });

  return c.json<ApiResponse>({ key, value: body.value });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
