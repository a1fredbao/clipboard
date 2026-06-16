import { useEffect, useState } from "react";
import "./index.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short random key (e.g. "a3f9k2"). */
function generateKey(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  // TODO: replace with crypto.randomUUID() slice or nanoid for better uniqueness
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/** Derive the clipboard key from the current URL path. */
function getKeyFromPath(): string | null {
  const path = window.location.pathname.replace(/^\//, "");
  return path || null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [key, setKey] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  // On mount: redirect to a random key if none is present in the URL.
  useEffect(() => {
    const existingKey = getKeyFromPath();
    if (!existingKey) {
      const newKey = generateKey();
      window.history.replaceState(null, "", `/${newKey}`);
      setKey(newKey);
      setIsLoading(false);
    } else {
      setKey(existingKey);
      // TODO: fetch content from API
      // fetchContent(existingKey);
      setIsLoading(false);
    }
  }, []);

  // TODO: implement fetchContent — GET /api/:key → populate `content`
  // TODO: implement handleSave   — PUT /api/:key with `content` body

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: call PUT /api/:key with the current `content`
    setMessage("Saved! (not yet implemented)");
    setIsSaving(false);
  };

  if (isLoading) return <div className="loading">Loading…</div>;

  return (
    <main className="app">
      <header className="header">
        <h1 className="logo">📋 Clipboard</h1>
        <div className="key-badge">
          <span className="key-label">Key:</span>
          <code className="key-value">{key}</code>
          <button
            className="copy-btn"
            title="Copy shareable link"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            Copy Link
          </button>
        </div>
      </header>

      <section className="editor-section">
        {/* TODO: replace with a rich text editor or code editor if desired */}
        <textarea
          id="clipboard-editor"
          className="editor"
          placeholder="Paste or type anything here…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
        />
      </section>

      <footer className="footer">
        {message && <span className="status-msg">{message}</span>}
        <button
          id="save-btn"
          className="save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </footer>
    </main>
  );
}
