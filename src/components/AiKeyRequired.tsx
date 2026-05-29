import { T } from "../tokens";

interface AiKeyRequiredProps {
  /** "panel" = inline fill (sidebar); "modal" = full-screen modal wrapper */
  context?: "panel" | "modal";
  /** Title shown in the modal header */
  title?: string;
  /** Close handler — required when context="modal" */
  onClose?: () => void;
}

/** Shown in place of any AI-dependent component when no API key is configured. */
export function AiKeyRequired({
  context = "panel",
  title = "AI Features",
  onClose,
}: AiKeyRequiredProps) {
  const body = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: "32px 28px",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: "rgba(167,139,250,0.1)",
          border: "1px solid rgba(167,139,250,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 32px rgba(167,139,250,0.12)",
        }}
      >
        <i className="ti ti-sparkles" style={{ fontSize: 24, color: T.purple }} />
      </div>

      {/* Copy */}
      <div style={{ maxWidth: 280 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 9 }}>
          AI features
        </div>
        <div style={{ fontSize: 12.5, color: T.textDim, lineHeight: 1.75 }}>
          To unlock the AI assistant, Agent Swarm, and Platform Validator, add your
          Anthropic API key via the{" "}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              color: T.text,
              fontWeight: 500,
            }}
          >
            <i className="ti ti-settings" style={{ fontSize: 11 }} />
            Settings
          </span>{" "}
          button in the top-right corner.
        </div>
      </div>

      {/* Privacy note */}
      <div
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${T.border}`,
          fontSize: 11,
          color: T.textDim,
          lineHeight: 1.55,
          maxWidth: 300,
        }}
      >
        <i className="ti ti-shield-lock" style={{ marginRight: 5, color: T.green }} />
        Your key stays in this browser tab only — never sent anywhere except directly
        to{" "}
        <code style={{ fontFamily: "JetBrains Mono,monospace", color: T.accent }}>
          api.anthropic.com
        </code>
        .
      </div>

      {/* External link */}
      <a
        href="https://console.anthropic.com"
        target="_blank"
        rel="noreferrer"
        style={{
          fontSize: 11.5,
          color: T.accent,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
      >
        Get a free API key at console.anthropic.com
        <i className="ti ti-external-link" style={{ fontSize: 11 }} />
      </a>
    </div>
  );

  if (context === "modal") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        <div
          style={{
            width: "min(480px, 94vw)",
            background: "#0f0f14",
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{title}</span>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.textDim,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "2px 4px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
              >
                ×
              </button>
            )}
          </div>
          {body}
        </div>
      </div>
    );
  }

  return body;
}
