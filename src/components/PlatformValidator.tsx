import { useState } from "react";
import type { Entity, Relation, Principle, ValidationResult, SwarmSession, WorkContext } from "../types";
import { T, hexToRgb } from "../tokens";
import { apiFetch, hasApiKey } from "../lib/api";
import { AiKeyRequired } from "./AiKeyRequired";
import { principlesContext, contextBlock } from "../data/principles";
import { PLATFORMS, MATRIX_DIMENSIONS } from "../data/platforms";
import { generateWordReport, downloadReportHtml } from "../lib/report";

interface PlatformValidatorProps {
  entities: Entity[];
  relations: Relation[];
  principles: Principle[];
  paradigm: string;
  validationResults: ValidationResult[];
  swarmSessions: SwarmSession[];
  workContext: WorkContext;
  onSaveValidation: (v: ValidationResult) => void;
  onClose: () => void;
}

// ── Small shared components ────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  color = T.textDim,
  action,
}: {
  icon: string;
  label: string;
  color?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        paddingBottom: 7,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 13, color }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}

function ScoreRing({
  score,
  color,
  size = 80,
}: {
  score: number;
  color: string;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset .5s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
        fill={color}
        fontSize={size === 80 ? 19 : 13}
        fontWeight={700}
        fontFamily="JetBrains Mono,monospace"
      >
        {score}
      </text>
    </svg>
  );
}

// Compact heatmap cell for the matrix view
function CellScore({ score }: { score: number }) {
  const c = score >= 70 ? T.green : score >= 40 ? T.amber : T.red;
  const s = Math.round(score);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 24,
        borderRadius: 5,
        background: `rgba(${hexToRgb(c)},0.13)`,
        border: `1px solid rgba(${hexToRgb(c)},0.22)`,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "JetBrains Mono,monospace",
        color: c,
      }}
    >
      {s}
    </div>
  );
}

// Short dimension labels for table headers
const DIM_SHORT: Record<string, string> = {
  normalization: "Norm.",
  hierarchy: "Hierarchy",
  relations: "Relations",
  temporal: "Temporal",
  ai_readiness: "AI/ML",
  governance: "Governance",
  scalability: "Scale",
  integration: "Integration",
};

// ── Main component ─────────────────────────────────────────────────────────

