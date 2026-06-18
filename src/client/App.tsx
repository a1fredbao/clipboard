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

const isMac = navigator.platform?.toLowerCase().includes("mac") ||
  navigator.userAgent.toLowerCase().includes("mac");

export default function App() {
  const [key, setKey]         = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus]   = useState<Status>(IDLE);
  const [isDirty, setIsDirty] = useState(false);
  const [theme, setTheme]     = useState<Theme>(getInitialTheme);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable refs so event listeners always see the latest values
  const keyRef     = useRef(key);
  const contentRef = useRef(content);
  const isDirtyRef = useRef(isDirty);
  const statusRef  = useRef(status);
  useEffect(() => { keyRef.current = key; }, [key]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { statusRef.current = status; }, [status]);

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

  // Core save function — uses refs so it's safe to call from any context
  const doSave = useCallback(async () => {
    if (statusRef.current.kind === "saving") return;
    if (!isDirtyRef.current) return;
    const k = keyRef.current;
    const v = contentRef.current;
    if (!k) return;
    setStatus({ kind: "saving", text: "Saving…" });
    try {
      await saveContent(k, v);
      setIsDirty(false);
      flash({ kind: "saved", text: "Saved" });
    } catch (err: unknown) {
      flash({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
  }, [flash]);

  // Fire-and-forget save using fetch keepalive:true — safe to call during page unload.
  // The browser will complete the request even after the page is torn down.
  const saveBeacon = useCallback(() => {
    if (!isDirtyRef.current || !keyRef.current) return;
    fetch(`/api/${encodeURIComponent(keyRef.current)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: contentRef.current }),
      keepalive: true,
    });
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

  // Auto-save: every 60 seconds
  useEffect(() => {
    autoSaveIntervalRef.current = setInterval(() => {
      doSave();
    }, 60_000);
    return () => {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [doSave]);

  // Auto-save: on page blur (tab switch / alt-tab) and visibility hidden (close tab)
  useEffect(() => {
    const onBlur = () => doSave();
    const onVisibility = () => { if (document.visibilityState === "hidden") doSave(); };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [doSave]);

  // ⌘/Ctrl+S shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  // Save on tab close / navigate away — no popup, no warning dialog.
  // pagehide fires reliably on tab close, back/forward navigation, and page refresh.
  useEffect(() => {
    window.addEventListener("pagehide", saveBeacon);
    return () => window.removeEventListener("pagehide", saveBeacon);
  }, [saveBeacon]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash({ kind: "copied", text: "Copied" }, 2000);
    } catch {
      flash({ kind: "error", text: "Copy failed" });
    }
  };

  // Banner text: status takes priority, then hint
  const shortcutLabel = isMac ? "⌘S" : "Ctrl+S";
  const bannerText = (() => {
    if (status.kind === "loading") return status.text;
    if (status.kind === "saving")  return "Saving…";
    if (status.kind === "saved")   return "✓ Saved";
    if (status.kind === "error")   return status.text;
    if (isDirty) return `Unsaved changes · press ${shortcutLabel} to save`;
    return `Auto-saves on blur & every minute · ${shortcutLabel} to save now`;
  })();

  const bannerKind = (() => {
    if (status.kind !== "idle") return status.kind;
    return isDirty ? "dirty" : "hint";
  })();

  return (
    <main className="app">
      {/* Header */}
      <header className="header">
        <h1 className="logo">Clipboard</h1>

        <nav className="header-actions">
          <div className="key-badge">
            <span className="key-label">key</span>
            <code className="key-value">{key}</code>
          </div>

          <div className={`banner banner--${bannerKind}`} aria-live="polite">
            {status.kind === "saving"
              ? <><span className="spinner spinner--banner" /> {bannerText}</>
              : bannerText}
          </div>
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

      {/* Banner */}
      <div className="banner">
        <a href="https://github.com/a1fredbao/clipboard">A simple clipboard app</a> based on Cloudflare Workers.  
        Made with ❤️ by Alfred Bao.
      </div>
    </main>
  );
}
