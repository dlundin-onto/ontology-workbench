import { useState } from "react";
import type { Principle } from "../types";
import { T, hexToRgb } from "../tokens";
import { PARADIGMS } from "../data/paradigms";

const PRINCIPLE_CATEGORIES = [
  "Scope & Intent",
  "Structural Quality",
  "Data Platform & AI",
  "Governance",
];

interface PrinciplesPanelProps {
  principles: Principle[];
  setPrinciples: React.Dispatch<React.SetStateAction<Principle[]>>;
  paradigm: string;
  setParadigm: (id: string) => void;
  onClose: () => void;
}

export function PrinciplesPanel({
  principles,
  setPrinciples,
  paradigm,
  setParadigm,
  onClose,
}: PrinciplesPanelProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Principle>>({});
  const [addingNew, setAddingNew] = useState(false);

  function toggle(id: string) {
    setPrinciples((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  }

  function startEdit(p: Principle) {
    setEditId(p.id);
    setEditDraft({ ...p });
    setAddingNew(false);
  }

  function saveEdit() {
    if (addingNew) {
      setPrinciples((prev) => [
        ...prev,
        { ...(editDraft as Principle), id: `p${Date.now()}` },
      ]);
      setAddingNew(false);
    } else {
      setPrinciples((prev) =>
        prev.map((p) => (p.id === editId ? (editDraft as Principle) : p))
      );
    }
    setEditId(null);
  }

  function startNew() {
    setEditDraft({ title: "", body: "", category: "Scope & Intent", active: true });
    setAddingNew(true);
    setEditId("__new__");
  }

  function del(id: string) {
    setPrinciples((prev) => prev.filter((p) => p.id !== id));
    if (editId === id) setEditId(null);
  }

  const grouped = PRINCIPLE_CATEGORIES.map((cat) => ({
    cat,
    items: principles.filter((p) => p.category === cat),
  }));

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px,95vw)",
          height: "min(760px,92vh)",
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
                background: "rgba(251,191,36,0.15)",
                border: `1px solid ${T.amber}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-certificate" style={{ fontSize: 14, color: T.amber }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Enterprise Modeling Principles
              </div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                Foundational rules known by all agents and the AI assistant
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, color: T.textDim }}>
              {principles.filter((p) => p.active).length} of {principles.length} active
            </span>
            <button
              onClick={startNew}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                padding: "5px 12px",
                borderRadius: 7,
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: T.amber,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add principle
            </button>
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
          {/* Principle list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Paradigm selector */}
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  color: T.textDim,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div style={{ width: 16, height: 1, background: T.border }} /> Modeling Paradigm{" "}
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                {Object.values(PARADIGMS).map((p) => {
                  const active = paradigm === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setParadigm(p.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: active
                          ? `rgba(${hexToRgb(p.color)},0.12)`
                          : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${active ? p.color : T.border}`,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all .15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                          e.currentTarget.style.borderColor = T.borderHi;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          e.currentTarget.style.borderColor = T.border;
                        }
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: `rgba(${hexToRgb(p.color)},0.18)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className={`ti ${p.icon}`}
                            style={{ fontSize: 12, color: p.color }}
                          />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: active ? p.color : T.text,
                            }}
                          >
                            {p.label}
                          </div>
                          <div style={{ fontSize: 10, color: T.textDim }}>{p.tagline}</div>
                        </div>
                        {active && (
                          <div
                            style={{
                              marginLeft: "auto",
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: p.color,
                              flexShrink: 0,
                              boxShadow: `0 0 6px ${p.color}`,
                            }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.55 }}>
                        {p.description.slice(0, 140)}…
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          padding: "7px 10px",
                          borderRadius: 7,
                          background: `rgba(${hexToRgb(p.color)},0.07)`,
                          border: `1px solid rgba(${hexToRgb(p.color)},0.15)`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9.5,
                            color: p.color,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Relation model
                        </div>
                        <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.5 }}>
                          {p.relationModel}
                        </div>
                      </div>
                      {active && p.hints.length > 0 && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          {p.hints.map((h, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                gap: 6,
                                fontSize: 10.5,
                                color: T.textMid,
                                lineHeight: 1.4,
                              }}
                            >
                              <span style={{ color: p.color, flexShrink: 0 }}>·</span>
                              {h}
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {grouped.map(({ cat, items }) =>
              items.length === 0 ? null : (
                <div key={cat}>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: T.textDim,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div style={{ width: 16, height: 1, background: T.border }} />
                    {cat}
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                  </div>
                  {items.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        marginBottom: 6,
                        borderRadius: 9,
                        background: p.active
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(255,255,255,0.015)",
                        border: `1px solid ${p.active ? T.border : "rgba(255,255,255,0.04)"}`,
                        overflow: "hidden",
                        transition: "all .15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                        }}
                      >
                        <button
                          onClick={() => toggle(p.id)}
                          style={{
                            flexShrink: 0,
                            width: 32,
                            height: 18,
                            borderRadius: 9,
                            background: p.active
                              ? "rgba(251,191,36,0.25)"
                              : "rgba(255,255,255,0.08)",
                            border: `1px solid ${p.active ? T.amber : T.border}`,
                            cursor: "pointer",
                            position: "relative",
                            transition: "all .2s",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 2,
                              left: p.active ? 14 : 2,
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: p.active ? T.amber : "rgba(255,255,255,0.3)",
                              transition: "left .2s",
                            }}
                          />
                        </button>
                        <div
                          style={{
                            flex: 1,
                            fontSize: 12,
                            fontWeight: 500,
                            color: p.active ? T.text : T.textDim,
                          }}
                        >
                          {p.title}
                        </div>
                        <button
                          onClick={() => startEdit(p)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: T.textDim,
                            fontSize: 13,
                            padding: "2px 4px",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                        >
                          <i className="ti ti-pencil" />
                        </button>
                        <button
                          onClick={() => del(p.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: T.textDim,
                            fontSize: 13,
                            padding: "2px 4px",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                      {p.active && (
                        <div
                          style={{
                            padding: "0 14px 10px 56px",
                            fontSize: 11.5,
                            color: T.textMid,
                            lineHeight: 1.65,
                          }}
                        >
                          {p.body}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Edit pane */}
          {editId && (
            <div
              style={{
                width: 340,
                borderLeft: `1px solid ${T.border}`,
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.01)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${T.border}`,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 500, color: T.text }}>
                  {addingNew ? "New principle" : "Edit principle"}
                </span>
                <button
                  onClick={() => setEditId(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: T.textDim,
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 9.5,
                      color: T.textDim,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    Category
                  </label>
                  <select
                    value={editDraft.category || "Scope & Intent"}
                    onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 7,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: T.text,
                      outline: "none",
                    }}
                  >
                    {PRINCIPLE_CATEGORIES.map((c) => (
                      <option key={c} style={{ background: "#1a1a22" }}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 9.5,
                      color: T.textDim,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    Title
                  </label>
                  <input
                    value={editDraft.title || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 7,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: T.text,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = T.amber)}
                    onBlur={(e) => (e.target.style.borderColor = T.border)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 9.5,
                      color: T.textDim,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={editDraft.body || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, body: e.target.value }))}
                    rows={8}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 7,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: T.text,
                      outline: "none",
                      resize: "vertical",
                      lineHeight: 1.6,
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = T.amber)}
                    onBlur={(e) => (e.target.style.borderColor = T.border)}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setEditDraft((d) => ({ ...d, active: !d.active }))}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: editDraft.active ? "rgba(251,191,36,0.15)" : "transparent",
                      border: `1px solid ${editDraft.active ? T.amber : T.border}`,
                      color: editDraft.active ? T.amber : T.textDim,
                      cursor: "pointer",
                    }}
                  >
                    {editDraft.active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: `1px solid ${T.border}`,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={saveEdit}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: T.amber,
                    border: "none",
                    borderRadius: 8,
                    color: "#0d0d10",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {addingNew ? "Add principle" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
