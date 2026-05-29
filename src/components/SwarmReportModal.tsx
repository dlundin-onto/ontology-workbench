import { useState, useMemo } from "react";
import type { Entity, Relation, SwarmSession, ValidationResult } from "../types";
import { T, META } from "../tokens";
import { generateWordReport, reportToHtml, downloadReportHtml } from "../lib/report";

interface SwarmReportModalProps {
  modelName: string;
  entities: Entity[];
  relations: Relation[];
  swarmSessions: SwarmSession[];
  validationResults: ValidationResult[];
  onClose: () => void;
}

// ─── Mini SVG diagram constants ─────────────────────────────────────────────
const D_COLS = 5;
const D_EW = 90;
const D_EH = 28;
const D_HGAP = 12;
const D_VGAP = 50;

function entityPos(idx: number) {
  return {
    x: 10 + (idx % D_COLS) * (D_EW + D_HGAP),
    y: 14 + Math.floor(idx / D_COLS) * (D_EH + D_VGAP),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseSwarmActions(sessions: SwarmSession[]) {
  const addedNames = new Set<string>();
  const addedRelLabels: string[] = [];
  for (const s of sessions || []) {
    try {
      const acts = JSON.parse(s.consensus?.raw || "[]");
      for (const a of acts) {
        if (a.name === "create_entity" && a.entityName) addedNames.add(a.entityName);
        if (a.name === "create_relation" && a.label) addedRelLabels.push(a.label);
      }
    } catch (_) {}
  }
  return { addedNames, addedRelLabels };
}

function sessionChangeSummary(session: SwarmSession) {
  const created: string[] = [];
  const renamed: string[] = [];
  const relations: string[] = [];
  try {
    const acts = JSON.parse(session.consensus?.raw || "[]");
    for (const a of acts) {
      if (a.name === "create_entity") created.push(a.entityName || "entity");
      if (a.name === "rename_entity") renamed.push(a.newName || "?");
      if (a.name === "create_relation") relations.push(a.label || "relation");
    }
  } catch (_) {}
  return { created, renamed, relations, total: created.length + renamed.length + relations.length };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 18px",
        borderRadius: 10,
        background: `rgba(${hexToRgbStr(color)},0.07)`,
        border: `1px solid rgba(${hexToRgbStr(color)},0.2)`,
        minWidth: 80,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function MetaBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: T.textMid }}>{label}</span>
        <span style={{ fontSize: 10.5, color, fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function SessionCard({ session, idx }: { session: SwarmSession; idx: number }) {
  const changes = sessionChangeSummary(session);
  const personas = [...new Map(session.rounds.map((r) => [r.persona?.id, r.persona])).values()].filter(Boolean);
  const shortConsensus = session.consensus?.text?.replace(/^CONSENSUS:\s*/i, "").slice(0, 180) || "—";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Session header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: T.accentDim,
            border: `1px solid ${T.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: T.accent }}>{idx + 1}</span>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>
          {session.topic}
        </div>
      </div>

      {/* Persona chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {personas.slice(0, 8).map((p) => p && (
          <span
            key={p.id}
            style={{
              fontSize: 9,
              padding: "1px 6px",
              borderRadius: 10,
              background: `rgba(${hexToRgbStr(p.color)},0.12)`,
              border: `1px solid rgba(${hexToRgbStr(p.color)},0.3)`,
              color: p.color,
              fontWeight: 500,
            }}
          >
            {p.short}
          </span>
        ))}
        {personas.length > 8 && (
          <span style={{ fontSize: 9, color: T.textDim }}>+{personas.length - 8}</span>
        )}
      </div>

      {/* Consensus */}
      <p style={{ fontSize: 10.5, color: T.textMid, lineHeight: 1.55, margin: 0 }}>
        {shortConsensus}{shortConsensus.length >= 180 ? "…" : ""}
      </p>

      {/* Changes */}
      {changes.total > 0 && (
        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            paddingTop: 7,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
            Changes applied
          </div>
          {changes.created.slice(0, 4).map((n, i) => (
            <div key={i} style={{ fontSize: 10, color: T.green, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-plus" style={{ fontSize: 9 }} /> {n}
            </div>
          ))}
          {changes.relations.slice(0, 3).map((n, i) => (
            <div key={i} style={{ fontSize: 10, color: T.accent, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-arrow-right" style={{ fontSize: 9 }} /> {n}
            </div>
          ))}
          {changes.renamed.slice(0, 2).map((n, i) => (
            <div key={i} style={{ fontSize: 10, color: T.amber, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-pencil" style={{ fontSize: 9 }} /> → {n}
            </div>
          ))}
          {changes.total > 7 && (
            <div style={{ fontSize: 9, color: T.textDim }}>+{changes.total - 7} more</div>
          )}
        </div>
      )}
    </div>
  );
}

function ModelDiagram({ entities, relations, addedNames }: { entities: Entity[]; relations: Relation[]; addedNames: Set<string> }) {
  const rows = Math.ceil(entities.length / D_COLS);
  const svgW = D_COLS * (D_EW + D_HGAP) + 20;
  const svgH = rows * (D_EH + D_VGAP) + 10;
  const idToIdx = useMemo(() => {
    const m: Record<string, number> = {};
    entities.forEach((e, i) => { m[e.id] = i; });
    return m;
  }, [entities]);

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 300 }}>
      <svg width={svgW} height={svgH} style={{ display: "block" }}>
        {/* Relations */}
        {relations.map((r) => {
          const fi = idToIdx[r.from];
          const ti = idToIdx[r.to];
          if (fi === undefined || ti === undefined) return null;
          const fp = entityPos(fi);
          const tp = entityPos(ti);
          const fx = fp.x + D_EW / 2;
          const fy = fp.y + D_EH / 2;
          const tx = tp.x + D_EW / 2;
          const ty = tp.y + D_EH / 2;
          // Control point for gentle curve
          const mx = (fx + tx) / 2;
          const my = (fy + ty) / 2 - 14;
          return (
            <g key={r.id}>
              <path
                d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
                fill="none"
                stroke="rgba(79,142,247,0.25)"
                strokeWidth={1.2}
                markerEnd="url(#arr)"
              />
              {Math.abs(fx - tx) + Math.abs(fy - ty) > 60 && (
                <text
                  x={mx}
                  y={my - 3}
                  textAnchor="middle"
                  fontSize={7}
                  fill="rgba(255,255,255,0.3)"
                >
                  {r.label.length > 12 ? r.label.slice(0, 11) + "…" : r.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(79,142,247,0.4)" />
          </marker>
        </defs>

        {/* Entity boxes */}
        {entities.map((e, i) => {
          const pos = entityPos(i);
          const meta = META[e.metaclass] || META.Entity;
          const isNew = addedNames.has(e.name);
          return (
            <g key={e.id}>
              {isNew && (
                <rect
                  x={pos.x - 2}
                  y={pos.y - 2}
                  width={D_EW + 4}
                  height={D_EH + 4}
                  rx={7}
                  fill="none"
                  stroke={T.green}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  opacity={0.6}
                />
              )}
              <rect
                x={pos.x}
                y={pos.y}
                width={D_EW}
                height={D_EH}
                rx={5}
                fill={`rgba(${hexToRgbStr(meta.color)},${isNew ? 0.18 : 0.1})`}
                stroke={isNew ? T.green : meta.color}
                strokeWidth={isNew ? 1 : 0.8}
                strokeOpacity={isNew ? 0.9 : 0.5}
              />
              <text
                x={pos.x + D_EW / 2}
                y={pos.y + D_EH / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8.5}
                fontWeight={isNew ? "600" : "500"}
                fill={isNew ? T.green : meta.color}
              >
                {e.name.length > 11 ? e.name.slice(0, 10) + "…" : e.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Report section renderer ─────────────────────────────────────────────────
function ReportSection({ text }: { text: string }) {
  const sectionIcons: Record<string, string> = {
    "EXECUTIVE SUMMARY": "ti-flag",
    "MODEL OVERVIEW": "ti-topology-star-3",
    "KEY DECISIONS": "ti-gavel",
    "DISSENTING VIEWS": "ti-alert-triangle",
    "RISKS": "ti-shield-exclamation",
    "PLATFORM FIT": "ti-server",
    "NEXT STEPS": "ti-checklist",
  };

  const sections = text.split(/\n(?=\d+\.\s+[A-Z])/);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {sections.map((section, i) => {
        const headMatch = section.match(/^(\d+)\.\s+([A-Z][A-Z &\/\-]+)\n?([\s\S]*)/);
        if (headMatch) {
          const [, num, heading, body] = headMatch;
          const iconKey = Object.keys(sectionIcons).find((k) => heading.includes(k));
          const icon = iconKey ? sectionIcons[iconKey] : "ti-point";
          return (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    background: T.accentDim,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: T.accent,
                    flexShrink: 0,
                  }}
                >
                  {num}
                </span>
                <i className={`ti ${icon}`} style={{ fontSize: 12, color: T.accent }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {heading}
                </span>
              </div>
              <div style={{ padding: "12px 16px" }}>
                {body.trim().split(/\n\n+/).map((para, pi) => (
                  <p key={pi} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.75, margin: "0 0 10px" }}>
                    {para.trim()}
                  </p>
                ))}
              </div>
            </div>
          );
        }
        return section.trim() ? (
          <p key={i} style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.75 }}>
            {section.trim()}
          </p>
        ) : null;
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SwarmReportModal({
  modelName,
  entities,
  relations,
  swarmSessions,
  validationResults,
  onClose,
}: SwarmReportModalProps) {
  const [tab, setTab] = useState<"overview" | "briefing">("overview");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [includeVal, setIncludeVal] = useState(validationResults?.length > 0);
  const [copied, setCopied] = useState(false);

  const { addedNames } = useMemo(() => parseSwarmActions(swarmSessions), [swarmSessions]);

  const totalEntities = entities.length;
  const totalAttrs = entities.reduce((s, e) => s + (e.attributes?.length || 0), 0);
  const swarmAddedCount = [...addedNames].filter((n) => entities.find((e) => e.name === n)).length;

  const byCls = (cls: string) => entities.filter((e) => e.metaclass === cls).length;

  async function generate() {
    setGenerating(true);
    setContent(null);
    try {
      const text = await generateWordReport({
        modelName,
        entities,
        relations,
        swarmSessions,
        validationResults,
        includeValidation: includeVal,
      });
      setContent(text);
    } catch (e: any) {
      setContent("Error: " + e.message);
    }
    setGenerating(false);
  }

  function copyHtml() {
    if (!content) return;
    const html = reportToHtml(modelName, content);
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const tabStyle = (active: boolean) => ({
    padding: "6px 14px",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? T.text : T.textDim,
    background: active ? "rgba(255,255,255,0.07)" : "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all .15s",
  } as React.CSSProperties);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "min(1000px,97vw)",
          height: "min(820px,95vh)",
          background: "#0d0d12",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 48px 120px rgba(0,0,0,0.75)",
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(52,211,153,0.12)",
                border: `1px solid ${T.green}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-report-analytics" style={{ fontSize: 15, color: T.green }} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{modelName}</div>
              <div style={{ fontSize: 10, color: T.textDim }}>Swarm Report · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
              <button style={tabStyle(tab === "overview")} onClick={() => setTab("overview")}>
                <i className="ti ti-layout-dashboard" style={{ marginRight: 5, fontSize: 10 }} />Overview
              </button>
              <button style={tabStyle(tab === "briefing")} onClick={() => setTab("briefing")}>
                <i className="ti ti-file-text" style={{ marginRight: 5, fontSize: 10 }} />Briefing
              </button>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: 18, lineHeight: 1, padding: "2px 6px" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
            >×</button>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* ═══ OVERVIEW TAB ════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Stat strip */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatChip icon="ti-cube" label="Entities" value={totalEntities} color={META.Entity.color} />
                <StatChip icon="ti-arrows-exchange" label="Relations" value={relations.length} color={META.Relation.color} />
                <StatChip icon="ti-tag" label="Attributes" value={totalAttrs} color={META.Attribute.color} />
                <StatChip icon="ti-users-group" label="Sessions" value={swarmSessions?.length || 0} color={T.accent} />
                {swarmAddedCount > 0 && (
                  <StatChip icon="ti-sparkles" label="Added by Swarm" value={swarmAddedCount} color={T.green} />
                )}
              </div>

              {/* Diagram + breakdown */}
              <div style={{ display: "flex", gap: 16 }}>
                {/* Mini diagram */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    Model Map
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, border: `1px dashed ${T.green}`, background: `rgba(52,211,153,0.12)` }} />
                      <span style={{ color: T.green, fontSize: 9 }}>Added by swarm</span>
                    </span>
                  </div>
                  {entities.length === 0 ? (
                    <p style={{ fontSize: 11, color: T.textDim }}>No entities in model.</p>
                  ) : (
                    <ModelDiagram entities={entities} relations={relations} addedNames={addedNames} />
                  )}
                </div>

                {/* Metaclass breakdown */}
                <div
                  style={{
                    width: 200,
                    flexShrink: 0,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    By Metaclass
                  </div>
                  <MetaBar label="Entity" count={byCls("Entity")} total={totalEntities} color={META.Entity.color} />
                  <MetaBar label="Relation" count={byCls("Relation")} total={totalEntities} color={META.Relation.color} />
                  <MetaBar label="Attribute" count={byCls("Attribute")} total={totalEntities} color={META.Attribute.color} />
                  <MetaBar label="ValueSet" count={byCls("ValueSet")} total={totalEntities} color={META.ValueSet.color} />

                  <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 14, paddingTop: 12 }}>
                    <div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      Provenance
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10.5, color: T.textMid }}>Pre-existing</span>
                        <span style={{ fontSize: 10.5, color: T.textMid, fontWeight: 600 }}>{totalEntities - swarmAddedCount}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10.5, color: T.green }}>Swarm added</span>
                        <span style={{ fontSize: 10.5, color: T.green, fontWeight: 600 }}>{swarmAddedCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session decision cards */}
              {(swarmSessions?.length || 0) > 0 && (
                <div>
                  <div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Debate Sessions — Key Decisions
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {swarmSessions.map((s, i) => (
                      <SessionCard key={s.id} session={s} idx={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ BRIEFING TAB ════════════════════════════════════════════════ */}
          {tab === "briefing" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Options + action bar */}
              <div
                style={{
                  padding: "10px 22px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                {validationResults?.length > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: T.textMid }}>
                    <input
                      type="checkbox"
                      checked={includeVal}
                      onChange={(e) => setIncludeVal(e.target.checked)}
                      style={{ accentColor: T.green }}
                    />
                    Include platform validation
                  </label>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center" }}>
                  {content && !content.startsWith("Error:") && (
                    <>
                      <button
                        onClick={copyHtml}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7,
                          background: copied ? "rgba(52,211,153,0.12)" : T.accentDim,
                          border: `1px solid ${copied ? T.green : T.accent}`,
                          color: copied ? T.green : T.accent, fontSize: 11, fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} style={{ fontSize: 10 }} />
                        {copied ? "Copied!" : "Copy HTML"}
                      </button>
                      <button
                        onClick={() => downloadReportHtml(modelName, content)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7,
                          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                          color: T.amber, fontSize: 11, fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        <i className="ti ti-download" style={{ fontSize: 10 }} />Save HTML
                      </button>
                    </>
                  )}
                  <button
                    onClick={generate}
                    disabled={generating}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7,
                      background: generating ? "rgba(52,211,153,0.12)" : T.green,
                      border: "none", color: generating ? T.green : "#0d0d10",
                      fontSize: 11, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer",
                    }}
                  >
                    {generating ? (
                      <><i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite", fontSize: 11 }} /> Generating…</>
                    ) : (
                      <><i className="ti ti-sparkles" style={{ fontSize: 11 }} />{content ? "Regenerate" : "Generate briefing"}</>
                    )}
                  </button>
                </div>
              </div>

              {/* Report content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
                {!content && !generating && (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: 0.5 }}>
                    <i className="ti ti-file-description" style={{ fontSize: 38, color: T.textDim }} />
                    <p style={{ fontSize: 12, color: T.textDim, textAlign: "center", margin: 0, lineHeight: 1.7 }}>
                      Click <strong style={{ color: T.text }}>Generate briefing</strong> to create an AI-written<br />
                      executive summary of your model and swarm debates.
                    </p>
                  </div>
                )}
                {generating && (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <i className="ti ti-loader-2" style={{ fontSize: 28, color: T.green, animation: "spin 1s linear infinite" }} />
                    <p style={{ fontSize: 12, color: T.textDim }}>Writing executive briefing…</p>
                  </div>
                )}
                {content && !generating && <ReportSection text={content} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
