import { useState } from "react";
import type { Persona } from "../types";
import { T } from "../tokens";
import { apiFetch, hasApiKey } from "../lib/api";
import { PERSONAS as DEFAULT_PERSONAS } from "../data/personas";

interface PersonasModalProps {
  personas: Persona[];
  onSave: (personas: Persona[]) => void;
  onClose: () => void;
}

const PALETTE = [
  "#4f8ef7", "#34d399", "#fbbf24", "#f97316", "#ec4899",
  "#a78bfa", "#22d3ee", "#fb7185", "#6ee7b7", "#c084fc",
  "#f472b6", "#60a5fa", "#86efac", "#fde68a", "#fca5a5",
];

const ICONS = [
  "ti-schema", "ti-cpu", "ti-user", "ti-git-branch", "ti-building-bridge",
  "ti-code", "ti-arrows-exchange", "ti-database", "ti-shield-check", "ti-lock",
  "ti-star", "ti-brain", "ti-chart-bar", "ti-cloud", "ti-layers",
  "ti-hierarchy", "ti-network", "ti-sitemap", "ti-robot", "ti-briefcase",
];

function generateId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

function PersonaCard({
  persona,
  isDefault,
  onUpdate,
  onDelete,
}: {
  persona: Persona;
  isDefault: boolean;
  onUpdate: (p: Persona) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [local, setLocal] = useState<Persona>(persona);

  function commit() {
    onUpdate(local);
    setExpanded(false);
  }

  async function generateVoice() {
    if (!hasApiKey() || generating) return;
    setGenerating(true);
    try {
      const data = await apiFetch(
        {
          max_tokens: 200,
          system:
            "You write expert persona voice prompts for AI swarm agents. Given a role name and optional description, write a 2-3 sentence voice prompt describing how this expert thinks, what they care about, and how they challenge others in a modeling debate. Write in second person 'You'. Return ONLY the voice prompt — no preamble.",
          messages: [
            {
              role: "user",
              content: `Write a swarm debate voice prompt for: ${local.name} (${local.short})\n\nFocus on their unique perspective in data modeling and ontology work.`,
            },
          ],
        },
        "assistant"
      );
      const text = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      if (text) setLocal((l) => ({ ...l, voice: text }));
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      style={{
        borderRadius: 9,
        border: `1px solid ${expanded ? local.color : T.border}`,
        background: expanded ? `rgba(${hexToRgbStr(local.color)},0.04)` : "rgba(255,255,255,0.02)",
        overflow: "hidden",
        transition: "border-color .15s",
      }}
    >
      {/* Row */}
      <button
        onClick={() => {
          if (expanded) { commit(); } else { setLocal(persona); setExpanded(true); }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `rgba(${hexToRgbStr(persona.color)},0.2)`,
            border: `1px solid ${persona.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={`ti ${persona.icon}`} style={{ fontSize: 13, color: persona.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{persona.name}</div>
          <div style={{ fontSize: 10, color: T.textDim }}>{persona.short}</div>
        </div>
        {isDefault && (
          <span
            style={{
              fontSize: 9,
              padding: "1px 6px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              color: T.textDim,
              border: `1px solid ${T.border}`,
            }}
          >
            default
          </span>
        )}
        <i
          className={`ti ti-chevron-${expanded ? "up" : "down"}`}
          style={{ fontSize: 11, color: T.textDim, flexShrink: 0 }}
        />
      </button>

      {/* Edit panel */}
      {expanded && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Name */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>Name</div>
              <input
                value={local.name}
                onChange={(e) => setLocal((l) => ({ ...l, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {/* Short */}
            <div style={{ width: 70 }}>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>Badge</div>
              <input
                value={local.short}
                onChange={(e) => setLocal((l) => ({ ...l, short: e.target.value.toUpperCase().slice(0, 4) }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Color palette */}
          <div>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 5 }}>Color</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setLocal((l) => ({ ...l, color: c }))}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: c,
                    border: local.color === c ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer",
                    padding: 0,
                    outline: local.color === c ? `2px solid ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 5 }}>Icon</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setLocal((l) => ({ ...l, icon: ic }))}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: local.icon === ic ? `rgba(${hexToRgbStr(local.color)},0.2)` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${local.icon === ic ? local.color : T.border}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <i className={`ti ${ic}`} style={{ fontSize: 13, color: local.icon === ic ? local.color : T.textMid }} />
                </button>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div>
            <div
              style={{
                fontSize: 10,
                color: T.textDim,
                marginBottom: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Voice prompt (used as debate character instruction)</span>
              <button
                onClick={generateVoice}
                disabled={generating || !hasApiKey()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 9.5,
                  padding: "2px 7px",
                  borderRadius: 5,
                  background: "rgba(167,139,250,0.08)",
                  border: `1px solid rgba(167,139,250,0.25)`,
                  color: T.purple,
                  cursor: generating || !hasApiKey() ? "not-allowed" : "pointer",
                  opacity: !hasApiKey() ? 0.4 : 1,
                }}
              >
                {generating ? (
                  <><i className="ti ti-loader-2" style={{ fontSize: 9, animation: "spin 1s linear infinite" }} /> Generating…</>
                ) : (
                  <><i className="ti ti-sparkles" style={{ fontSize: 9 }} /> Generate</>
                )}
              </button>
            </div>
            <textarea
              value={local.voice}
              onChange={(e) => setLocal((l) => ({ ...l, voice: e.target.value }))}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.5,
                fontFamily: "DM Sans,sans-serif",
                width: "100%",
                boxSizing: "border-box",
              }}
              placeholder="Describe how this persona thinks, argues, and challenges in a modeling debate…"
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
            {!isDefault && (
              <button
                onClick={onDelete}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: "rgba(248,113,113,0.08)",
                  border: `1px solid rgba(248,113,113,0.2)`,
                  color: T.red,
                  cursor: "pointer",
                }}
              >
                <i className="ti ti-trash" style={{ fontSize: 11 }} /> Delete
              </button>
            )}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button
                onClick={() => setExpanded(false)}
                style={{
                  fontSize: 11,
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  color: T.textMid,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={commit}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: local.color,
                  border: "none",
                  color: "#0d0d10",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <i className="ti ti-check" style={{ fontSize: 11 }} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hexToRgbStr(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 6,
  padding: "6px 9px",
  fontSize: 12,
  color: "#e8e8f0",
  outline: "none",
  width: "100%",
};

export function PersonasModal({ personas, onSave, onClose }: PersonasModalProps) {
  const [local, setLocal] = useState<Persona[]>(personas);
  const [saved, setSaved] = useState(false);

  const defaultIds = new Set(DEFAULT_PERSONAS.map((p) => p.id));

  function addPersona() {
    const newP: Persona = {
      id: generateId(),
      name: "New Expert",
      short: "EXP",
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      icon: "ti-star",
      voice: "",
    };
    setLocal((l) => [...l, newP]);
  }

  function save() {
    onSave(local);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 700);
  }

  function resetToDefaults() {
    if (confirm("Reset all personas to defaults? Custom personas will be lost.")) {
      setLocal([...DEFAULT_PERSONAS]);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(0,0,0,0.85)",
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
          width: "min(580px,94vw)",
          maxHeight: "90vh",
          background: "#0f0f14",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
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
                background: "rgba(79,142,247,0.15)",
                border: `1px solid rgba(79,142,247,0.35)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-users-group" style={{ fontSize: 13, color: T.accent }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Swarm Personas</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                {local.length} persona{local.length !== 1 ? "s" : ""} · click any row to edit
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={addPersona}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                padding: "5px 11px",
                borderRadius: 7,
                background: "rgba(79,142,247,0.12)",
                border: `1px solid rgba(79,142,247,0.3)`,
                color: T.accent,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 11 }} />
              Add persona
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: 18 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
            >
              ×
            </button>
          </div>
        </div>

        {/* Persona list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {local.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              isDefault={defaultIds.has(p.id)}
              onUpdate={(updated) => setLocal((l) => l.map((x) => (x.id === p.id ? updated : x)))}
              onDelete={() => setLocal((l) => l.filter((x) => x.id !== p.id))}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <button
            onClick={resetToDefaults}
            style={{
              fontSize: 11,
              padding: "6px 12px",
              borderRadius: 7,
              background: "transparent",
              border: `1px solid ${T.border}`,
              color: T.textDim,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
          >
            Reset to defaults
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={save}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 20px",
              background: saved ? "rgba(52,211,153,0.2)" : T.green,
              border: `1px solid ${T.green}`,
              borderRadius: 8,
              color: saved ? T.green : "#0d0d10",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {saved ? (
              <><i className="ti ti-check" /> Saved!</>
            ) : (
              <><i className="ti ti-device-floppy" /> Save personas</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
