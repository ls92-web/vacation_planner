"use client";

// Last-resort fallback for errors in the root layout itself. Most screen errors
// are caught by the in-app ErrorBoundary (which keeps the nav usable); this only
// shows if something fails above that. Inline styles — the app CSS may not apply here.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F7F2E8", fontFamily: "system-ui, sans-serif", color: "#1F2D49" }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>Itinera</div>
          <h1 style={{ fontSize: 18, marginTop: 16 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#76705F", lineHeight: 1.6, marginTop: 8 }}>
            Your data is safe. Reloading usually fixes this — especially right after an update.
          </p>
          <button
            onClick={() => { try { sessionStorage.clear(); } catch {} reset(); window.location.reload(); }}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 11, border: "none", background: "#9A7B33", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
