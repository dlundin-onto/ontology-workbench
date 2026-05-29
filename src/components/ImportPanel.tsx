import { useState, useRef } from "react";
import type { Entity, Relation } from "../types";
import { T, hexToRgb } from "../tokens";
import { META } from "../tokens";
import { apiFetch } from "../lib/api";

interface ImportPanelProps {
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  setRelations: React.Dispatch<React.SetStateAction<Relation[]>>;
  onClose: () => void;
}

type Step = "pick" | "parsing" | "preview" | "done";

interface ParsedPreview {
  entities: Entity[];
  relations: Relation[];
}

export function ImportPanel({ setEntities, setRelations, onClose }: ImportPanelProps) {
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function detectFormat(name: string, content: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (["ttl", "turtle", "rdf", "n3"].includes(ext)) return "rdf";
    if (ext === "jsonld" || ext === "json") return "json";
    if (ext === "owl") return "owl";
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
    if (["pptx", "ppt"].includes(ext)) return "pptx";
    if (["vsdx", "vsd"].includes(ext)) return "visio";
    if (content?.includes("@prefix") || content?.includes("<owl:")) return "rdf";
    return "unknown";
  }

  function parseTurtle(text: string): ParsedPreview {
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    const classRegex = /model:(\w+)\s+a\s+(?:owl:Class|rdfs:Class)[^.]*\./g;
    const labelRegex = /model:(\w+)\s+[^.]*rdfs:label\s+"([^"]+)"/g;
    const metaclassRegex = /model:(\w+)\s+[^.]*model:metaclass\s+"([^"]+)"/g;
    const objPropRegex =
      /model:(\w+)\/(\w+)\s+a\s+owl:ObjectProperty[^.]*rdfs:domain\s+model:(\w+)[^.]*rdfs:range\s+model:(\w+)[^.]*rdfs:label\s+"([^"]+)"/g;
    const dataPropRegex =
      /model:(\w+)\/(\w+)\s+a\s+owl:DatatypeProperty[^.]*rdfs:domain\s+model:(\w+)[^.]*rdfs:range\s+(xsd:\w+)[^.]*rdfs:label\s+"([^"]+)"/g;

    const labels: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = labelRegex.exec(text)) !== null) labels[m[1]] = m[2];

    const metaclasses: Record<string, string> = {};
    while ((m = metaclassRegex.exec(text)) !== null) metaclasses[m[1]] = m[2];

    const seen = new Set<string>();
    while ((m = classRegex.exec(text)) !== null) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      entities.push({
        id: `ei_${m[1]}`,
        name: labels[m[1]] || m[1],
        metaclass: (metaclasses[m[1]] as any) || "Entity",
        x: 60 + (entities.length % 5) * 200,
        y: 60 + Math.floor(entities.length / 5) * 240,
        attributes: [],
        implementations: [],
      });
    }

    const attrsByEntity: Record<string, any[]> = {};
    while ((m = dataPropRegex.exec(text)) !== null) {
      const entName = m[3];
      const attrName = m[5];
      const xsdType = m[4];
      const typeMap: Record<string, string> = {
        "xsd:string": "String",
        "xsd:integer": "Integer",
        "xsd:decimal": "Decimal",
        "xsd:boolean": "Boolean",
        "xsd:dateTime": "DateTime",
      };
      if (!attrsByEntity[entName]) attrsByEntity[entName] = [];
      attrsByEntity[entName].push({ name: attrName, type: typeMap[xsdType] || "String" });
    }
    for (const e of entities) {
      const key = e.name.replace(/\s/g, "");
      if (attrsByEntity[key]) e.attributes = attrsByEntity[key];
    }

    const relSeen = new Set<string>();
    while ((m = objPropRegex.exec(text)) !== null) {
      const key = `${m[3]}-${m[4]}-${m[5]}`;
      if (relSeen.has(key)) continue;
      relSeen.add(key);
      const fromE = entities.find((e) => e.name.replace(/\s/g, "") === m![3]);
      const toE = entities.find((e) => e.name.replace(/\s/g, "") === m![4]);
      if (fromE && toE) {
        relations.push({
          id: `ri_${relations.length}`,
          from: fromE.id,
          to: toE.id,
          label: m[5],
          card: "1 → N",
        });
      }
    }
    return { entities, relations };
  }

  function parseJsonModel(text: string): ParsedPreview {
    const d = JSON.parse(text);
    if (d.entities) {
      const entities: Entity[] = d.entities.map((e: any, i: number) => ({
        ...e,
        id: e.id || `ei_${i}`,
        implementations: e.implementations || [],
        x: e.x ?? 60 + (i % 5) * 200,
        y: e.y ?? 60 + Math.floor(i / 5) * 240,
      }));
      const relations: Relation[] = (d.relations || []).map((r: any, i: number) => ({
        ...r,
        id: r.id || `ri_${i}`,
      }));
      return { entities, relations };
    }
    if (d["@graph"]) {
      const entities: Entity[] = [];
      const relations: Relation[] = [];
      for (const node of d["@graph"]) {
        if (node["@type"] === "owl:Class" && node["@id"]?.startsWith("model:")) {
          entities.push({
            id: `ei_${entities.length}`,
            name: node["rdfs:label"] || node["@id"].split(":")[1],
            metaclass: node["model:metaclass"] || "Entity",
            x: 60 + (entities.length % 5) * 200,
            y: 60 + Math.floor(entities.length / 5) * 240,
            attributes: (node["model:attributes"] || []).map((a: any) => ({
              name: a.name,
              type: a.type || "String",
              pk: !!a.pk,
            })),
            implementations: [],
          });
        }
        if (node["@type"] === "owl:ObjectProperty") {
          const fromId = node["rdfs:domain"]?.replace("model:", "")?.replace('"', "");
          const toId = node["rdfs:range"]?.replace("model:", "")?.replace('"', "");
          const fromE = entities.find((e) => e.name.replace(/\s/g, "") === fromId);
          const toE = entities.find((e) => e.name.replace(/\s/g, "") === toId);
          if (fromE && toE) {
            relations.push({
              id: `ri_${relations.length}`,
              from: fromE.id,
              to: toE.id,
              label: node["rdfs:label"] || "relates to",
              card: "1 → N",
            });
          }
        }
      }
      return { entities, relations };
    }
    throw new Error("Unrecognized JSON format");
  }

  async function parseWithAI(
    _filename: string,
    contentOrBase64: string,
    isImage: boolean
  ): Promise<ParsedPreview> {
    const messages = isImage
      ? [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: file?.type || "image/png",
                  data: contentOrBase64,
                },
              },
              {
                type: "text",
                text: `Extract all entities, attributes, and relationships from this diagram. Output ONLY a JSON object with this exact structure (no markdown, no explanation):
{"entities":[{"name":"EntityName","metaclass":"Entity|Relation|Attribute|ValueSet","attributes":[{"name":"attrName","type":"UUID|String|Integer|Decimal|Boolean|DateTime|Enum","pk":true}]}],"relations":[{"fromName":"EntityA","toName":"EntityB","label":"verb phrase","cardinality":"1 → N"}]}`,
              },
            ],
          },
        ]
      : [
          {
            role: "user",
            content: `Extract all entities, attributes, and relationships from this model definition:\n\n${contentOrBase64}\n\nOutput ONLY a JSON object:\n{"entities":[{"name":"...","metaclass":"Entity|Relation|Attribute|ValueSet","attributes":[{"name":"...","type":"String|UUID|Integer|Decimal|Boolean|DateTime|Enum","pk":false}]}],"relations":[{"fromName":"...","toName":"...","label":"...","cardinality":"1 → N"}]}`,
          },
        ];

    // apiFetch returns parsed JSON directly — do NOT call .json() on the result
    const res = await apiFetch({ max_tokens: 3000, messages }, "assistant");
    const raw = res.content?.find((b: any) => b.type === "text")?.text || "{}";
    const jsonStr = raw.startsWith("{") ? raw : (raw.match(/\{[\s\S]*\}/) || ["{}"])[0];
    const parsed = JSON.parse(jsonStr);

    const entities: Entity[] = (parsed.entities || []).map((e: any, i: number) => ({
      ...e,
      id: `ei_${i}`,
      implementations: [],
      x: 60 + (i % 5) * 200,
      y: 60 + Math.floor(i / 5) * 240,
      attributes: (e.attributes || []).map((a: any) => ({ ...a, pk: !!a.pk, fk: !!a.fk })),
    }));
    const nameToId = Object.fromEntries(entities.map((e) => [e.name, e.id]));
    const relations: Relation[] = (parsed.relations || [])
      .map((r: any, i: number) => ({
        id: `ri_${i}`,
        from: nameToId[r.fromName] || "",
        to: nameToId[r.toName] || "",
        label: r.label || "relates to",
        card: r.cardinality || "1 → N",
      }))
      .filter((r: Relation) => r.from && r.to);
    return { entities, relations };
  }

  async function processFile(f: File) {
    setFile(f);
    setError(null);
    setStep("parsing");
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);

      if (isImage) {
        const b64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
        const result = await parseWithAI(f.name, b64, true);
        setPreview(result);
      } else {
        const text = await f.text();
        const fmt = detectFormat(f.name, text);
        let result: ParsedPreview;
        if (fmt === "rdf" || fmt === "owl") {
          result = parseTurtle(text);
          if (result.entities.length === 0) result = await parseWithAI(f.name, text, false);
        } else if (fmt === "json") {
          try {
            result = parseJsonModel(text);
          } catch {
            result = await parseWithAI(f.name, text, false);
          }
        } else {
          result = await parseWithAI(f.name, text.slice(0, 8000), false);
        }
        setPreview(result);
      }
      setStep("preview");
    } catch (e: any) {
      setError(e.message);
      setStep("pick");
    }
  }

  function applyImport() {
    if (!preview) return;
    setEntities(preview.entities);
    setRelations(preview.relations);
    setStep("done");
    setTimeout(onClose, 800);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  const SUPPORTED = [
    {
      label: "Image (PNG/JPG)",
      ext: "png, jpg",
      icon: "ti-photo",
      desc: "Diagrams, whiteboard photos, screenshots — AI extracts the model",
    },
    {
      label: "OWL / Turtle",
      ext: "ttl, rdf",
      icon: "ti-topology-star-3",
      desc: "RDF/OWL ontology files",
    },
    {
      label: "OWL JSON-LD",
      ext: "jsonld",
      icon: "ti-braces",
      desc: "JSON-LD serialization",
    },
    {
      label: "Model JSON",
      ext: "json",
      icon: "ti-code",
      desc: "Previously exported model JSON",
    },
    {
      label: "PowerPoint",
      ext: "pptx",
      icon: "ti-presentation",
      desc: "AI extracts entities from slide content",
    },
    {
      label: "Visio",
      ext: "vsdx",
      icon: "ti-vector",
      desc: "AI extracts entities from XML content",
    },
  ];

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
          width: "min(700px,94vw)",
          background: "#0f0f14",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
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
              <i className="ti ti-download" style={{ fontSize: 14, color: T.accent }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Import Model</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                Start from an existing file — AI extracts the model
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

        <div style={{ padding: 20 }}>
          {step === "pick" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? T.accent : T.border}`,
                  borderRadius: 12,
                  padding: "32px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(79,142,247,0.05)" : "rgba(255,255,255,0.02)",
                  transition: "all .15s",
                  marginBottom: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.accent;
                  e.currentTarget.style.background = "rgba(79,142,247,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!dragOver) {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  }
                }}
              >
                <i
                  className="ti ti-cloud-upload"
                  style={{ fontSize: 32, color: T.textDim, marginBottom: 8, display: "block" }}
                />
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 4 }}>
                  Drop a file or click to browse
                </div>
                <div style={{ fontSize: 11.5, color: T.textDim }}>
                  Images, OWL/RDF, JSON-LD, PPTX, Visio
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                style={{ display: "none" }}
                accept=".png,.jpg,.jpeg,.webp,.gif,.ttl,.rdf,.owl,.n3,.json,.jsonld,.pptx,.ppt,.vsdx"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              />

              {error && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: 7,
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    color: T.red,
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
                  {error}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {SUPPORTED.map((s) => (
                  <div
                    key={s.ext}
                    style={{
                      padding: "9px 11px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <i className={`ti ${s.icon}`} style={{ fontSize: 12, color: T.textMid }} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: T.text }}>{s.label}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: T.textDim,
                        fontFamily: "JetBrains Mono,monospace",
                        marginBottom: 3,
                      }}
                    >
                      {s.ext}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.textDim, lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "parsing" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <i
                className="ti ti-loader-2"
                style={{
                  fontSize: 32,
                  color: T.accent,
                  animation: "spin 1s linear infinite",
                  display: "block",
                  marginBottom: 12,
                }}
              />
              <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>
                Extracting model from {file?.name}
              </div>
              <div style={{ fontSize: 11.5, color: T.textDim }}>
                AI is reading entities, attributes, and relations…
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(52,211,153,0.07)",
                  border: "1px solid rgba(52,211,153,0.2)",
                }}
              >
                <i
                  className="ti ti-check-circle"
                  style={{ color: T.green, fontSize: 15 }}
                />
                <span style={{ fontSize: 12.5, color: T.text, fontWeight: 500 }}>
                  Found {preview.entities.length} entities and {preview.relations.length} relations
                </span>
                <span style={{ fontSize: 11, color: T.textDim, marginLeft: 4 }}>
                  from {file?.name}
                </span>
              </div>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  marginBottom: 14,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                }}
              >
                <table style={{ width: "100%", fontSize: 11.5, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["Entity", "Metaclass", "Attributes"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "7px 12px",
                            fontSize: 10,
                            color: T.textDim,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 500,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entities.map((e) => {
                      const m = META[e.metaclass as keyof typeof META] || META.Entity;
                      return (
                        <tr
                          key={e.id}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        >
                          <td
                            style={{ padding: "7px 12px", fontWeight: 500, color: T.text }}
                          >
                            {e.name}
                          </td>
                          <td style={{ padding: "7px 12px" }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 7px",
                                borderRadius: 20,
                                background: `rgba(${hexToRgb(m.color)},0.15)`,
                                color: m.color,
                              }}
                            >
                              {e.metaclass}
                            </span>
                          </td>
                          <td style={{ padding: "7px 12px", color: T.textDim }}>
                            {e.attributes.map((a) => a.name).join(", ") || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setStep("pick")}
                  style={{
                    padding: "7px 14px",
                    fontSize: 12,
                    borderRadius: 8,
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    color: T.textMid,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={applyImport}
                  style={{
                    padding: "7px 18px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 8,
                    background: T.accent,
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i className="ti ti-wand" />
                  Import to canvas
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div style={{ textAlign: "center", padding: "30px 20px" }}>
              <i
                className="ti ti-check-circle"
                style={{ fontSize: 36, color: T.green, display: "block", marginBottom: 8 }}
              />
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                Imported successfully
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
