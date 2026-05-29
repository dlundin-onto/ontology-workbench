import { useState, useEffect } from "react";
import type { Entity, Relation, Principle, ModelRecord, ValidationResult, ModelVersion, VersionTrigger } from "../types";
import { T } from "../tokens";
import { storageSet, makeModelRecord } from "../lib/storage";
import { PARADIGMS } from "../data/paradigms";

interface CurrentModel {
  id: string | null;
  name: string;
  entities: Entity[];
  relations: Relation[];
  principles: Principle[];
  paradigm: string;
  swarmSessions: any[];
  validationResults: ValidationResult[];
  versions: ModelVersion[];
}

interface ModelLibraryPanelProps {
  currentModel: CurrentModel;
  onLoad: (m: ModelRecord) => void;
  onCommit: (label: string) => void;
  onRestore: (v: ModelVersion) => void;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return `${day}d ago`;
}

const TRIGGER_META: Record<VersionTrigger, { label: string; color: string; icon: string }> = {
  manual:  { label: "Commit",         color: T.accent, icon: "ti-git-commit" },
  autosave:{ label: "Autosave",       color: T.textMid, icon: "ti-device-floppy" },
  swarm:   { label: "Swarm applied",  color: "#a78bfa", icon: "ti-users-group" },
  import:  { label: "Import",         color: T.amber, icon: "ti-download" },
  restore: { label: "Restored",       color: T.green, icon: "ti-history" },
};

function TriggerBadge({ trigger }: { trigger: VersionTrigger }) {
  const m = TRIGGER_META[trigger] || TRIGGER_META.autosave;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9.5,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        background: `${m.color}18`,
        color: m.color,
        letterSpacing: "0.03em",
      }}
    >
      <i className={`ti ${m.icon}`} style={{ fontSize: 9 }} />
      {m.label}
    </span>
  );
}

