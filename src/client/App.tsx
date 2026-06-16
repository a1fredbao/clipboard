import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short random key using the Web Crypto API for better uniqueness. */
function generateKey(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

/** Derive the clipboard key from the current URL path (strips leading slash). */
function getKeyFromPath(): string | null {
  const path = window.location.pathname.replace(/^\//, "").trim();
  return path || null;
}

/** Copy text to the clipboard and return whether it succeeded. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchContent(key: string): Promise<string | null> {
  const res = await fetch(`/api/${encodeURIComponent(key)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const data = (await res.json()) as { value: string | null };
  return data.value;
}

async function saveContent(key: string, value: string): Promise<void> {
  const res = await fetch(`/api/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Server error: ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Status message type
// ---------------------------------------------------------------------------

type StatusKind = "idle" | "loading" | "saving" | "saved" | "copied" | "error";

interface Status {
  kind: StatusKind;
  text: string;
}

const IDLE: Status = { kind: "idle", text: "" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [key, setKey] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [status, setStatus] = useState<Status>(IDLE);
  const [isDirty, setIsDirty] = useState(false);

  // Used to auto-clear transient status messages after a delay.
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashStatus = useCallback((s: Status, ms = 3000) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(s);
    if (s.kind !== "loading" && s.kind !== "saving") {
      statusTimer.current = setTimeout(() => setStatus(IDLE), ms);
    }
  }, []);

  // On mount: set key from URL (or generate one), then load content.
  useEffect(() => {
    let k = getKeyFromPath();
    if (!k) {
      k = generateKey();
      window.history.replaceState(null, "", `/${k}`);
    }
    setKey(k);

    // Fetch existing content for this key.
    setStatus({ kind: "loading", text: "Loading…" });
    fetchContent(k)
      .then((value) => {
        if (value !== null) {
          setContent(value);
          setIsDirty(false);
        }
        setStatus(IDLE);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load";
        flashStatus({ kind: "error", text: msg });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl/Cmd+S shortcut to save.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, content]);

  const handleSave = async () => {
    if (status.kind === "saving") return;
    setStatus({ kind: "saving", text: "Saving…" });
    try {
      await saveContent(key, content);
      setIsDirty(false);
      flashStatus({ kind: "saved", text: "Saved!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      flashStatus({ kind: "error", text: msg });
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    flashStatus(
      ok
        ? { kind: "copied", text: "Link copied!" }
        : { kind: "error", text: "Copy failed" }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
  };

  // Warn user before closing tab with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const isBusy = status.kind === "loading" || status.kind === "saving";

  return (
    <main className="app">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="header">
        <h1 className="logo">
          <span className="logo-icon">📋</span>
          <span>Clipboard</span>
        </h1>

        <div className="header-right">
          <div className="key-badge">
            <span className="key-label">Key</span>
            <code className="key-value">{key}</code>
          </div>
          <button
            id="copy-link-btn"
            className={`copy-btn ${status.kind === "copied" ? "copy-btn--done" : ""}`}
            title="Copy shareable link"
            onClick={handleCopyLink}
          >
            {status.kind === "copied" ? "✓ Copied" : "Copy Link"}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Editor                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="editor-section">
        <textarea
          id="clipboard-editor"
          className="editor"
          placeholder="Paste or type anything here…&#10;&#10;Share this page's URL to let others view and edit this clipboard."
          value={content}
          onChange={handleChange}
          spellCheck={false}
          disabled={status.kind === "loading"}
          aria-label="Clipboard content editor"
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="footer">
        <div className="footer-left">
          {isDirty && status.kind === "idle" && (
            <span className="unsaved-dot" title="Unsaved changes" />
          )}
          <span
            className={`status-msg status-msg--${status.kind}`}
            aria-live="polite"
          >
            {status.text}
          </span>
        </div>

        <div className="footer-right">
          <span className="hint">
            {navigator.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}+S
            to save
          </span>
          <button
            id="save-btn"
            className={`save-btn ${isBusy ? "save-btn--busy" : ""}`}
            onClick={handleSave}
            disabled={isBusy}
            aria-label="Save clipboard content"
          >
            {status.kind === "saving" ? (
              <>
                <span className="spinner" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </footer>
    </main>
  );
}
