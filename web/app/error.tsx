"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", padding: 40, textAlign: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#fafafa", marginBottom: 8 }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#71717a", marginBottom: 20, maxWidth: 400, lineHeight: 1.6 }}>
        {error.message || "An unexpected error occurred. This may be due to a network issue or 0G service unavailability."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "8px 20px", borderRadius: 6, border: "1px solid rgba(124,58,237,0.5)",
          background: "#7c3aed", color: "#fff", fontSize: "0.85rem", fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