function CapChip({ icon, label, color, count }: { icon: string; label: string; color: string; count: number }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 9.5,
        padding: "1px 6px",
        borderRadius: 4,
        background: `${color}14`,
        color,
        border: `1px solid ${color}28`,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 9 }} />
      {count} {label}{count !== 1 ? "s" : ""}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ModelLibraryPanel({
  currentModel,
  onLoad,
  onCommit,
  onRestore,
  onClose,
}: ModelLibraryPanelProps) {
  const [tab, setTab] = useState<"library" | "history">("library");
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(currentModel.name || "Untitled Model");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [commitLabel, setCommitLabel] = useState("");
  const [showCommitForm, setShowCommitForm] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    try {
      const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("owb:model:"));
      const loaded = allKeys
        .map((k) => {
          try {
            const raw = localStorage.getItem(k);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort(
          (a: ModelRecord, b: ModelRecord) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
      setModels(loaded as ModelRecord[]);
    } catch {
      setModels([]);
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const id = currentModel.id || `model_${Date.now()}`;
    const record = makeModelRecord(
      id,
      name,
      currentModel.entities,
      currentModel.relations,
      currentModel.principles,
      currentModel.paradigm,
      currentModel.swarmSessions,
      currentModel.validationResults,
      currentModel.versions
    );
    await storageSet(`owb:model:${id}`, record);
    await loadModels();
    setSaving(false);
  }

  async function del(id: string) {
    try { localStorage.removeItem(`owb:model:${id}`); } catch { /* ignore */ }
    setConfirmDelete(null);
    await loadModels();
  }

  function handleCommit() {
    if (!commitLabel.trim()) return;
    onCommit(commitLabel.trim());
    setCommitLabel("");
    setShowCommitForm(false);
  }

  const versions = currentModel.versions || [];

  // ── Render ─────────────────────────────────────────────────────────────────

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "min(820px,95vw)",
          height: "min(680px,90vh)",
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
            padding: "13px 20px",
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
                border: `1px solid ${T.accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-folder" style={{ fontSize: 14, color: T.accent }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Models</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                Save, load and restore model versions
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* Tab switcher */}
            <div
              style={{
                display: "flex",
                gap: 1,
                padding: 3,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
              }}
            >
              {[
                { id: "library" as const, label: "Library", icon: "ti-folder" },
                { id: "history" as const, label: `History${versions.length > 0 ? ` (${versions.length})` : ""}`, icon: "ti-history" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 11px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: tab === t.id ? 500 : 400,
                    background: tab === t.id ? "rgba(255,255,255,0.08)" : "transparent",
                    color: tab === t.id ? T.text : T.textMid,
                  }}
                >
                  <i className={`ti ${t.icon}`} style={{ fontSize: 11 }} />
                  {t.label}
                </button>
              ))}
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
        </div>

        {/* ── LIBRARY TAB ── */}
        {tab === "library" && (
          <>
            {/* Save current */}
            <div
              style={{
                padding: "13px 20px",
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
                display: "flex",
                gap: 8,
                alignItems: "center",
                background: "rgba(79,142,247,0.04)",
              }}
            >
              <i className="ti ti-device-floppy" style={{ fontSize: 14, color: T.accent, flexShrink: 0 }} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Model name…"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 7,
                  padding: "6px 10px",
                  fontSize: 12.5,
                  color: T.text,
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = T.accent)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
              <div style={{ fontSize: 11, color: T.textDim, whiteSpace: "nowrap" }}>
                {currentModel.entities?.length} entities · {currentModel.swarmSessions?.length || 0} swarm · {currentModel.validationResults?.length || 0} validations
              </div>
              <button
                onClick={save}
                disabled={saving || !name.trim()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 16px",
                  background: T.accent,
                  border: "none",
                  borderRadius: 7,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  opacity: saving ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {saving
                  ? <><i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite" }} />Saving…</>
                  : <><i className="ti ti-device-floppy" />Save to library</>
                }
              </button>
            </div>

            {/* Model list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loading && (
                <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 12 }}>Loading…</div>
              )}
              {!loading && models.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0.5 }}>
                  <i className="ti ti-folder-off" style={{ fontSize: 32, color: T.textDim }} />
                  <p style={{ fontSize: 12, color: T.textDim, margin: 0 }}>No saved models yet.</p>
                </div>
              )}
              {models.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    marginBottom: 6,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${T.border}`,
                    transition: "all .1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(79,142,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="ti ti-topology-star-3" style={{ fontSize: 16, color: T.accent }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 3 }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: T.textDim, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{fmt(m.savedAt)}</span>
                      <span>{m.entities?.length || 0} entities · {m.relations?.length || 0} relations</span>
                      {(m.swarmSessions?.length ?? 0) > 0 && (
                        <span style={{ color: T.accent }}>{m.swarmSessions!.length} swarm</span>
                      )}
                      {(m.validationResults?.length ?? 0) > 0 && (
                        <span style={{ color: T.green }}>{m.validationResults!.length} validations</span>
                      )}
                      {(m.versions?.length ?? 0) > 0 && (
                        <span style={{ color: T.textDim }}>{m.versions!.length} versions</span>
                      )}
                      {m.paradigm && (
                        <span style={{ color: PARADIGMS[m.paradigm as keyof typeof PARADIGMS]?.color || T.textDim }}>
                          {PARADIGMS[m.paradigm as keyof typeof PARADIGMS]?.label || m.paradigm}
                        </span>
                      )}
                    </div>
                  </div>
                  {confirmDelete === m.id ? (
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: T.red }}>Delete?</span>
                      <button onClick={() => del(m.id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "rgba(248,113,113,0.2)", border: `1px solid ${T.red}`, color: T.red, cursor: "pointer" }}>Yes</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, cursor: "pointer" }}>No</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        onClick={() => onLoad(m)}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "5px 12px", borderRadius: 6, background: T.accentDim, border: `1px solid ${T.accent}`, color: T.accent, cursor: "pointer", fontWeight: 500 }}
                      >
                        <i className="ti ti-download" style={{ fontSize: 11 }} />Load
                      </button>
                      <button
                        onClick={() => setConfirmDelete(m.id)}
                        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.red; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = T.textDim; e.currentTarget.style.borderColor = T.border; }}
                      >
                        <i className="ti ti-trash" style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Current state banner */}
            <div
              style={{
                padding: "12px 18px",
                borderBottom: `1px solid ${T.border}`,
                background: "rgba(79,142,247,0.04)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCommitForm ? 10 : 0 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                    Current workspace
                    <span style={{ fontSize: 10, fontWeight: 400, color: T.textDim, marginLeft: 8 }}>
                      {currentModel.entities.length} entities · {currentModel.relations.length} relations
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <CapChip icon="ti-users-group" label="swarm session" color={T.accent} count={currentModel.swarmSessions?.length || 0} />
                    <CapChip icon="ti-shield-check" label="validation" color={T.green} count={currentModel.validationResults?.length || 0} />
                  </div>
                </div>
                <button
                  onClick={() => setShowCommitForm((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 14px",
                    background: showCommitForm ? "rgba(79,142,247,0.2)" : "rgba(79,142,247,0.12)",
                    border: "1px solid rgba(79,142,247,0.35)",
                    borderRadius: 7,
                    color: T.accent,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <i className="ti ti-git-commit" style={{ fontSize: 11 }} />
                  Commit version
                </button>
              </div>
              {showCommitForm && (
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <input
                    autoFocus
                    value={commitLabel}
                    onChange={(e) => setCommitLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCommit(); if (e.key === "Escape") setShowCommitForm(false); }}
                    placeholder="Describe this version… e.g. 'Added O2C entities'"
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.07)",
                      border: `1px solid ${T.accent}`,
                      borderRadius: 7,
                      padding: "7px 11px",
                      fontSize: 12,
                      color: T.text,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleCommit}
                    disabled={!commitLabel.trim()}
                    style={{ padding: "7px 14px", background: T.accent, border: "none", borderRadius: 7, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: commitLabel.trim() ? 1 : 0.4 }}
                  >
                    Commit
                  </button>
                  <button
                    onClick={() => setShowCommitForm(false)}
                    style={{ padding: "7px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, color: T.textDim, fontSize: 11, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Version list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {versions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: 0.45 }}>
                  <i className="ti ti-history" style={{ fontSize: 36, color: T.textDim }} />
                  <p style={{ fontSize: 12, color: T.textDim, margin: 0, maxWidth: 280, lineHeight: 1.6 }}>
                    No versions yet. Click "Commit version" above to save a checkpoint, or enable Autosave in Settings.
                  </p>
                </div>
              ) : (
                versions.map((v, idx) => {
                  const prev = versions[idx + 1];
                  const entityDiff = prev ? v.entityCount - prev.entityCount : null;
                  const relDiff = prev ? v.relationCount - prev.relationCount : null;
                  const isConfirming = confirmRestore === v.id;

                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "flex",
                        gap: 14,
                        marginBottom: 8,
                      }}
                    >
                      {/* Timeline line */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: idx === 0 ? T.accent : T.border,
                            border: idx === 0 ? `2px solid ${T.accent}` : `2px solid ${T.border}`,
                            flexShrink: 0,
                          }}
                        />
                        {idx < versions.length - 1 && (
                          <div style={{ width: 1, flex: 1, minHeight: 24, background: T.border, margin: "3px 0" }} />
                        )}
                      </div>

                      {/* Version card */}
                      <div
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          borderRadius: 9,
                          background: idx === 0 ? "rgba(79,142,247,0.05)" : "rgba(255,255,255,0.025)",
                          border: `1px solid ${idx === 0 ? "rgba(79,142,247,0.18)" : T.border}`,
                          marginBottom: idx < versions.length - 1 ? 6 : 0,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            {idx === 0 && (
                              <span style={{ fontSize: 9.5, fontWeight: 600, color: T.accent, background: "rgba(79,142,247,0.15)", padding: "1px 6px", borderRadius: 3 }}>
                                LATEST
                              </span>
                            )}
                            <TriggerBadge trigger={v.trigger} />
                            <span style={{ fontSize: 10.5, color: T.textDim }}>{relativeTime(v.savedAt)}</span>
                            <span style={{ fontSize: 9.5, color: T.textDim, opacity: 0.6 }}>{fmt(v.savedAt)}</span>
                          </div>

                          {/* Restore button */}
                          {isConfirming ? (
                            <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: 10.5, color: T.amber }}>Restore this version?</span>
                              <button
                                onClick={() => { onRestore(v); setConfirmRestore(null); onClose(); }}
                                style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 5, background: "rgba(52,211,153,0.18)", border: `1px solid ${T.green}`, color: T.green, cursor: "pointer", fontWeight: 600 }}
                              >
                                Yes, restore
                              </button>
                              <button
                                onClick={() => setConfirmRestore(null)}
                                style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 5, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRestore(v.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 10.5,
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: "transparent",
                                border: `1px solid ${T.border}`,
                                color: T.textMid,
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
                            >
                              <i className="ti ti-history" style={{ fontSize: 10 }} />
                              Restore
                            </button>
                          )}
                        </div>

                        {/* Label */}
                        {v.label && v.trigger === "manual" && (
                          <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 5 }}>
                            "{v.label}"
                          </div>
                        )}

                        {/* Stats row */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 10.5, color: T.textMid }}>
                            {v.entityCount} entities · {v.relationCount} relations
                          </span>
                          {entityDiff !== null && relDiff !== null && (entityDiff !== 0 || relDiff !== 0) && (
                            <span style={{ fontSize: 10, color: T.textDim }}>
                              {entityDiff > 0 ? "+" : ""}{entityDiff !== 0 ? `${entityDiff} ent` : ""}
                              {entityDiff !== 0 && relDiff !== 0 ? ", " : ""}
                              {relDiff !== 0 ? `${relDiff > 0 ? "+" : ""}${relDiff} rel` : ""}
                            </span>
                          )}
                          <CapChip icon="ti-users-group" label="swarm" color={T.accent} count={v.swarmCount} />
                          <CapChip icon="ti-shield-check" label="validation" color={T.green} count={v.validationCount} />
                          {v.paradigm && v.paradigm !== "owl" && (
                            <span style={{ fontSize: 9.5, color: PARADIGMS[v.paradigm as keyof typeof PARADIGMS]?.color || T.textDim }}>
                              {PARADIGMS[v.paradigm as keyof typeof PARADIGMS]?.label || v.paradigm}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
