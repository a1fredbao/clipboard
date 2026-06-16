import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateKey(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

function getKeyFromPath(): string | null {
  const path = window.location.pathname.replace(/^\//, "").trim();
  return path || null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchContent(key: string): Promise<string | null> {
  const res = await fetch(`/api/${encodeURIComponent(key)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Server error ${res.status}`);
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
    throw new Error(data.error ?? `Server error ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type StatusKind = "idle" | "loading" | "saving" | "saved" | "copied" | "error";
interface Status { kind: StatusKind; text: string }
const IDLE: Status = { kind: "idle", text: "" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [key, setKey]         = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus]   = useState<Status>(IDLE);
  const [isDirty, setIsDirty] = useState(false);
  const [theme, setTheme]     = useState<Theme>(getInitialTheme);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply theme on mount and whenever it changes
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

  const flash = useCallback((s: Status, ms = 3000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus(s);
    if (s.kind !== "loading" && s.kind !== "saving")
      timerRef.current = setTimeout(() => setStatus(IDLE), ms);
  }, []);

  // On mount: resolve key → load content
  useEffect(() => {
    let k = getKeyFromPath();
    if (!k) {
      k = generateKey();
      window.history.replaceState(null, "", `/${k}`);
    }
    setKey(k);

    setStatus({ kind: "loading", text: "Loading…" });
    fetchContent(k)
      .then((value) => {
        if (value !== null) { setContent(value); setIsDirty(false); }
        setStatus(IDLE);
      })
      .catch((err: unknown) =>
        flash({ kind: "error", text: err instanceof Error ? err.message : "Load failed" })
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘/Ctrl+S shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, content]);

  // Warn on unload with unsaved changes
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault(); };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isDirty]);

  const handleSave = async () => {
    if (status.kind === "saving") return;
    setStatus({ kind: "saving", text: "Saving…" });
    try {
      await saveContent(key, content);
      setIsDirty(false);
      flash({ kind: "saved", text: "Saved" });
    } catch (err: unknown) {
      flash({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash({ kind: "copied", text: "Copied" }, 2000);
    } catch {
      flash({ kind: "error", text: "Copy failed" });
    }
  };

  const isBusy = status.kind === "loading" || status.kind === "saving";

  return (
    <main className="app">
      {/* Header */}
      <header className="header">
        <h1 className="logo">Clipboard</h1>

        <div className="header-center">
          <div className="key-badge">
            <span className="key-label">key</span>
            <code className="key-value">{key}</code>
          </div>
        </div>

        <nav className="header-actions">
          <button
            id="copy-link-btn"
            className={`btn btn--ghost${status.kind === "copied" ? " btn--ok" : ""}`}
            onClick={handleCopyLink}
            title="Copy shareable link"
          >
            {status.kind === "copied" ? "✓ Copied" : "Copy link"}
          </button>

          <button
            id="theme-toggle-btn"
            className="btn btn--icon"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle colour scheme"
          >
            {theme === "dark" ? "☀︎" : "◗"}
          </button>
        </nav>
      </header>

      {/* Editor */}
      <section className="editor-section">
        <textarea
          id="clipboard-editor"
          className="editor"
          placeholder={"Paste or type anything here…\n\nShare this page's URL to let others view and edit."}
          value={content}
          onChange={(e) => { setContent(e.target.value); setIsDirty(true); }}
          disabled={status.kind === "loading"}
          spellCheck={false}
          aria-label="Clipboard content"
        />
      </section>

      {/* Footer */}
      <footer className="footer">
        <span className={`status-msg status--${status.kind}`} aria-live="polite">
          {isDirty && status.kind === "idle" ? "Unsaved changes" : status.text}
        </span>

        <div className="footer-right">
          <span className="kbd-hint">
            {navigator.platform?.toLowerCase().includes("mac") ? "⌘S" : "Ctrl+S"}
          </span>
          <button
            id="save-btn"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={isBusy}
            aria-label="Save"
          >
            {status.kind === "saving"
              ? <><span className="spinner" /> Saving…</>
              : "Save"}
          </button>
        </div>
      </footer>
    </main>
  );
}
