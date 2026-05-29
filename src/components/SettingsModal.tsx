import { useState } from "react";
import { T } from "../tokens";
import { CFG, AVAILABLE_MODELS, apiFetch, hasApiKey } from "../lib/api";
import { getAutoSave, setAutoSave, getWorkContext, saveWorkContext } from "../lib/storage";
import type { WorkContext } from "../types";

interface SettingsModalProps {
  onClose: () => void;
  onContextChange?: (ctx: WorkContext) => void;
}

export function SettingsModal({ onClose, onContextChange }: SettingsModalProps) {
  const [key, setKey] = useState(CFG.getKey());
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSave, setAutoSaveState] = useState(getAutoSave());
  const [models, setModels] = useState({
    assistant: CFG.getModel("assistant"),
    swarm: CFG.getModel("swarm"),
    validator: CFG.getModel("validator"),
  });
  const [context, setContextState] = useState<WorkContext>(getWorkContext);
  const [enhancing, setEnhancing] = useState<"company" | "department" | "project" | null>(null);
  const [pending, setPending] = useState<{ field: "company" | "department" | "project"; text: string } | null>(null);

  function save() {
    CFG.setKey(key);
    Object.entries(models).forEach(([role, m]) => CFG.setModel(role, m));
    setAutoSave(autoSave);
    saveWorkContext(context);
    onContextChange?.(context);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  }

  async function enhance(field: "company" | "department" | "project") {
    const val = context[field].trim();
    if (!val || !hasApiKey()) return;
    setEnhancing(field);
    setPending(null);
    const labels = { company: "company", department: "department", project: "project or process" };
    try {
      const data = await apiFetch(
        {
          max_tokens: 400,
          system:
            "You are a business analyst helping write precise context descriptions for ontology and data modeling sessions. Given a brief description, return an enhanced version that is more specific, complete, and useful as AI prompt context. Return ONLY the enhanced description — no preamble, no explanation, no quotes.",
          messages: [
            {
              role: "user",
              content: `Enhance this ${labels[field]} description for data modeling context:\n\n${val}`,
            },
          ],
        },
        "assistant"
      );
      const enhanced = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      if (enhanced) setPending({ field, text: enhanced });
    } catch {
      /* ignore */
    } finally {
      setEnhancing(null);
    }
  }

  const isValid = key.trim().startsWith("sk-ant-");

  const ROLES = [
    {
      id: "assistant",
      label: "AI Assistant & Extractor",
      icon: "ti-sparkles",
      desc: "Chat panel, JSON extraction, report generation",
    },
    {
      id: "swarm",
      label: "Agent Swarm",
      icon: "ti-users-group",
      desc: "All debate personas and synthesis",
    },
    {
      id: "validator",
      label: "Platform Validator",
      icon: "ti-shield-check",
      desc: "Single analysis and matrix scoring",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
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
          width: "min(540px,94vw)",
          background: "#0f0f14",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-settings" style={{ fontSize: 14, color: T.red }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Settings</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                API key stored in session only — never sent to any server except Anthropic
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: 18 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* API Key */}
          <div>
            <label
              style={{
                fontSize: 10,
                color: T.textDim,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 7,
              }}
            >
              Anthropic API Key
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${key && isValid ? T.green : key ? T.red : T.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <input
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sk-ant-api03-…"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    padding: "8px 12px",
                    fontSize: 12.5,
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
                    padding: "0 10px",
                    fontSize: 13,
                  }}
                  title={show ? "Hide" : "Show"}
                >
                  <i className={`ti ${show ? "ti-eye-off" : "ti-eye"}`} />
                </button>
                {key && (
                  <button
                    onClick={() => {
                      setKey("");
                      CFG.clearKey();
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: T.textDim,
                      padding: "0 8px",
                      fontSize: 13,
                    }}
                    title="Clear"
                  >
                    <i className="ti ti-x" />
                  </button>
                )}
              </div>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 10.5,
                color: key && isValid ? T.green : key ? T.red : T.textDim,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {key && isValid && (
                <>
                  <i className="ti ti-check" style={{ fontSize: 11 }} /> Valid format
                </>
              )}
              {key && !isValid && (
                <>
                  <i className="ti ti-alert-circle" style={{ fontSize: 11 }} /> Should start with
                  sk-ant-
                </>
              )}
              {!key && "Get your key at console.anthropic.com"}
            </div>
            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
                fontSize: 11,
                color: T.textDim,
                lineHeight: 1.5,
              }}
            >
              <i className="ti ti-shield-lock" style={{ marginRight: 5, color: T.green }} />
              <strong style={{ color: T.text }}>Security:</strong> Your key is stored in{" "}
              <code style={{ fontFamily: "JetBrains Mono,monospace", color: T.accent }}>
                sessionStorage
              </code>{" "}
              — it is never embedded in code, never sent to any server other than{" "}
              <code style={{ fontFamily: "JetBrains Mono,monospace", color: T.accent }}>
                api.anthropic.com
              </code>
              , and is cleared when you close the browser tab.
            </div>
          </div>

          {/* Model selection per role */}
          <div>
            <label
              style={{
                fontSize: 10,
                color: T.textDim,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 7,
              }}
            >
              Model per Role
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ROLES.map((role) => (
                <div
                  key={role.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <i
                    className={`ti ${role.icon}`}
                    style={{ fontSize: 14, color: T.textMid, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{role.label}</div>
                    <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 1 }}>
                      {role.desc}
                    </div>
                  </div>
                  <select
                    value={models[role.id as keyof typeof models]}
                    onChange={(e) =>
                      setModels((m) => ({ ...m, [role.id]: e.target.value }))
                    }
                    style={{
                      background: "rgba(20,20,28,0.95)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      padding: "5px 8px",
                      fontSize: 11,
                      color: T.text,
                      outline: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.id} value={m.id} style={{ background: "#1a1a22" }}>
                        {m.label} — {m.badge}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Work Context */}
          <div>
            <label
              style={{
                fontSize: 10,
                color: T.textDim,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 7,
              }}
            >
              Work Context
            </label>
            <div
              style={{
                fontSize: 11,
                color: T.textDim,
                marginBottom: 10,
                lineHeight: 1.5,
              }}
            >
              Describe the setting — injected into AI Assistant, Swarm, and Validator prompts to tailor responses.
              {!hasApiKey() && (
                <span style={{ color: T.amber, marginLeft: 6 }}>
                  <i className="ti ti-info-circle" style={{ fontSize: 10 }} /> Add an API key to use the ✨ Enhance feature.
                </span>
              )}
            </div>
            {(
              [
                { field: "company" as const, label: "Company", placeholder: "e.g. Global retail chain with 3,000 stores across Europe" },
                { field: "department" as const, label: "Department", placeholder: "e.g. Supply Chain & Logistics, 120 people" },
                { field: "project" as const, label: "Project / Process", placeholder: "e.g. Inventory management modernisation — migrating from ERP to microservices" },
              ] as const
            ).map(({ field, label, placeholder }) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: T.textMid,
                    marginBottom: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{label}</span>
                  <button
                    onClick={() => enhance(field)}
                    disabled={enhancing !== null || !context[field].trim() || !hasApiKey()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 5,
                      background:
                        enhancing === field
                          ? "rgba(167,139,250,0.15)"
                          : "rgba(167,139,250,0.08)",
                      border: `1px solid rgba(167,139,250,0.25)`,
                      color: T.purple,
                      cursor:
                        enhancing !== null || !context[field].trim() || !hasApiKey()
                          ? "not-allowed"
                          : "pointer",
                      opacity: !context[field].trim() || !hasApiKey() ? 0.4 : 1,
                    }}
                  >
                    {enhancing === field ? (
                      <>
                        <i className="ti ti-loader-2" style={{ fontSize: 10, animation: "spin 1s linear infinite" }} />
                        Enhancing…
                      </>
                    ) : (
                      <>
                        <i className="ti ti-sparkles" style={{ fontSize: 10 }} />
                        Enhance
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={context[field]}
                  onChange={(e) => {
                    setContextState((c) => ({ ...c, [field]: e.target.value }));
                    if (pending?.field === field) setPending(null);
                  }}
                  placeholder={placeholder}
                  rows={2}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 7,
                    padding: "7px 10px",
                    fontSize: 11.5,
                    color: T.text,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "DM Sans,sans-serif",
                    lineHeight: 1.5,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = T.purple)}
                  onBlur={(e) => (e.target.style.borderColor = T.border)}
                />
                {pending?.field === field && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: "9px 12px",
                      borderRadius: 7,
                      background: "rgba(167,139,250,0.06)",
                      border: `1px solid rgba(167,139,250,0.3)`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.purple,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: 5,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <i className="ti ti-sparkles" style={{ fontSize: 10 }} />
                      Enhanced suggestion
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: T.text,
                        lineHeight: 1.6,
                        marginBottom: 8,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {pending.text}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          setContextState((c) => ({ ...c, [field]: pending.text }));
                          setPending(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "5px 0",
                          borderRadius: 6,
                          background: T.green,
                          border: "none",
                          color: "#0d0d10",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        <i className="ti ti-check" style={{ fontSize: 11 }} />
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          setContextState((c) => ({ ...c, [field]: pending.text }));
                          setPending(null);
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${T.border}`,
                          color: T.textMid,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        title="Accept and continue editing"
                      >
                        <i className="ti ti-edit" style={{ fontSize: 11 }} />
                      </button>
                      <button
                        onClick={() => setPending(null)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${T.border}`,
                          color: T.textDim,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        title="Dismiss"
                      >
                        <i className="ti ti-x" style={{ fontSize: 11 }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Autosave */}
          <div>
            <label
              style={{
                fontSize: 10,
                color: T.textDim,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 7,
              }}
            >
              Version History
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 3 }}>
                  Autosave versions
                </div>
                <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>
                  Automatically create a version checkpoint whenever entities, relations, or attributes are changed. Up to 50 versions are kept per model.
                </div>
              </div>
              <button
                onClick={() => setAutoSaveState((v) => !v)}
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  border: "none",
                  cursor: "pointer",
                  background: autoSave ? T.green : "rgba(255,255,255,0.12)",
                  position: "relative",
                  transition: "background .2s",
                }}
                title={autoSave ? "Autosave on — click to disable" : "Autosave off — click to enable"}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: autoSave ? 21 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={save}
            style={{
              padding: "9px",
              background: saved
                ? "rgba(52,211,153,0.2)"
                : isValid
                  ? T.green
                  : "rgba(79,142,247,0.15)",
              border: `1px solid ${saved ? T.green : isValid ? T.green : "rgba(79,142,247,0.4)"}`,
              borderRadius: 9,
              color: saved ? T.green : isValid ? "#0d0d10" : T.accent,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all .2s",
            }}
          >
            {saved ? (
              <>
                <i className="ti ti-check" />
                Saved!
              </>
            ) : (
              <>
                <i className="ti ti-device-floppy" />
                Save settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
