import { useState } from "react";
import { T } from "../tokens";
import { CFG } from "../lib/api";

interface ApiKeyGateProps {
  onUnlock: () => void;
}

export function ApiKeyGate({ onUnlock }: ApiKeyGateProps) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const isValid = key.trim().startsWith("sk-ant-");

  function unlock() {
    if (!isValid) {
      setErr("Key must start with sk-ant-");
      return;
    }
    CFG.setKey(key.trim());
    onUnlock();
  }

  return (
    <div
      style={{
        height: "100vh",
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        fontFamily: "DM Sans,sans-serif",
      }}
    >
      <div style={{ width: "min(440px,92vw)", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg,#4f8ef7,#7c64f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(79,142,247,0.3)",
            }}
          >
            <i className="ti ti-topology-star-3" style={{ color: "#fff", fontSize: 26 }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: T.text,
                letterSpacing: "-0.02em",
              }}
            >
              Ontology Workbench
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>
              Enterprise modeling · AI-powered · Multi-agent
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 5 }}>
              Anthropic API Key
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.05)",
                border: `1.5px solid ${err ? T.red : key && isValid ? T.green : T.border}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setErr("");
                }}
                onKeyDown={(e) => e.key === "Enter" && unlock()}
                placeholder="sk-ant-api03-…"
                autoFocus
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "10px 14px",
                  fontSize: 13,
                  color: T.text,
                  fontFamily: "JetBrains Mono,monospace",
                }}
              />
              <button
                onClick={() => setShow((s) => !s)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.textDim,
                  padding: "0 12px",
                  fontSize: 14,
                }}
              >
                <i className={`ti ${show ? "ti-eye-off" : "ti-eye"}`} />
              </button>
            </div>
            {err && (
              <div style={{ marginTop: 5, fontSize: 11, color: T.red }}>
                <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />
                {err}
              </div>
            )}
          </div>

          <button
            onClick={unlock}
            disabled={!isValid}
            style={{
              padding: "10px",
              background: isValid
                ? "linear-gradient(135deg,#4f8ef7,#7c64f0)"
                : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 9,
              color: isValid ? "#fff" : T.textDim,
              fontSize: 13,
              fontWeight: 600,
              cursor: isValid ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              transition: "all .15s",
            }}
          >
            <i className="ti ti-lock-open" style={{ fontSize: 15 }} /> Enter Workbench
          </button>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${T.border}`,
              fontSize: 11,
              color: T.textDim,
              lineHeight: 1.55,
            }}
          >
            <i className="ti ti-shield-lock" style={{ marginRight: 5, color: T.green }} />
            <strong style={{ color: T.text }}>Private by design.</strong> Your key is stored only
            in{" "}
            <code style={{ fontFamily: "JetBrains Mono,monospace", color: T.accent }}>
              sessionStorage
            </code>{" "}
            for this tab. It goes directly to{" "}
            <code style={{ fontFamily: "JetBrains Mono,monospace", color: T.accent }}>
              api.anthropic.com
            </code>
            . No proxy, no backend, no logging. Cleared on tab close.
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: T.textDim }}>
          No key yet?{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: T.accent, textDecoration: "none" }}
          >
            console.anthropic.com →
          </a>
        </div>
      </div>
    </div>
  );
}
