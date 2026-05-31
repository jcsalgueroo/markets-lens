"use client";

/**
 * Global error boundary — catches errors inside RootLayout itself.
 * Must include its own <html>/<body> since layout is unavailable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#020617",
          color: "#f1f5f9",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 400 }}>
          <p style={{ color: "#38bdf8", fontWeight: 600, marginBottom: "1rem" }}>
            MarketLens
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            A critical error prevented the application from loading.
            {error.digest && (
              <span style={{ display: "block", color: "#475569", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                ref: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              background: "transparent",
              border: "1px solid #38bdf8",
              color: "#38bdf8",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
