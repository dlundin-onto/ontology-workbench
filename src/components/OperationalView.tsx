import { useState } from "react";
import type { Entity, Relation } from "../types";
import { T, META } from "../tokens";
import { apiFetch } from "../lib/api";
import { SAMPLE_DATA } from "../data/sample";

interface OperationalViewProps {
  entities: Entity[];
  relations: Relation[];
  systemPrompt: string;
}

export function OperationalView({ entities, relations, systemPrompt }: OperationalViewProps) {
  const [query, setQuery] = useState("");
  const [resultText, setResultText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<any[] | null>(null);

  const modelDesc = entities
    .map(
      (e) =>
        `${e.name}[${e.metaclass}](${e.attributes.map((a) => `${a.name}:${a.type}${a.pk ? " PK" : ""}`).join(",")})`
    )
    .join("; ");

  async function run() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResultText(null);
    try {
      const d = await apiFetch(
        {
          max_tokens: 600,
          system: `${systemPrompt}\n\nData model: ${modelDesc}. Answer concisely, no markdown.`,
          messages: [{ role: "user", content: query }],
        },
        "assistant"
      );
      setResultText(d.content?.find((b: any) => b.type === "text")?.text || "No result.");
    } catch {
      setResultText("Error.");
    }
    setLoading(false);
  }

  async function validate() {
    setLoading(true);
    setIssues(null);
    try {
      const d = await apiFetch(
        {
          max_tokens: 600,
          system: `Return ONLY JSON array:[{field,issue,severity:"error"|"warning"|"info"}]. No markdown.`,
          messages: [
            {
              role: "user",
              content: `Model:${modelDesc}\nData:${JSON.stringify(SAMPLE_DATA)}\nValidate.`,
            },
          ],
        },
        "assistant"
      );
      const txt = d.content?.find((b: any) => b.type === "text")?.text || "[]";
      try {
        setIssues(JSON.parse(txt.replace(/```json|```/g, "").trim()));
      } catch {
        setIssues([{ field: "–", issue: txt, severity: "info" }]);
      }
    } catch {
      setIssues([{ field: "–", issue: "Validation error", severity: "error" }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9.5,
              color: T.textDim,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Sample data
          </div>
          <pre
            style={{
              fontSize: 10.5,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${T.border}`,
              borderRadius: 9,
              padding: "12px 16px",
              lineHeight: 1.7,
              color: T.textMid,
              overflowX: "auto",
              margin: 0,
              fontFamily: "JetBrains Mono,monospace",
            }}
          >
            {JSON.stringify(SAMPLE_DATA, null, 2)}
          </pre>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Query the model or check data conformance…"
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12.5,
              color: T.text,
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />
          <button
            onClick={run}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: T.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Run
          </button>
          <button
            onClick={validate}
            disabled={loading}
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 12,
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Validate
          </button>
        </div>
        {loading && (
          <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>Analyzing…</div>
        )}
        {resultText && (
          <div
            style={{
              padding: "14px 16px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              fontSize: 12.5,
              lineHeight: 1.7,
              color: T.text,
            }}
          >
            {resultText}
          </div>
        )}
        {issues && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {issues.map((v, i) => {
              const col =
                v.severity === "error"
                  ? "248,113,113"
                  : v.severity === "warning"
                    ? "251,191,36"
                    : "79,142,247";
              const ico =
                v.severity === "error"
                  ? "ti-alert-circle"
                  : v.severity === "warning"
                    ? "ti-alert-triangle"
                    : "ti-info-circle";
              const fg =
                v.severity === "error" ? T.red : v.severity === "warning" ? T.amber : T.accent;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "9px 14px",
                    borderRadius: 8,
                    background: `rgba(${col},0.06)`,
                    border: `1px solid rgba(${col},0.16)`,
                  }}
                >
                  <i
                    className={`ti ${ico}`}
                    style={{ fontSize: 14, color: fg, marginTop: 1, flexShrink: 0 }}
                  />
                  <div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: fg,
                        fontFamily: "JetBrains Mono,monospace",
                      }}
                    >
                      {v.field && v.field !== "–" ? v.field + ": " : ""}
                    </span>
                    <span style={{ fontSize: 12, color: T.text }}>{v.issue}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div
        style={{
          width: 180,
          borderLeft: `1px solid ${T.border}`,
          padding: 16,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            color: T.textDim,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Model
        </div>
        {entities.map((e) => {
          const m = META[e.metaclass] || META.Entity;
          return (
            <div
              key={e.id}
              style={{
                marginBottom: 8,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <div
                  style={{ width: 6, height: 6, borderRadius: 2, background: m.color, opacity: 0.7 }}
                />
                <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text }}>{e.name}</div>
              </div>
              <div style={{ fontSize: 9.5, color: T.textDim }}>
                {e.metaclass} · {e.attributes.length} attrs
              </div>
            </div>
          );
        })}
        <div
          style={{
            fontSize: 10,
            color: T.textDim,
            marginTop: 4,
            paddingTop: 8,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          {relations.length} relations
        </div>
      </div>
    </div>
  );
}
