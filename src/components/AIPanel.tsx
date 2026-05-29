import { useState, useRef, useEffect } from "react";
import type { Entity, Relation, Principle, ChatMessage, ApiHistoryMessage, WorkContext } from "../types";
import { T } from "../tokens";
import { apiFetch, hasApiKey } from "../lib/api";
import { AiKeyRequired } from "./AiKeyRequired";
import { executeTool } from "../lib/tools";
import { principlesContext, contextBlock } from "../data/principles";
import { ToolCallGroup } from "./ToolCallGroup";

interface AIPanelProps {
  mode: string;
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  relations: Relation[];
  setRelations: React.Dispatch<React.SetStateAction<Relation[]>>;
  systemPrompt: string;
  principles: Principle[];
  paradigm: string;
  workContext: WorkContext;
  onOpenSkills: () => void;
  onOpenPrinciples: () => void;
  onClose: () => void;
}

export function AIPanel({
  mode,
  entities,
  setEntities,
  relations,
  setRelations,
  systemPrompt,
  principles,
  paradigm,
  workContext,
  onOpenSkills,
  onOpenPrinciples,
  onClose,
}: AIPanelProps) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Canvas connected. Tell me what to build — I'll output a JSON action block and the workbench executes it. Try: \"Add a Description attribute entity and implement it on Product and Customer\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbg, setDbg] = useState<any[]>([]);
  const [showDbg, setShowDbg] = useState(false);
  const apiHistory = useRef<ApiHistoryMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Show locked state when no API key is configured
  if (!hasApiKey()) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            padding: "11px 16px 10px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9.5, color: T.textDim, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            AI Assistant
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: 16 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
          >
            ×
          </button>
        </div>
        <AiKeyRequired context="panel" />
      </div>
    );
  }

  function modelCtx(ents: Entity[], rels: Relation[]) {
    const eStr = ents
      .map((e) => {
        const attrs = e.attributes.map((a) => (a.pk ? `${a.name}*` : a.name)).join(",");
        return `${e.id}:${e.name}[${e.metaclass}](${attrs})`;
      })
      .join("; ");
    const rStr = rels.map((r) => `${r.id}:${r.from}→${r.to}[${r.label}]`).join("; ");
    return `\n\nMODEL ENTITIES (* = primary key): ${eStr}\nRELATIONS: ${rStr}\nMODE: ${mode}`;
  }

  async function send(txt?: string) {
    const q = txt || input;
    if (!q.trim() || loading) return;
    setInput("");
    setLoading(true);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    let currentEntities = entities;
    let currentRelations = relations;
    const nameToId: Record<string, string> = {};

    const history = apiHistory.current
      .map((m) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .filter((b) => b.type === "text")
                  .map((b) => b.text)
                  .join("\n")
              : String(m.content || ""),
      }))
      .filter((m) => m.content);

    try {
      const data = await apiFetch(
        {
          max_tokens: 8000,
          system:
            systemPrompt +
            contextBlock(workContext) +
            principlesContext(principles || [], paradigm) +
            modelCtx(currentEntities, currentRelations),
          messages: [...history, { role: "user", content: q }],
        },
        "assistant"
      );
      setDbg((d) => [
        ...d,
        { stop_reason: data.stop_reason, model: data.model, error: data.error?.message, phase: "response" },
      ]);

      if (data.error) {
        setMsgs((m) => [...m, { role: "assistant", text: "API error: " + data.error.message }]);
        setLoading(false);
        return;
      }

      const rawText = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");

      // Try complete fenced block first, then fall back to truncated block (max_tokens cut-off)
      const fencedMatch =
        rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        rawText.match(/```(?:json)?\s*([\s\S]*)/);
      let actions: any[] = [];
      if (fencedMatch) {
        try {
          actions = JSON.parse(fencedMatch[1].trim());
        } catch (_e) {
          // Try to repair a truncated JSON array (response cut off before closing ])
          const partial = fencedMatch[1].trim();
          if (partial.startsWith("[")) {
            const lastBrace = partial.lastIndexOf("}");
            if (lastBrace !== -1) {
              let repaired = partial.slice(0, lastBrace + 1).trimEnd();
              if (repaired.endsWith(",")) repaired = repaired.slice(0, -1);
              try { actions = JSON.parse(repaired + "]"); } catch (_e2) { /* ignore */ }
            }
          }
        }
      }

      if (actions.length === 0 && rawText.trim().length > 10) {
        const extractSystem = `You are a JSON action extractor for a data modeling canvas. Given a modeling assistant's response, extract the intended canvas changes as a raw JSON array. Output ONLY the JSON array — no prose, no backticks, no explanation.

Available actions:
- {"name":"create_entity","entityName":"Name","metaclass":"Entity|Relation|Attribute|ValueSet","attributes":[{"name":"id","type":"UUID","pk":true}]}
- {"name":"add_attributes","entityId":"e1","attributes":[{"name":"field","type":"String"}]}
- {"name":"create_relation","fromEntityId":"e1","toEntityId":"e2","label":"verb phrase","cardinality":"1 → N"}
- {"name":"rename_entity","entityId":"e1","newName":"NewName"}
- {"name":"delete_entity","entityId":"e1"}
- {"name":"delete_relation","relationId":"r1"}
- {"name":"update_relation","relationId":"r1","label":"new label","cardinality":"1 → N"}
- {"name":"set_metaclass","entityId":"e1","metaclass":"Entity"}
- {"name":"implement_attribute","hostEntityId":"e1","attributeEntityId":"e2"}

ENTITY REF RULE: For create_relation and implement_attribute, when referencing an entity that is also being created in this same array, use its entityName string as fromEntityId/toEntityId/hostEntityId/attributeEntityId. For existing entities use their IDs from the list below. NEVER use placeholder IDs like "e1" or "e2" for newly created entities.

Current model entities: ${currentEntities.map((e) => e.id + ":" + e.name + "[" + e.metaclass + "]").join(", ")}
Current relations: ${currentRelations.map((r) => r.id + ":" + r.from + "→" + r.to + "[" + r.label + "]").join(", ")}

Output [] if no model changes are intended.`;

        try {
          const extractData = await apiFetch(
            {
              max_tokens: 8000,
              system: extractSystem,
              messages: [
                {
                  role: "user",
                  content: `The assistant said:\n\n${rawText}\n\nExtract the JSON action array.`,
                },
              ],
            },
            "assistant"
          );
          let extractRaw = (extractData.content || [])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("")
            .trim();
          // Repair truncated JSON array if the extractor was also cut off
          if (extractData.stop_reason === "max_tokens" && extractRaw.length > 0) {
            const lastBrace = extractRaw.lastIndexOf("}");
            if (lastBrace !== -1) {
              extractRaw = extractRaw.slice(0, lastBrace + 1).trimEnd();
              if (extractRaw.endsWith(",")) extractRaw = extractRaw.slice(0, -1);
              if (!extractRaw.endsWith("]")) extractRaw = extractRaw + "]";
            }
          }
          const toParse = extractRaw.startsWith("[")
            ? extractRaw
            : (extractRaw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, extractRaw])[1];
          try {
            actions = JSON.parse(toParse);
          } catch (_e) {
            // ignore
          }
        } catch (_e) {
          // ignore
        }
      }

      const toolSummaries: { name: string; summary: string; status: "done" | "error" }[] = [];
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
        const { newEntities, newRelations, summary, newEntityId } = executeTool(
          toolName,
          p,
          currentEntities,
          currentRelations
        );
        currentEntities = newEntities;
        currentRelations = newRelations;
        if (newEntityId) {
          nameToId[p.name] = newEntityId;
          nameToId[newEntityId] = newEntityId;
        }
        toolSummaries.push({ name: toolName, summary, status: "done" });
      }

      if (toolSummaries.length > 0) {
        setEntities([...currentEntities]);
        setRelations([...currentRelations]);
      }

      const displayText = rawText
        .replace(/```(?:json)?[\s\S]*?```/g, "")
        .replace(/`{1,3}json[\s\S]*$/g, "")
        .replace(/^\s*[\[{][\s\S]*$/gm, (m: string) => {
          try {
            JSON.parse(m.trim());
            return "";
          } catch (_e) {
            return m;
          }
        })
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      apiHistory.current = [
        ...apiHistory.current,
        { role: "user", content: q },
        { role: "assistant", content: [{ type: "text", text: rawText }] },
      ];
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: displayText || undefined,
          toolCalls: toolSummaries.length ? toolSummaries : undefined,
        },
      ]);
    } catch (err: any) {
      setMsgs((m) => [...m, { role: "assistant", text: "Error: " + err.message }]);
    }
    setLoading(false);
  }

  const chips = [
    "Check normalization",
    "Add Description attribute entity",
    "Add audit fields to all",
    "Create junction for M:N",
    "Add ValueSet for Status",
    "Implement shared attributes",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 10px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.green,
              boxShadow: `0 0 6px ${T.green}`,
            }}
          />
          <span style={{ fontSize: 11.5, fontWeight: 500, color: T.text }}>AI Assistant</span>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <button
            onClick={() => setShowDbg((p) => !p)}
            style={{
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: 5,
              background: showDbg ? "rgba(251,191,36,0.1)" : "transparent",
              border: `1px solid ${showDbg ? T.amber : T.border}`,
              color: showDbg ? T.amber : T.textDim,
              cursor: "pointer",
              fontFamily: T.mono,
            }}
          >
            DBG
          </button>
          <button
            onClick={onOpenSkills}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              padding: "3px 9px",
              borderRadius: 6,
              background: T.purpleDim,
              border: `1px solid rgba(167,139,250,0.3)`,
              color: T.purple,
              cursor: "pointer",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = T.purpleDim)}
          >
            <i className="ti ti-brain" style={{ fontSize: 11 }} />
            Skills
          </button>
          <button
            onClick={onOpenPrinciples}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              padding: "3px 9px",
              borderRadius: 6,
              background: "rgba(251,191,36,0.1)",
              border: `1px solid rgba(251,191,36,0.25)`,
              color: T.amber,
              cursor: "pointer",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.1)")}
          >
            <i className="ti ti-certificate" style={{ fontSize: 11 }} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textDim,
              fontSize: 16,
              lineHeight: 1,
              padding: 2,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
          >
            <i className="ti ti-x" />
          </button>
        </div>
      </div>

      {showDbg && (
        <div
          style={{
            margin: "0 12px 4px",
            padding: "8px 10px",
            background: "rgba(251,191,36,0.06)",
            border: `1px solid rgba(251,191,36,0.2)`,
            borderRadius: 7,
            fontSize: 10,
            fontFamily: T.mono,
            color: T.amber,
            maxHeight: 100,
            overflowY: "auto",
          }}
        >
          {dbg.length === 0 && <div style={{ color: T.textDim }}>No calls yet</div>}
          {dbg.map((d, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
              ← stop=
              <span style={{ color: d.stop_reason === "end_turn" ? T.textMid : T.green }}>
                {d.stop_reason}
              </span>{" "}
              {d.model}{" "}
              {d.error && <span style={{ color: T.red }}>ERR:{d.error}</span>}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {msgs.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "8px 12px",
                    borderRadius: 10,
                    borderBottomRightRadius: 2,
                    fontSize: 12,
                    lineHeight: 1.6,
                    background: T.accent,
                    color: "#fff",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
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
                    marginTop: 2,
                  }}
                >
                  <i className="ti ti-sparkles" style={{ fontSize: 10, color: T.accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <ToolCallGroup toolCalls={m.toolCalls} />
                  )}
                  {m.text && (
                    <div
                      style={{
                        marginTop: m.toolCalls ? 6 : 0,
                        padding: "8px 12px",
                        borderRadius: 10,
                        borderBottomLeftRadius: 2,
                        fontSize: 12,
                        lineHeight: 1.6,
                        background: "rgba(255,255,255,0.05)",
                        color: T.text,
                      }}
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
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
              }}
            >
              <i className="ti ti-sparkles" style={{ fontSize: 10, color: T.accent }} />
            </div>
            <div style={{ display: "flex", gap: 4, padding: "10px 8px" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: T.textDim,
                    animation: `bounce .9s ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "10px 14px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => send(c)}
            disabled={loading}
            style={{
              fontSize: 10,
              padding: "3px 9px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              color: T.textMid,
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = T.surfaceHover;
                e.currentTarget.style.color = T.text;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = T.textMid;
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ padding: "6px 12px 14px", display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={loading}
          placeholder={loading ? "Working…" : "Tell me what to add or change…"}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            padding: "7px 11px",
            fontSize: 12,
            color: T.text,
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.accent)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          style={{
            width: 32,
            height: 33,
            borderRadius: 7,
            background: T.accent,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: loading ? 0.4 : 1,
          }}
        >
          <i className="ti ti-send" style={{ fontSize: 13, color: "#fff" }} />
        </button>
      </div>
    </div>
  );
}
