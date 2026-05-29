import { useState, useRef, useEffect } from "react";
import type { Entity, Relation, Principle, DebateRound, SwarmConsensus, SwarmSession, Persona, WorkContext } from "../types";
import { T, hexToRgb } from "../tokens";
import { apiFetch, hasApiKey } from "../lib/api";
import { AiKeyRequired } from "./AiKeyRequired";
import { executeTool } from "../lib/tools";
import { principlesContext, contextBlock } from "../data/principles";
import { DebateMessage } from "./DebateMessage";
import { SwarmReportModal } from "./SwarmReportModal";

interface SwarmPanelProps {
  entities: Entity[];
  relations: Relation[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  setRelations: React.Dispatch<React.SetStateAction<Relation[]>>;
  principles: Principle[];
  paradigm: string;
  swarmSessions: SwarmSession[];
  personas: Persona[];
  workContext: WorkContext;
  onSaveSession: (s: SwarmSession) => void;
  onOpenPersonas: () => void;
  onClose: () => void;
}

export function SwarmPanel({
  entities,
  relations,
  setEntities,
  setRelations,
  principles,
  paradigm,
  swarmSessions,
  personas,
  workContext,
  onSaveSession,
  onOpenPersonas,
  onClose,
}: SwarmPanelProps) {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [consensus, setConsensus] = useState<SwarmConsensus | null>(null);
  const [activePersonas, setActivePersonas] = useState(personas.map((p) => p.id));
  const [appliedActions, setAppliedActions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySummary, setApplySummary] = useState<string[]>([]);
  const [rightTab, setRightTab] = useState<"personas" | "history">("personas");
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null); // session id if viewing history
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rounds, consensus]);

  // Show locked state when no API key is configured
  if (!hasApiKey()) {
    return <AiKeyRequired context="modal" title="Agent Swarm" onClose={onClose} />;
  }

  function modelSummary() {
    return (
      entities
        .map(
          (e) =>
            `${e.id}:${e.name}[${e.metaclass}](${e.attributes.map((a) => a.name).join(",")})`
        )
        .join("; ") +
      " | Relations: " +
      relations.map((r) => `${r.from}→${r.to}[${r.label}]`).join(", ")
    );
  }

  /** Restore a historical session into the debate view */
  function loadSession(s: SwarmSession) {
    setTopic(s.topic);
    setRounds(s.rounds || []);
    setConsensus(s.consensus);
    setAppliedActions(false);
    setApplySummary([]);
    setApplyError(null);
    setRestoredFrom(s.id);
    setRightTab("personas");
  }

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  async function callAgent(
    persona: Persona,
    systemVoice: string,
    history: any[],
    model: string,
    principlesCtx: string,
    label = "Swarm · Synthesis"
  ) {
    const d = await apiFetch(
      {
        max_tokens: 400,
        system: `You are the ${persona.name} in a modeling workshop debate. ${systemVoice}

Current model: ${model}
${principlesCtx}

RULES:
- Stay strictly in character as ${persona.name}
- Be direct, opinionated, and concise (3-5 sentences max)
- Disagree with others when warranted — this is a debate, not a consensus exercise
- Reference specific entities or relations from the model by name
- Raise exactly one key concern or proposal per turn`,
        messages: history,
      },
      "swarm",
      label
    );
    return d.content?.find((b: any) => b.type === "text")?.text || "(no response)";
  }

  async function runSwarm() {
    if (!topic.trim() || running) return;
    setRunning(true);
    setRounds([]);
    setConsensus(null);
    setAppliedActions(false);
    setApplyError(null);
    setApplySummary([]);

    const selected = personas.filter((p) => activePersonas.includes(p.id));
    const snap = modelSummary();
    const principlesCtx = principlesContext(principles || [], paradigm);
    // Track rounds locally — React state is a stale closure inside async functions
    const localRounds: DebateRound[] = [];
    setRestoredFrom(null);

    // Each round is a single batched API call where Claude plays all personas at once.
    // This keeps total API calls at 4 regardless of persona count, safe for 5 RPM tiers.
    const personaList = selected
      .map((p) => `- ${p.name}: ${p.voice}`)
      .join("\n");

    /** Parse persona response blocks out of a batched response.
     *  Handles both **Name**: and **Name:** (Claude uses either). */
    function parseBlocks(text: string): Record<string, string> {
      const out: Record<string, string> = {};
      const names = selected.map((p) => p.name);

      /** Find the earliest position in `haystack` of any of the given needles, or -1 */
      function findAny(haystack: string, needles: string[], from = 0): number {
        return needles.reduce((best, n) => {
          const pos = haystack.indexOf(n, from);
          return pos !== -1 && (best === -1 || pos < best) ? pos : best;
        }, -1);
      }

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        // Accept both colon-outside (**Name**:) and colon-inside (**Name:**)
        const markers = [`**${name}**:`, `**${name}:**`];
        let start = -1;
        let mLen = 0;
        for (const m of markers) {
          const pos = text.indexOf(m);
          if (pos !== -1 && (start === -1 || pos < start)) { start = pos; mLen = m.length; }
        }
        if (start === -1) continue;

        const after = start + mLen;
        // Find where the next persona's block starts
        const nextMarkers = names
          .slice(i + 1)
          .flatMap((n) => [`**${n}**:`, `**${n}:**`]);
        const nextPos = findAny(text, nextMarkers, after);
        out[name] = text.slice(after, nextPos === -1 ? text.length : nextPos).trim();
      }
      return out;
    }

    function extractText(data: any): string {
      return (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
    }

    const ctxBlock = contextBlock(workContext);
    const firstPersonaName = selected[0]?.name ?? "Information Architect";
    const batchSystem = (instruction: string) => `You are facilitating a multi-expert data modeling workshop debate.
Current model: ${snap}
${principlesCtx}${ctxBlock}

Personas (respond strictly in character for each):
${personaList}

${instruction}

IMPORTANT: Write personas in the order listed above. Because you generate them sequentially, each persona after the first can see what earlier personas already wrote — use that. Personas should react to, build on, or challenge specific points raised by those before them, as a real workshop participant would.

Format — write EXACTLY one block per persona using this pattern (bold name, colon, response):
**${firstPersonaName}:** Their 3–5 sentence response goes here.
**[next persona name]:** Their 3–5 sentence response goes here.
...and so on for every persona in the list above.`;

    let r1Text = "";
    let r2Text = "";

    try {
      // ── Round 1: all initial takes — one API call ───────────────────────
      const r1Data = await apiFetch(
        {
          max_tokens: Math.min(500 * selected.length, 8000),
          system: batchSystem("Write each persona's initial assessment of the topic."),
          messages: [
            {
              role: "user",
              content: `Workshop topic: "${topic}"\n\nWrite each persona's initial take.`,
            },
          ],
        },
        "swarm",
        "Swarm debate · Round 1"
      );
      r1Text = extractText(r1Data);
      const r1Blocks = parseBlocks(r1Text);
      for (const p of selected) {
        const round: DebateRound = { persona: p, text: r1Blocks[p.name] || `(${p.name} did not respond)`, type: "initial" };
        setRounds((r) => [...r, round]);
        localRounds.push(round);
      }

      // Pause to respect 5 RPM — 13 s guarantees we stay within the limit
      await sleep(13000);

      // ── Round 2: cross-challenges — one API call ────────────────────────
      const r2Data = await apiFetch(
        {
          max_tokens: Math.min(500 * selected.length, 8000),
          system: batchSystem(
            "Round 2: cross-challenge. Each persona must pick ONE specific statement from round 1 (naming who said it), either to challenge it directly or defend their own position against a critique of it. Be direct, opinionated, and concrete — this is a debate, not a consensus exercise."
          ),
          messages: [
            {
              role: "user",
              content: `Topic: "${topic}"\n\nRound 1 responses:\n${r1Text}\n\nWrite each persona's round-2 challenge or defence.`,
            },
          ],
        },
        "swarm",
        "Swarm debate · Round 2"
      );
      r2Text = extractText(r2Data);
      const r2Blocks = parseBlocks(r2Text);
      for (const p of selected) {
        const text = r2Blocks[p.name];
        if (text) {
          const round: DebateRound = { persona: p, text, type: "challenge" };
          setRounds((r) => [...r, round]);
          localRounds.push(round);
        }
      }

      await sleep(13000);

      // ── Synthesis: prose — one API call (with retry on rate limit) ──────
      const synthPersona = personas.find((p) => p.id === "ia") || selected[0];
      let proseText = "";
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          proseText = await callAgent(
            synthPersona,
            "You are synthesizing this modeling debate as Information Architect. Be concise and decisive.",
            [
              {
                role: "user",
                content: `Topic: "${topic}"\n\nRound 1:\n${r1Text}\n\nRound 2:\n${r2Text}\n\nWrite:\nCONSENSUS: 2-3 sentences on what the group agreed.\nDISSENT: any unresolved disagreements, or "None".`,
              },
            ],
            snap,
            principlesCtx
          );
          break;
        } catch (e: any) {
          const isRateLimit =
            e.message?.includes("rate limit") ||
            e.message?.includes("10,000") ||
            e.message?.includes("5 requests");
          if (isRateLimit && attempt < 2) {
            const waitSec = (attempt + 1) * 30;
            setConsensus({
              text: `⏳ Rate limited — waiting ${waitSec}s before retry (${attempt + 1}/2)…`,
              raw: "",
            });
            await sleep(waitSec * 1000);
            setConsensus(null);
          } else {
            throw e;
          }
        }
      }

      await sleep(13000);

      // ── Action extraction — one API call ────────────────────────────────
      const existingIds = snap
        .split(";")
        .map((s) => s.trim().split(":")[0])
        .filter(Boolean)
        .join(", ");

      const actionSystemPrompt = `You are a data modeling action extractor. Given a debate transcript and model state, output ONLY a valid JSON array of model actions. No prose, no markdown wrapper, no explanation — raw JSON array only.

Available actions:
- {"name":"create_entity","entityName":"...","metaclass":"Entity|Relation|Attribute|ValueSet","attributes":[{"name":"...","type":"UUID|String|Integer|Decimal|Boolean|DateTime|Enum|Text","pk":true}]}
- {"name":"add_attributes","entityId":"...","attributes":[{"name":"...","type":"..."}]}
- {"name":"create_relation","fromEntityId":"...","toEntityId":"...","label":"...","cardinality":"1 → N"}
- {"name":"delete_entity","entityId":"..."}
- {"name":"rename_entity","entityId":"...","newName":"..."}
- {"name":"delete_relation","relationId":"..."}
- {"name":"update_relation","relationId":"...","label":"...","cardinality":"..."}

ENTITY REFS: use existing entity IDs (${existingIds}) for existing entities. For new entities created earlier in the same array, reference them by their entityName.

${principlesCtx}

Current model: ${snap}

Output [] if no structural changes are needed. Output raw JSON only — no backticks, no explanation.`;

      const actionData = await apiFetch(
        {
          max_tokens: 4000,
          system: actionSystemPrompt,
          messages: [
            {
              role: "user",
              content: `The debate on "${topic}" concluded.\n\nConsensus:\n${proseText}\n\nRound 2 key points:\n${r2Text.slice(0, 1200)}\n\nOutput the JSON action array to implement the agreed model changes. Prefer fewer, high-value actions.`,
            },
          ],
        },
        "swarm",
        "Swarm · Extracting actions"
      );

      let actionRaw = (actionData.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();

      if (actionData.stop_reason === "max_tokens" && actionRaw.length > 0) {
        const lastBrace = actionRaw.lastIndexOf("}");
        if (lastBrace !== -1) {
          actionRaw = actionRaw.slice(0, lastBrace + 1).trimEnd();
          if (actionRaw.endsWith(",")) actionRaw = actionRaw.slice(0, -1);
          actionRaw = actionRaw + "]";
        }
      }

      const sessionConsensus: SwarmConsensus = { text: proseText, raw: actionRaw };
      setConsensus(sessionConsensus);
      // Save with local variables — React state is a stale closure here
      onSaveSession({
        id: `ss_${Date.now()}`,
        topic,
        rounds: localRounds,
        consensus: sessionConsensus,
        savedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setConsensus({ text: `Synthesis error: ${e.message}`, raw: "" });
    }

    setRunning(false);
  }

  function applyConsensus() {
    const raw = consensus?.raw || "";
    let jsonStr: string | null = null;
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      jsonStr = trimmed;
    } else {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) {
        jsonStr = fenced[1].trim();
      } else {
        const bare = raw.match(/(\[\s*[\s\S]*?\])\s*$/);
        if (bare) jsonStr = bare[1].trim();
      }
    }

    if (!jsonStr) {
      setApplyError(
        "No JSON action block found in synthesis output. The swarm may not have produced model changes."
      );
      return;
    }

    let actions: any[] = [];
    try {
      actions = JSON.parse(jsonStr);
    } catch (e: any) {
      const lastBrace = jsonStr.lastIndexOf("}");
      if (lastBrace !== -1) {
        let repaired = jsonStr.slice(0, lastBrace + 1).trimEnd();
        if (repaired.endsWith(",")) repaired = repaired.slice(0, -1);
        repaired = repaired + "]";
        try {
          actions = JSON.parse(repaired);
        } catch (_e2) {
          setApplyError(
            `Could not parse action JSON: ${e.message}. First 120 chars: ${jsonStr.slice(0, 120)}`
          );
          return;
        }
      } else {
        setApplyError(
          `Could not parse action JSON: ${e.message}. Got: ${jsonStr.slice(0, 120)}`
        );
        return;
      }
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      setApplyError("Action list is empty — no model changes were proposed.");
      return;
    }

    let currentEntities = [...entities];
    let currentRelations = [...relations];
    const nameToId: Record<string, string> = {};
    const applied: string[] = [];

    for (const action of actions) {
      const toolName = action.name;
      const { name: _n, ...rest } = action;
      const inp = { ...rest };
      if (inp.entityName !== undefined) {
        inp.name = inp.entityName;
        delete inp.entityName;
      }
      if (Array.isArray(inp.attributes) && inp.attributes[0] && typeof inp.attributes[0] === "string")
        inp.attributes = inp.attributes.map((n: string) => ({ name: n, type: "String" }));
      const resolve = (ref: string) => {
        if (!ref) return ref;
        if (nameToId[ref]) return nameToId[ref];
        const byId = currentEntities.find((e) => e.id === ref);
        if (byId) return byId.id;
        const byName = currentEntities.find((e) => e.name === ref);
        if (byName) return byName.id;
        return ref;
      };
      const p = { ...inp };
      ["fromEntityId", "toEntityId", "entityId", "hostEntityId", "attributeEntityId"].forEach(
        (k) => {
          if (p[k]) p[k] = resolve(p[k]);
        }
      );
      const { newEntities, newRelations, newEntityId, summary } = executeTool(
        toolName,
        p,
        currentEntities,
        currentRelations
      );
      currentEntities = newEntities;
      currentRelations = newRelations;
      if (newEntityId && p.name) nameToId[p.name] = newEntityId;
      applied.push(summary);
    }

    setEntities([...currentEntities]);
    setRelations([...currentRelations]);
    setAppliedActions(true);
    setApplyError(null);
    setApplySummary(applied);
  }

  const groupedRounds = {
    initial: rounds.filter((r) => r.type === "initial"),
    challenge: rounds.filter((r) => r.type === "challenge"),
  };

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
          width: "min(1100px,96vw)",
          height: "min(780px,92vh)",
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
                background: "rgba(79,142,247,0.2)",
                border: `1px solid ${T.accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-users-group" style={{ fontSize: 14, color: T.accent }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Agent Swarm</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>Multi-persona modeling debate</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {restoredFrom && (
              <span style={{ fontSize: 9.5, color: T.textDim, display: "flex", alignItems: "center", gap: 4 }}>
                <i className="ti ti-history" style={{ fontSize: 10 }} />
                Historical
              </span>
            )}
            {(consensus || swarmSessions.length > 0) && (
              <button
                onClick={() => setShowReport(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  padding: "4px 11px",
                  borderRadius: 7,
                  background: "rgba(52,211,153,0.12)",
                  border: `1px solid rgba(52,211,153,0.3)`,
                  color: T.green,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                <i className="ti ti-file-text" style={{ fontSize: 11 }} />
                Report
              </button>
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
          {/* Left: config + debate */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Topic input */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: T.textDim,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 7,
                }}
              >
                Debate Topic
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSwarm()}
                  disabled={running}
                  placeholder="e.g. Should Customer be split into Party and Person? How should we model addresses?"
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12.5,
                    color: T.text,
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = T.accent)}
                  onBlur={(e) => (e.target.style.borderColor = T.border)}
                />
                <button
                  onClick={runSwarm}
                  disabled={running || !topic.trim()}
                  style={{
                    padding: "8px 18px",
                    background: running ? "rgba(79,142,247,0.3)" : T.accent,
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: running ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: !topic.trim() && !running ? 0.4 : 1,
                  }}
                >
                  {running ? (
                    <>
                      <i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite" }} />{" "}
                      Running…
                    </>
                  ) : (
                    <>
                      <i className="ti ti-player-play" /> Debate
                    </>
                  )}
                </button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 7, flexWrap: "wrap" }}>
                {[
                  "Should we use Party pattern?",
                  "How to model address?",
                  "Is Order normalized?",
                  "Temporal validity strategy",
                  "PII and GDPR compliance",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setTopic(q)}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.border}`,
                      color: T.textDim,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = T.text;
                      e.currentTarget.style.background = T.surfaceHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = T.textDim;
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Debate thread */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {rounds.length === 0 && !running && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: 10,
                    opacity: 0.5,
                  }}
                >
                  <i className="ti ti-users-group" style={{ fontSize: 32, color: T.textDim }} />
                  <p
                    style={{
                      fontSize: 12,
                      color: T.textDim,
                      textAlign: "center",
                      margin: 0,
                    }}
                  >
                    Select personas, enter a topic, and start the debate.
                    <br />
                    Each agent will argue from their role's perspective.
                  </p>
                </div>
              )}

              {groupedRounds.initial.length > 0 && (
                <div
                  style={{
                    fontSize: 9.5,
                    color: T.textDim,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Round 1 — Initial Takes
                </div>
              )}
              {groupedRounds.initial.map((r, i) => (
                <DebateMessage key={i} round={r} />
              ))}

              {groupedRounds.challenge.length > 0 && (
                <div
                  style={{
                    fontSize: 9.5,
                    color: T.textDim,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    margin: "8px 0 4px",
                  }}
                >
                  Round 2 — Challenge &amp; Rebuttal
                </div>
              )}
              {groupedRounds.challenge.map((r, i) => (
                <DebateMessage key={i} round={r} />
              ))}

              {running && (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    padding: "8px 4px",
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: T.accent,
                        opacity: 0.5,
                        animation: `bounce .9s ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 11, color: T.textDim, marginLeft: 4 }}>
                    Agents deliberating…
                  </span>
                </div>
              )}

              {consensus && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "rgba(79,142,247,0.06)",
                    border: `1px solid rgba(79,142,247,0.2)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: T.accent,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i className="ti ti-check-circle" style={{ fontSize: 13 }} /> Synthesis &amp;
                    Recommended Actions
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: T.text,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {consensus.text.replace(/```json[\s\S]*?```/g, "[JSON actions ready to apply]")}
                  </div>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={applyConsensus}
                      disabled={appliedActions}
                      style={{
                        padding: "8px 16px",
                        background: appliedActions ? "rgba(52,211,153,0.15)" : T.green,
                        border: `1px solid ${T.green}`,
                        borderRadius: 8,
                        color: appliedActions ? "#34d399" : "#0d0d10",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: appliedActions ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        alignSelf: "flex-start",
                      }}
                    >
                      <i
                        className={`ti ${appliedActions ? "ti-check" : "ti-wand"}`}
                        style={{ fontSize: 13 }}
                      />
                      {appliedActions ? "Applied to canvas" : "Apply to canvas"}
                    </button>
                    {applyError && (
                      <div
                        style={{
                          fontSize: 11,
                          color: T.red,
                          padding: "7px 10px",
                          borderRadius: 7,
                          background: "rgba(248,113,113,0.08)",
                          border: "1px solid rgba(248,113,113,0.2)",
                        }}
                      >
                        <i className="ti ti-alert-circle" style={{ marginRight: 5 }} />
                        {applyError}
                      </div>
                    )}
                    {applySummary.length > 0 && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: T.green,
                          padding: "7px 10px",
                          borderRadius: 7,
                          background: "rgba(52,211,153,0.07)",
                          border: "1px solid rgba(52,211,153,0.2)",
                        }}
                      >
                        {applySummary.map((s, i) => (
                          <div key={i} style={{ marginBottom: 2 }}>
                            ✓ {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Right: personas / history */}
          <div
            style={{
              width: 230,
              borderLeft: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.01)",
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
              }}
            >
              {(["personas", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    fontSize: 10.5,
                    fontWeight: rightTab === t ? 600 : 400,
                    color: rightTab === t ? T.text : T.textDim,
                    background: rightTab === t ? "rgba(255,255,255,0.04)" : "transparent",
                    border: "none",
                    borderBottom: rightTab === t ? `2px solid ${T.accent}` : "2px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <i className={`ti ${t === "personas" ? "ti-users" : "ti-history"}`} style={{ fontSize: 11 }} />
                  {t === "personas" ? "Personas" : `History${swarmSessions.length > 0 ? ` (${swarmSessions.length})` : ""}`}
                </button>
              ))}
            </div>

            {/* ── Personas tab ─────────────────────────────────────── */}
            {rightTab === "personas" && (
              <>
                <div style={{ padding: "10px 12px 6px", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setActivePersonas(personas.map((p) => p.id))}
                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                    >All</button>
                    <button
                      onClick={() => setActivePersonas([])}
                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                    >None</button>
                    <button
                      onClick={onOpenPersonas}
                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(167,139,250,0.08)", border: `1px solid rgba(167,139,250,0.25)`, color: T.purple, cursor: "pointer", marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}
                      title="Edit personas"
                    >
                      <i className="ti ti-pencil" style={{ fontSize: 9 }} />Edit
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {personas.map((p) => {
                    const active = activePersonas.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActivePersonas((prev) => active ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8,
                          background: active ? `rgba(${hexToRgb(p.color)},0.1)` : "transparent",
                          border: `1px solid ${active ? p.color : T.border}`,
                          cursor: "pointer", textAlign: "left", transition: "all .1s",
                        }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 5, background: active ? `rgba(${hexToRgb(p.color)},0.25)` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <i className={`ti ${p.icon}`} style={{ fontSize: 11, color: active ? p.color : T.textDim }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10.5, fontWeight: active ? 500 : 400, color: active ? p.color : T.textMid, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.name}
                          </div>
                        </div>
                        {active && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: p.color, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: T.textDim }}>{activePersonas.length} of {personas.length} active</div>
                  <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 2, lineHeight: 1.4 }}>4 API calls · ~45 s total</div>
                </div>
              </>
            )}

            {/* ── History tab ───────────────────────────────────────── */}
            {rightTab === "history" && (
              <>
                {swarmSessions.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20, opacity: 0.5 }}>
                    <i className="ti ti-history" style={{ fontSize: 24, color: T.textDim }} />
                    <p style={{ fontSize: 10.5, color: T.textDim, textAlign: "center", margin: 0, lineHeight: 1.6 }}>
                      No sessions yet. Run a debate to build history.
                    </p>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...swarmSessions].reverse().map((s) => {
                      const isActive = restoredFrom === s.id || (!restoredFrom && swarmSessions[swarmSessions.length - 1]?.id === s.id && consensus?.text === s.consensus?.text);
                      const personasInSession = [...new Map(s.rounds.map((r) => [r.persona?.id, r.persona])).values()].filter(Boolean).slice(0, 5);
                      const date = new Date(s.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                      return (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s)}
                          style={{
                            display: "flex", flexDirection: "column", gap: 5, padding: "9px 10px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                            background: isActive ? "rgba(79,142,247,0.1)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${isActive ? T.accent : T.border}`,
                            transition: "all .12s",
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 500, color: isActive ? T.accent : T.text, lineHeight: 1.4, flex: 1 }}>
                              {s.topic.length > 48 ? s.topic.slice(0, 47) + "…" : s.topic}
                            </span>
                            {isActive && <i className="ti ti-eye" style={{ fontSize: 10, color: T.accent, flexShrink: 0, marginTop: 1 }} />}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", gap: 3 }}>
                              {personasInSession.map((p) => p && (
                                <div key={p.id} style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(${hexToRgb(p.color)},0.3)`, border: `1px solid ${p.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <i className={`ti ${p.icon}`} style={{ fontSize: 7, color: p.color }} />
                                </div>
                              ))}
                            </div>
                            <span style={{ fontSize: 9, color: T.textDim }}>{date}</span>
                          </div>
                          {s.consensus?.text && (
                            <p style={{ fontSize: 9.5, color: T.textDim, margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                              {s.consensus.text.replace(/^CONSENSUS:\s*/i, "").slice(0, 100)}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {swarmSessions.length > 0 && (
                  <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <div style={{ fontSize: 9.5, color: T.textDim }}>
                      Click a session to restore it to the debate view
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showReport && (
        <SwarmReportModal
          modelName="Enterprise Model"
          entities={entities}
          relations={relations}
          swarmSessions={(() => {
            const base = swarmSessions || [];
            if (!consensus) return base;
            // Only add a temp entry for the live session if it hasn't been
            // persisted yet (onSaveSession runs at the end of runSwarm, so by
            // the time the user opens the report the session is already in base)
            const alreadySaved = base.some(
              (s) => s.topic === topic && s.consensus?.text === consensus.text
            );
            if (alreadySaved) return base;
            return [...base, { id: "ss_temp", topic, rounds, consensus, savedAt: new Date().toISOString() }];
          })()}
          validationResults={[]}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
