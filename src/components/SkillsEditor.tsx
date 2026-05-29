import { useState, useRef, useEffect } from "react";
import { T } from "../tokens";
import { apiFetch } from "../lib/api";
import { DEFAULT_SYSTEM, SKILLS_META_SYSTEM } from "../data/principles";

interface SkillsEditorProps {
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  onClose: () => void;
}

export function SkillsEditor({ systemPrompt, setSystemPrompt, onClose }: SkillsEditorProps) {
  const [metaMsgs, setMetaMsgs] = useState([
    { role: "ai", text: "Tell me what to improve. I'll rewrite the skills file and drop it into the editor." },
  ]);
  const [metaInput, setMetaInput] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const [draft, setDraft] = useState(systemPrompt);
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [metaMsgs]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }, [draft]);

  // BUG FIX: apiFetch already returns parsed JSON — do NOT call .json() on the result
  async function sendMeta(txt?: string) {
    const q = txt || metaInput;
    if (!q.trim() || metaLoading) return;
    setMetaInput("");
    setMetaMsgs((m) => [...m, { role: "user", text: q }]);
    setMetaLoading(true);
    try {
      const r = await apiFetch(
        {
          max_tokens: 1500,
          system: SKILLS_META_SYSTEM,
          messages: [
            ...metaMsgs
              .filter((_, i) => i > 0)
              .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
            { role: "user", content: `Current skills file:\n\n${draft}\n\nRequest: ${q}` },
          ],
        },
        "assistant"
      );
      // r is already parsed — use r.content directly
      const text = r.content?.find((b: any) => b.type === "text")?.text || "No response.";
      const sysMatch = text.match(/<SYSTEM>([\s\S]*?)<\/SYSTEM>/);
      if (sysMatch) {
        setDraft(sysMatch[1].trim());
        setSaved(false);
      }
      const display = sysMatch
        ? text.replace(/<SYSTEM>[\s\S]*?<\/SYSTEM>/, "").trim() ||
          "Updated — review and apply when ready."
        : text;
      setMetaMsgs((m) => [...m, { role: "ai", text: display }]);
    } catch {
      setMetaMsgs((m) => [...m, { role: "ai", text: "Connection error." }]);
    }
    setMetaLoading(false);
  }

  const chips = [
    "More normalization focus",
    "Add healthcare domain",
    "Add manufacturing & GS1",
    "Shorter responses",
    "Workshop facilitation style",
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(960px,95vw)",
          height: "min(700px,90vh)",
          background: "#111116",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: T.purpleDim,
                border: `1px solid ${T.purple}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-brain" style={{ fontSize: 14, color: T.purple }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Skills Editor</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                Edit the modeling assistant's system prompt
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!saved && (
              <span
                style={{
                  fontSize: 10.5,
                  color: T.amber,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: T.amber,
                    display: "inline-block",
                  }}
                />
                Unsaved
              </span>
            )}
            {saved && (
              <span
                style={{
                  fontSize: 10.5,
                  color: T.green,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: T.green,
                    display: "inline-block",
                  }}
                />
                Applied
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: T.textDim,
                fontSize: 18,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: system prompt editor */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRight: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: T.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                System Prompt
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    setDraft(DEFAULT_SYSTEM);
                    setSaved(false);
                  }}
                  style={{
                    fontSize: 10.5,
                    padding: "3px 9px",
                    borderRadius: 6,
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    color: T.textDim,
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setDraft(systemPrompt);
                    setSaved(true);
                  }}
                  disabled={saved}
                  style={{
                    fontSize: 10.5,
                    padding: "3px 9px",
                    borderRadius: 6,
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    color: T.textDim,
                    cursor: "pointer",
                    opacity: saved ? 0.4 : 1,
                  }}
                >
                  Revert
                </button>
                <button
                  onClick={() => {
                    setSystemPrompt(draft);
                    setSaved(true);
                  }}
                  style={{
                    fontSize: 10.5,
                    padding: "3px 11px",
                    borderRadius: 6,
                    background: saved ? "transparent" : T.accent,
                    border: `1px solid ${saved ? T.border : T.accent}`,
                    color: saved ? T.textDim : "#fff",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {saved ? "Applied" : "Apply ✓"}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSaved(false);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: 12,
                  lineHeight: 1.75,
                  color: T.text,
                  fontFamily: "JetBrains Mono,monospace",
                  minHeight: 300,
                  boxSizing: "border-box",
                }}
                spellCheck={false}
              />
            </div>
            <div
              style={{
                padding: "6px 16px",
                borderTop: `1px solid ${T.border}`,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 10, color: T.textDim }}>
                {draft.length} chars · {draft.split("\n").length} lines
              </span>
            </div>
          </div>

          {/* Right: skills formulator */}
          <div style={{ width: 340, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: T.purple,
                  boxShadow: `0 0 6px ${T.purple}`,
                }}
              />
              <span style={{ fontSize: 10.5, fontWeight: 500, color: T.text }}>
                Skills Formulator
              </span>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {metaMsgs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    flexDirection: m.role === "user" ? "row-reverse" : "row",
                    alignItems: "flex-end",
                  }}
                >
                  {m.role === "ai" && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        background: T.purpleDim,
                        border: `1px solid ${T.purple}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginBottom: 2,
                      }}
                    >
                      <i className="ti ti-brain" style={{ fontSize: 10, color: T.purple }} />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "8px 12px",
                      borderRadius: 10,
                      fontSize: 12,
                      lineHeight: 1.65,
                      background: m.role === "user" ? T.accent : "rgba(167,139,250,0.08)",
                      color: m.role === "user" ? "#fff" : T.text,
                      border: m.role === "ai" ? `1px solid rgba(167,139,250,0.15)` : "none",
                      borderBottomRightRadius: m.role === "user" ? 2 : 10,
                      borderBottomLeftRadius: m.role === "ai" ? 2 : 10,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {metaLoading && (
                <div style={{ display: "flex", gap: 4, padding: "6px 28px" }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: T.purple,
                        opacity: 0.5,
                        animation: `bounce .9s ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div
              style={{
                padding: "8px 12px 4px",
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => sendMeta(c)}
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 20,
                    background: "rgba(167,139,250,0.06)",
                    border: `1px solid rgba(167,139,250,0.2)`,
                    color: T.textMid,
                    cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = T.purple;
                    e.currentTarget.style.background = T.purpleDim;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = T.textMid;
                    e.currentTarget.style.background = "rgba(167,139,250,0.06)";
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ padding: "8px 12px 12px", display: "flex", gap: 6 }}>
              <input
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMeta()}
                placeholder="Describe what to change…"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 7,
                  padding: "7px 11px",
                  fontSize: 12,
                  color: T.text,
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = T.purple)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
              <button
                onClick={() => sendMeta()}
                disabled={metaLoading}
                style={{
                  width: 32,
                  height: 33,
                  borderRadius: 7,
                  background: T.purple,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: metaLoading ? 0.5 : 1,
                }}
              >
                <i className="ti ti-send" style={{ fontSize: 13, color: "#fff" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