export function PlatformValidator({
  entities,
  relations,
  principles,
  paradigm,
  validationResults,
  swarmSessions,
  workContext,
  onSaveValidation,
  onClose,
}: PlatformValidatorProps) {
  const [view, setView] = useState<"single" | "matrix">("single");
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<any[] | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedRisks, setExpandedRisks] = useState<Set<number>>(new Set());
  const [reportError, setReportError] = useState<string | null>(null);

  // Show locked state when no API key is configured
  if (!hasApiKey()) {
    return <AiKeyRequired context="modal" title="Platform Validator" onClose={onClose} />;
  }

  const modelDesc =
    entities
      .map(
        (e) =>
          `${e.name}[${e.metaclass}](${e.attributes
            .map((a) => `${a.name}:${a.type}${a.pk ? " PK" : ""}${a.unique ? " UQ" : ""}`)
            .join(",")})`
      )
      .join("; ") +
    " | Relations: " +
    relations.map((r) => `${r.from}→${r.to}[${r.label},${r.card}]`).join(", ");

  const principlesCtx = principles ? principlesContext(principles, paradigm) : "";

  const scoreColor = (s: number) => (s >= 70 ? T.green : s >= 40 ? T.amber : T.red);
  const scoreLabel = (s: number) =>
    s >= 70 ? "Good fit" : s >= 40 ? "Viable with trade-offs" : "Poor fit";
  const scoreTier = (s: number) =>
    s >= 70 ? "The model maps well to this platform with minimal adaptation required."
    : s >= 40 ? "The model can run on this platform but requires significant trade-offs or rework."
    : "This platform has fundamental incompatibilities with the model's structure.";

  const sev: Record<string, string> = { high: T.red, medium: T.amber, low: T.green };
  const sevBg: Record<string, string> = {
    high: "rgba(248,113,113,0.08)",
    medium: "rgba(251,191,36,0.08)",
    low: "rgba(52,211,153,0.08)",
  };
  const sevBorder: Record<string, string> = {
    high: "rgba(248,113,113,0.22)",
    medium: "rgba(251,191,36,0.22)",
    low: "rgba(52,211,153,0.22)",
  };

  // ── JSON repair helper ────────────────────────────────────────────────────
  // Handles responses truncated mid-stream by finding the last complete }
  function tryParseJson(raw: string): any | null {
    // Strip markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    // Attempt 1: direct parse
    try { return JSON.parse(cleaned); } catch (_) {}

    // Attempt 2: extract first {...} block
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;
    let candidate = objMatch[0];

    // Attempt 3: parse extracted block
    try { return JSON.parse(candidate); } catch (_) {}

    // Attempt 4: repair truncated JSON by trimming to last complete key/value pair
    // Remove trailing comma + unclosed structure, then close
    candidate = candidate
      .replace(/,\s*$/, "")         // trailing comma before EOF
      .replace(/,\s*["{\[]\s*$/, "") // trailing comma + start of incomplete value
      .replace(/:\s*"[^"]*$/, ': ""') // incomplete string value
      .replace(/:\s*\[[^\]]*$/, ": []") // incomplete array
      .replace(/,\s*\{[^}]*$/, "");  // incomplete object entry
    // Count opens vs closes and add missing }
    let opens = 0, closes = 0;
    let inStr = false, esc = false;
    for (const ch of candidate) {
      if (esc) { esc = false; continue; }
      if (ch === "\\" && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{" || ch === "[") opens++;
      if (ch === "}" || ch === "]") closes++;
    }
    candidate += "}".repeat(Math.max(0, opens - closes));

    try { return JSON.parse(candidate); } catch (_) { return null; }
  }

  // ── API call ──────────────────────────────────────────────────────────────

  async function validate(platform: (typeof PLATFORMS)[number]) {
    setSelected(platform.id);
    setResult(null);
    setLoading(true);
    setExpandedRisks(new Set());
    try {
      const res = await apiFetch(
        {
          max_tokens: 5000,
          system: `You are a senior enterprise architect with deep expertise in data platform technologies. You are evaluating whether a canonical enterprise data model is well-suited for implementation on a specific technology platform.

Be rigorous, technically precise, and opinionated. A score of 70+ means genuinely good fit. 40-69 means viable with significant trade-offs. Below 40 means poor fit requiring major rework. Do not default to 0 or near-0 unless the platform is truly incompatible.

Platform context:
${platform.context}

Enterprise modeling principles:
${principlesCtx}${contextBlock(workContext)}

CRITICAL: Output ONLY valid JSON — no markdown, no backticks, no prose before or after. Start your response with { and end with }.
{
  "fit_score": <integer 0-100, calibrated honestly>,
  "executive_summary": "<2-3 sentence executive summary: overall fit, single biggest strength, single biggest risk>",
  "analysis": "<4-6 sentences: how specific entities and relations map to platform constructs, query patterns, operational concerns, and where the model needs adaptation>",
  "pros": ["<concrete strength referencing specific model elements>"],
  "cons": ["<concrete limitation referencing specific model elements>"],
  "risks": [{"issue":"<title>","severity":"high|medium|low","detail":"<1-2 sentences on the risk>","resolution":"<1-2 sentences on how to address this risk specifically>"}],
  "recommendations": ["<actionable recommendation with specific steps>"],
  "migration_notes": "<2-3 sentences on key migration and adoption considerations>"
}`,
          messages: [
            {
              role: "user",
              content: `Evaluate this enterprise data model for implementation on ${platform.name} (${platform.desc}).\n\nModel:\n${modelDesc}\n\nProvide a rigorous, calibrated assessment. Remember: respond with JSON only, starting with {`,
            },
          ],
        },
        "validator",
        `Validating · ${platform.name}`
      );
      const raw = res.content?.find((b: any) => b.type === "text")?.text || "";
      const parsed = tryParseJson(raw);
      if (parsed && typeof parsed.fit_score === "number") {
        setResult(parsed);
        onSaveValidation?.({
          platformId: platform.id,
          platformName: platform.name,
          result: parsed as import("../types").PlatformAnalysis,
          savedAt: new Date().toISOString(),
        });
      } else {
        // Parsing completely failed — show a recoverable error state
        setResult({
          _parseError: true,
          _rawResponse: raw.slice(0, 500) + (raw.length > 500 ? "…" : ""),
          executive_summary: "The response could not be parsed. The model may have returned unexpected output. Click Re-run to try again.",
          fit_score: 0,
          pros: [],
          cons: [],
          risks: [],
          recommendations: [],
          analysis: "",
          migration_notes: "",
        });
      }
    } catch (e: any) {
      setResult({
        _parseError: true,
        _rawResponse: "",
        executive_summary: `API error: ${e.message}`,
        fit_score: 0,
        pros: [],
        cons: [],
        risks: [],
        recommendations: [],
        analysis: "",
        migration_notes: "",
      });
    }
    setLoading(false);
  }

  async function runMatrix() {
    setMatrixLoading(true);
    setMatrix(null);
    try {
      const res = await apiFetch(
        {
          max_tokens: 4000,
          system: `You are a senior enterprise architect producing a comparative platform evaluation matrix. Score each platform honestly across multiple dimensions. Scores: 70+ = strong, 40-69 = moderate, below 40 = weak. Vary scores meaningfully.

Platform contexts:
${PLATFORMS.map((p) => `${p.id}: ${p.context}`).join("\n\n")}

Enterprise modeling principles:
${principlesCtx}${contextBlock(workContext)}

Output ONLY valid JSON array (no markdown):
[{"platformId":"<id>","overall":<0-100>,"dimensions":{"normalization":<0-100>,"hierarchy":<0-100>,"relations":<0-100>,"temporal":<0-100>,"ai_readiness":<0-100>,"governance":<0-100>,"scalability":<0-100>,"integration":<0-100>},"headline":"<one sharp sentence>"}]`,
          messages: [
            {
              role: "user",
              content: `Score all 7 platforms across all 8 dimensions for this enterprise model:\n\n${modelDesc}\n\nBe rigorous and differentiated.`,
            },
          ],
        },
        "validator",
        "Platform matrix · Scoring all platforms"
      );
      const raw = res.content?.find((b: any) => b.type === "text")?.text || "[]";
      // Use the same repair logic, but for a JSON array
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      let parsed: any[] | null = null;
      try { parsed = JSON.parse(cleaned); } catch (_) {}
      if (!parsed) {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { parsed = JSON.parse(arrMatch[0]); } catch (_) {}
        }
      }
      if (Array.isArray(parsed)) setMatrix(parsed);
    } catch (e) {
      console.error(e);
    }
    setMatrixLoading(false);
  }

  async function handleGenerateReport() {
    if (!result || !selected) return;
    const pl = PLATFORMS.find((p) => p.id === selected);
    if (!pl) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const reportName = `${pl.name} — Architectural Review`;
      const text = await generateWordReport({
        modelName: reportName,
        entities,
        relations,
        swarmSessions,
        validationResults: [{ platformId: pl.id, platformName: pl.name, result, savedAt: new Date().toISOString() }],
        includeValidation: true,
      });
      downloadReportHtml(reportName, text);
    } catch (e: any) {
      setReportError(e.message || "Report generation failed.");
    }
    setReportLoading(false);
  }

  function toggleRisk(i: number) {
    setExpandedRisks((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

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
          width: "min(1200px,97vw)",
          height: "min(860px,94vh)",
          background: "#0f0f14",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
        }}
      >
        {/* ── Modal header ── */}
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
                background: "rgba(52,211,153,0.12)",
                border: `1px solid ${T.green}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-shield-check" style={{ fontSize: 14, color: T.green }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Platform Validator</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                Architectural fit review · {entities.length} entities · {relations.length} relations
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                { id: "single" as const, label: "Review", icon: "ti-file-description" },
                { id: "matrix" as const, label: "Matrix", icon: "ti-layout-grid" },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: view === v.id ? 500 : 400,
                    background: view === v.id ? "rgba(255,255,255,0.08)" : "transparent",
                    color: view === v.id ? T.text : T.textMid,
                  }}
                >
                  <i className={`ti ${v.icon}`} style={{ fontSize: 12 }} />
                  {v.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: 18, lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Single review view ── */}
        {view === "single" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Platform picker sidebar */}
            <div
              style={{
                width: 216,
                borderRight: `1px solid ${T.border}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  color: T.textDim,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  padding: "12px 14px 8px",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                Select Platform
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
                {PLATFORMS.map((pl) => {
                  const saved = validationResults.find((v) => v.platformId === pl.id);
                  const isSelected = selected === pl.id;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => {
                        if (saved && !isSelected) {
                          // restore saved result
                          setSelected(pl.id);
                          setResult(saved.result);
                          setExpandedRisks(new Set());
                        } else {
                          validate(pl);
                        }
                      }}
                      disabled={loading}
                      title={saved ? `Last run: ${new Date(saved.savedAt).toLocaleDateString()}` : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "9px 11px",
                        borderRadius: 9,
                        marginBottom: 4,
                        width: "100%",
                        background: isSelected
                          ? `rgba(${hexToRgb(pl.color)},0.12)`
                          : "rgba(255,255,255,0.025)",
                        border: `1px solid ${isSelected ? pl.color : T.border}`,
                        cursor: loading ? "not-allowed" : "pointer",
                        textAlign: "left",
                        transition: "all .15s",
                        opacity: loading && !isSelected ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!loading && !isSelected) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.055)";
                          e.currentTarget.style.borderColor = T.borderHi;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                          e.currentTarget.style.borderColor = T.border;
                        }
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: `rgba(${hexToRgb(pl.color)},0.15)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <i className={`ti ${pl.icon}`} style={{ fontSize: 13, color: pl.color }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: isSelected ? 500 : 400,
                            color: isSelected ? pl.color : T.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {pl.name}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            color: T.textDim,
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {pl.desc}
                        </div>
                      </div>
                      {saved && (
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            fontFamily: "JetBrains Mono,monospace",
                            color: scoreColor(saved.result.fit_score),
                            background: `rgba(${hexToRgb(scoreColor(saved.result.fit_score))},0.12)`,
                            borderRadius: 4,
                            padding: "1px 5px",
                            flexShrink: 0,
                          }}
                        >
                          {saved.result.fit_score}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Swarm hint */}
              {swarmSessions.length > 0 && (
                <div
                  style={{
                    margin: "0 10px 10px",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(79,142,247,0.06)",
                    border: "1px solid rgba(79,142,247,0.18)",
                    fontSize: 10.5,
                    color: T.textMid,
                    lineHeight: 1.5,
                  }}
                >
                  <i className="ti ti-users-group" style={{ fontSize: 11, color: T.accent, marginRight: 5 }} />
                  {swarmSessions.length} swarm session{swarmSessions.length > 1 ? "s" : ""} will be included in generated reports.
                </div>
              )}
            </div>

            {/* Results pane */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Empty / loading states */}
              {!selected && !loading && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: 0.45 }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 40, color: T.textDim }} />
                  <p style={{ fontSize: 12, color: T.textDim, textAlign: "center", margin: 0, maxWidth: 220 }}>
                    Select a platform to run an architectural fit review
                  </p>
                </div>
              )}
              {loading && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <i className="ti ti-loader-2" style={{ fontSize: 30, color: T.accent, animation: "spin 1s linear infinite" }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12.5, color: T.text, margin: "0 0 4px", fontWeight: 500 }}>Running architectural review…</p>
                    <p style={{ fontSize: 11, color: T.textDim, margin: 0 }}>Evaluating fit against model structure and principles</p>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && !loading && (() => {
                const pl = PLATFORMS.find((p) => p.id === selected)!;
                const score = result.fit_score ?? 50;
                const sc = scoreColor(score);
                const sortedRisks = [...(result.risks || [])].sort((a: any, b: any) => {
                  const ord: Record<string, number> = { high: 0, medium: 1, low: 2 };
                  return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3);
                });

                return (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Sticky review header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 20px",
                        borderBottom: `1px solid ${T.border}`,
                        background: "#0f0f14",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <i className={`ti ${pl.icon}`} style={{ fontSize: 15, color: pl.color }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{pl.name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: `rgba(${hexToRgb(sc)},0.14)`,
                            color: sc,
                            fontWeight: 500,
                            border: `1px solid rgba(${hexToRgb(sc)},0.3)`,
                          }}
                        >
                          {scoreLabel(score)}
                        </span>
                        <span style={{ fontSize: 10, color: T.textDim }}>
                          Architectural Review
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {reportError && (
                          <span style={{ fontSize: 10.5, color: T.red, maxWidth: 200, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={reportError}>
                            <i className="ti ti-alert-circle" style={{ fontSize: 11, marginRight: 4 }} />
                            {reportError}
                          </span>
                        )}
                        <button
                          onClick={() => validate(pl)}
                          disabled={loading}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 12px",
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${T.border}`,
                            borderRadius: 7,
                            color: T.textMid,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.borderHi)}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
                        >
                          <i className="ti ti-refresh" style={{ fontSize: 11 }} />
                          Re-run
                        </button>
                        <button
                          onClick={handleGenerateReport}
                          disabled={reportLoading || !!result?._parseError || !!result?._fromMatrix}
                          title={result?._parseError ? "Cannot export — review failed to parse" : "Download architectural review as HTML"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 14px",
                            background: reportLoading ? "rgba(79,142,247,0.2)" : "rgba(79,142,247,0.15)",
                            border: "1px solid rgba(79,142,247,0.35)",
                            borderRadius: 7,
                            color: T.accent,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: (reportLoading || result?._parseError) ? "not-allowed" : "pointer",
                            opacity: result?._parseError ? 0.45 : 1,
                          }}
                        >
                          {reportLoading ? (
                            <i className="ti ti-loader-2" style={{ fontSize: 11, animation: "spin 1s linear infinite" }} />
                          ) : (
                            <i className="ti ti-download" style={{ fontSize: 11 }} />
                          )}
                          {reportLoading ? "Generating…" : "Export HTML"}
                        </button>
                      </div>
                    </div>

                    {/* Scrollable review body */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

                      {/* ── Matrix preview state ── */}
                      {result._fromMatrix && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20, padding: "32px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 28px", borderRadius: 14, background: `rgba(${hexToRgb(pl.color)},0.07)`, border: `1px solid rgba(${hexToRgb(pl.color)},0.2)` }}>
                            <ScoreRing score={score} color={sc} size={80} />
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 5 }}>
                                Matrix score · {pl.name}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 4 }}>
                                {result.executive_summary || scoreLabel(score)}
                              </div>
                              <div style={{ fontSize: 10.5, color: T.textDim }}>
                                This is the overall score from the comparison matrix. Run a detailed review for the full architectural analysis.
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => validate(pl)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              padding: "10px 24px",
                              background: `rgba(${hexToRgb(pl.color)},0.15)`,
                              border: `1px solid rgba(${hexToRgb(pl.color)},0.4)`,
                              borderRadius: 9,
                              color: pl.color,
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(${hexToRgb(pl.color)},0.25)`)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = `rgba(${hexToRgb(pl.color)},0.15)`)}
                          >
                            <i className="ti ti-shield-check" style={{ fontSize: 14 }} />
                            Run detailed review
                          </button>
                        </div>
                      )}

                      {/* ── Parse error banner ── */}
                      {!result._fromMatrix && result._parseError && (
                        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <i className="ti ti-alert-circle" style={{ fontSize: 16, color: T.red, flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.red, marginBottom: 4 }}>Response parse error</div>
                            <p style={{ fontSize: 11.5, color: T.textMid, lineHeight: 1.6, margin: "0 0 8px" }}>
                              {result.executive_summary}
                            </p>
                            {result._rawResponse && (
                              <details style={{ fontSize: 10.5, color: T.textDim }}>
                                <summary style={{ cursor: "pointer", userSelect: "none" }}>Show raw response</summary>
                                <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10 }}>{result._rawResponse}</pre>
                              </details>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── 1. Executive Summary ── */}
                      {!result._fromMatrix && !result._parseError && (
                      <div
                        style={{
                          padding: "18px 20px",
                          borderRadius: 12,
                          background: `rgba(${hexToRgb(pl.color)},0.06)`,
                          border: `1px solid rgba(${hexToRgb(pl.color)},0.2)`,
                        }}
                      >
                        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                          <ScoreRing score={score} color={sc} size={80} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Executive Summary
                              </span>
                              <span style={{ fontSize: 9, color: T.textDim }}>·</span>
                              <span style={{ fontSize: 10.5, color: sc }}>{scoreTier(score)}</span>
                            </div>
                            {result.executive_summary && (
                              <p style={{ fontSize: 13, color: T.text, lineHeight: 1.72, margin: "0 0 10px" }}>
                                {result.executive_summary}
                              </p>
                            )}
                            {/* Score tier bar */}
                            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                              {["Poor fit", "Viable", "Good fit"].map((tier, i) => {
                                const tierColors = [T.red, T.amber, T.green];
                                const active = (i === 0 && score < 40) || (i === 1 && score >= 40 && score < 70) || (i === 2 && score >= 70);
                                return (
                                  <div
                                    key={tier}
                                    style={{
                                      padding: "2px 9px",
                                      borderRadius: 4,
                                      fontSize: 9.5,
                                      fontWeight: active ? 600 : 400,
                                      background: active ? `rgba(${hexToRgb(tierColors[i])},0.18)` : "rgba(255,255,255,0.04)",
                                      color: active ? tierColors[i] : T.textDim,
                                      border: `1px solid ${active ? `rgba(${hexToRgb(tierColors[i])},0.3)` : "transparent"}`,
                                    }}
                                  >
                                    {tier}
                                  </div>
                                );
                              })}
                              <span style={{ fontSize: 10, color: T.textDim, marginLeft: 6 }}>
                                Score: <b style={{ color: sc, fontFamily: "JetBrains Mono,monospace" }}>{score}</b>/100
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* ── 2. Architectural Analysis ── */}
                      {!result._fromMatrix && result.analysis && (
                        <div style={{ padding: "15px 18px", borderRadius: 10, background: "rgba(255,255,255,0.028)", border: `1px solid ${T.border}` }}>
                          <SectionHeader icon="ti-building-arch" label="Architectural Analysis" color={T.accent} />
                          {/* Split into readable paragraphs (group 2 sentences each) */}
                          {(() => {
                            const sentences: string[] = (result.analysis as string)
                              .replace(/\.\s+(?=[A-Z])/g, ".|")
                              .split("|")
                              .filter(Boolean);
                            const paras: string[] = [];
                            for (let i = 0; i < sentences.length; i += 2) {
                              paras.push(
                                [sentences[i], sentences[i + 1]].filter(Boolean).join(" ")
                              );
                            }
                            return paras.map((para, i) => (
                              <p key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.78, margin: i === 0 ? 0 : "8px 0 0" }}>
                                {para.trim()}
                              </p>
                            ));
                          })()}
                        </div>
                      )}

                      {/* ── 3. Strengths & Limitations ── */}
                      {!result._fromMatrix && (result.pros?.length > 0 || result.cons?.length > 0) && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          {/* Strengths */}
                          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.18)" }}>
                            <SectionHeader icon="ti-circle-check" label="Strategic Strengths" color={T.green} />
                            {(result.pros || []).map((p: string, i: number) => (
                              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    background: "rgba(52,211,153,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    marginTop: 1,
                                  }}
                                >
                                  <i className="ti ti-check" style={{ fontSize: 9, color: T.green }} />
                                </div>
                                <span style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{p}</span>
                              </div>
                            ))}
                          </div>
                          {/* Limitations */}
                          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.18)" }}>
                            <SectionHeader icon="ti-alert-triangle" label="Implementation Limitations" color={T.red} />
                            {(result.cons || []).map((c: string, i: number) => (
                              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    background: "rgba(248,113,113,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    marginTop: 1,
                                  }}
                                >
                                  <i className="ti ti-x" style={{ fontSize: 9, color: T.red }} />
                                </div>
                                <span style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── 4. Implementation Risks ── */}
                      {!result._fromMatrix && sortedRisks.length > 0 && (
                        <div>
                          <SectionHeader
                            icon="ti-shield-exclamation"
                            label={`Implementation Risks (${sortedRisks.length})`}
                            color={T.amber}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {sortedRisks.map((r: any, i: number) => {
                              const expanded = expandedRisks.has(i);
                              return (
                                <div
                                  key={i}
                                  style={{
                                    borderRadius: 9,
                                    background: sevBg[r.severity] || "rgba(255,255,255,0.03)",
                                    border: `1px solid ${sevBorder[r.severity] || T.border}`,
                                    overflow: "hidden",
                                  }}
                                >
                                  <button
                                    onClick={() => r.resolution && toggleRisk(i)}
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      padding: "10px 14px",
                                      width: "100%",
                                      background: "none",
                                      border: "none",
                                      cursor: r.resolution ? "pointer" : "default",
                                      textAlign: "left",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: "2px 7px",
                                        borderRadius: 4,
                                        background: `rgba(${r.severity === "high" ? "248,113,113" : r.severity === "medium" ? "251,191,36" : "52,211,153"},0.18)`,
                                        color: sev[r.severity] || T.textMid,
                                        textTransform: "uppercase",
                                        flexShrink: 0,
                                        alignSelf: "flex-start",
                                        marginTop: 2,
                                        letterSpacing: "0.04em",
                                      }}
                                    >
                                      {r.severity}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text, marginBottom: 3 }}>
                                        {r.issue}
                                      </div>
                                      <div style={{ fontSize: 11.5, color: T.textMid, lineHeight: 1.58 }}>
                                        {r.detail}
                                      </div>
                                    </div>
                                    {r.resolution && (
                                      <div style={{ color: T.textDim, fontSize: 12, flexShrink: 0, alignSelf: "flex-start", marginTop: 1 }}>
                                        <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} />
                                      </div>
                                    )}
                                  </button>
                                  {r.resolution && expanded && (
                                    <div
                                      style={{
                                        padding: "0 14px 11px 14px",
                                        display: "flex",
                                        gap: 9,
                                        alignItems: "flex-start",
                                        borderTop: `1px solid rgba(${r.severity === "high" ? "248,113,113" : r.severity === "medium" ? "251,191,36" : "52,211,153"},0.15)`,
                                        paddingTop: 10,
                                      }}
                                    >
                                      <i className="ti ti-bulb" style={{ fontSize: 13, color: T.amber, flexShrink: 0, marginTop: 1 }} />
                                      <div>
                                        <div style={{ fontSize: 9.5, fontWeight: 600, color: T.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                                          Resolution Suggestion
                                        </div>
                                        <p style={{ fontSize: 11.5, color: T.textMid, lineHeight: 1.62, margin: 0 }}>
                                          {r.resolution}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {sortedRisks.some((r: any) => r.resolution) && (
                            <div style={{ fontSize: 10, color: T.textDim, marginTop: 5, textAlign: "right" }}>
                              Click a risk to reveal the resolution suggestion
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── 5. Recommendations ── */}
                      {!result._fromMatrix && result.recommendations?.length > 0 && (
                        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(79,142,247,0.04)", border: "1px solid rgba(79,142,247,0.16)" }}>
                          <SectionHeader icon="ti-wand" label="Recommendations" color={T.accent} />
                          {result.recommendations.map((r: string, i: number) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                gap: 10,
                                padding: "7px 0",
                                borderBottom: i < result.recommendations.length - 1 ? `1px solid rgba(79,142,247,0.08)` : "none",
                                alignItems: "flex-start",
                              }}
                            >
                              <div
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 5,
                                  background: "rgba(79,142,247,0.15)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: T.accent,
                                  fontFamily: "JetBrains Mono,monospace",
                                }}
                              >
                                {i + 1}
                              </div>
                              <span style={{ fontSize: 12, color: T.text, lineHeight: 1.62, paddingTop: 2 }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── 6. Migration & Adoption ── */}
                      {!result._fromMatrix && result.migration_notes && (
                        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}` }}>
                          <SectionHeader icon="ti-route" label="Migration & Adoption Considerations" />
                          <p style={{ fontSize: 12, color: T.textMid, lineHeight: 1.72, margin: 0 }}>
                            {result.migration_notes}
                          </p>
                        </div>
                      )}

                      {/* Bottom padding */}
                      <div style={{ height: 8 }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Matrix view ── */}
        {view === "matrix" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div
              style={{
                padding: "11px 20px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: T.textMid, margin: 0 }}>
                  Comparative scoring across 8 architectural dimensions — calibrated for this specific model.
                  Click any platform row to open a detailed review.
                </p>
              </div>
              <button
                onClick={runMatrix}
                disabled={matrixLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  background: matrixLoading ? "rgba(79,142,247,0.2)" : T.accent,
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: matrixLoading ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                {matrixLoading ? (
                  <><i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite" }} />Scoring…</>
                ) : (
                  <><i className="ti ti-sparkles" />Run matrix</>
                )}
              </button>
            </div>

            <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", padding: 20 }}>
              {!matrix && !matrixLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, opacity: 0.45 }}>
                  <i className="ti ti-layout-grid" style={{ fontSize: 40, color: T.textDim }} />
                  <p style={{ fontSize: 12, color: T.textDim, textAlign: "center", margin: 0 }}>
                    Click "Run matrix" to score all platforms across dimensions
                  </p>
                </div>
              )}
              {matrixLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <i className="ti ti-loader-2" style={{ fontSize: 28, color: T.accent, animation: "spin 1s linear infinite" }} />
                  <p style={{ fontSize: 12, color: T.textDim }}>Scoring all platforms…</p>
                </div>
              )}
              {matrix && !matrixLoading && (() => {
                const sorted = [...matrix].sort((a, b) => b.overall - a.overall);
                return (
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700, fontSize: 11.5 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: T.textDim, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}`, width: 150, position: "sticky", left: 0, background: "#0f0f14" }}>
                          Platform
                        </th>
                        <th style={{ textAlign: "center", padding: "8px 6px", fontSize: 10, color: T.amber, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}`, width: 64 }}>
                          Overall
                        </th>
                        {MATRIX_DIMENSIONS.map((d) => (
                          <th key={d.id} style={{ textAlign: "center", padding: "8px 4px", fontSize: 9.5, color: T.textDim, borderBottom: `1px solid ${T.border}`, width: 60 }} title={d.desc}>
                            {DIM_SHORT[d.id] || d.label}
                          </th>
                        ))}
                        <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, color: T.textDim, borderBottom: `1px solid ${T.border}`, minWidth: 160 }}>
                          Headline
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row, rowIdx) => {
                        const pl = PLATFORMS.find((p) => p.id === row.platformId);
                        if (!pl) return null;
                        const oc = scoreColor(row.overall);
                        return (
                          <tr
                            key={row.platformId}
                            style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, cursor: "pointer" }}
                            onClick={() => {
                              setView("single");
                              const saved = validationResults.find((v) => v.platformId === pl.id);
                              if (saved) {
                                // Reuse the detailed result — no new call, no score drift
                                setSelected(pl.id);
                                setResult(saved.result);
                                setExpandedRisks(new Set());
                              } else {
                                // No detailed result yet — show matrix score as preview
                                setSelected(pl.id);
                                setResult({
                                  _fromMatrix: true,
                                  fit_score: row.overall,
                                  executive_summary: row.headline,
                                  analysis: "",
                                  pros: [],
                                  cons: [],
                                  risks: [],
                                  recommendations: [],
                                  migration_notes: "",
                                });
                                setExpandedRisks(new Set());
                              }
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "8px 10px", position: "sticky", left: 0, background: "#0f0f14" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                {rowIdx === 0 && (
                                  <i className="ti ti-crown" style={{ fontSize: 9, color: T.amber }} title="Top pick" />
                                )}
                                <div style={{ width: 20, height: 20, borderRadius: 5, background: `rgba(${hexToRgb(pl.color)},0.18)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <i className={`ti ${pl.icon}`} style={{ fontSize: 10, color: pl.color }} />
                                </div>
                                <span style={{ fontSize: 11.5, fontWeight: 500, color: T.text, whiteSpace: "nowrap" }}>{pl.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", background: `rgba(${hexToRgb(oc)},0.12)`, border: `1.5px solid ${oc}` }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: oc }}>{row.overall}</span>
                              </div>
                            </td>
                            {MATRIX_DIMENSIONS.map((d) => (
                              <td key={d.id} style={{ padding: "8px 4px", textAlign: "center" }}>
                                <CellScore score={row.dimensions?.[d.id] ?? 0} />
                              </td>
                            ))}
                            <td style={{ padding: "8px 10px", fontSize: 11, color: T.textMid, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.headline}>
                              {row.headline}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
