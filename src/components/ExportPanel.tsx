import { useState } from "react";
import type { Entity, Relation } from "../types";
import { T, hexToRgb } from "../tokens";
import { entitiesToTurtle, entitiesToShacl, entitiesToOwlJson } from "../lib/serialize";

interface ExportPanelProps {
  entities: Entity[];
  relations: Relation[];
  onClose: () => void;
}

interface ExportFormat {
  id: string;
  label: string;
  icon: string;
  ext: string;
  color: string;
  mime: string;
  gen: () => string;
}

export function ExportPanel({ entities, relations, onClose }: ExportPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const modelName = "EnterpriseModel";

  const FORMATS: ExportFormat[] = [
    {
      id: "turtle",
      label: "OWL / Turtle",
      icon: "ti-topology-star-3",
      ext: "ttl",
      color: "#a78bfa",
      mime: "text/turtle",
      gen: () => entitiesToTurtle(entities, relations),
    },
    {
      id: "shacl",
      label: "SHACL Shapes",
      icon: "ti-shield-check",
      ext: "ttl",
      color: "#34d399",
      mime: "text/turtle",
      gen: () => entitiesToShacl(entities, relations),
    },
    {
      id: "owljson",
      label: "OWL JSON-LD",
      icon: "ti-braces",
      ext: "jsonld",
      color: "#22d3ee",
      mime: "application/ld+json",
      gen: () => entitiesToOwlJson(entities, relations),
    },
    {
      id: "json",
      label: "Model JSON",
      icon: "ti-code",
      ext: "json",
      color: "#4f8ef7",
      mime: "application/json",
      gen: () =>
        JSON.stringify(
          { entities, relations, exportedAt: new Date().toISOString(), version: "1.0" },
          null,
          2
        ),
    },
    {
      id: "csv",
      label: "CSV",
      icon: "ti-table",
      ext: "csv",
      color: "#fbbf24",
      mime: "text/csv",
      gen: () => {
        let csv = "EntityName,Metaclass,AttributeName,AttributeType,PrimaryKey,ForeignKey,Unique\n";
        for (const e of entities) {
          if (!e.attributes.length) {
            csv += `"${e.name}","${e.metaclass}","","","","",""\n`;
          } else {
            for (const a of e.attributes) {
              csv += `"${e.name}","${e.metaclass}","${a.name}","${a.type}","${!!a.pk}","${!!a.fk}","${!!a.unique}"\n`;
            }
          }
        }
        return csv;
      },
    },
    {
      id: "svg",
      label: "Canvas SVG",
      icon: "ti-photo",
      ext: "svg",
      color: "#f97316",
      mime: "image/svg+xml",
      gen: () => {
        const cols = Math.ceil(Math.sqrt(entities.length)) || 1;
        const EW2 = 180;
        const EH2 = 44;
        const totalH = Math.ceil(entities.length / cols) * 320 + 80;
        const parts = [
          `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${totalH}" viewBox="0 0 1200 ${totalH}">`,
          `<rect width="100%" height="100%" fill="#0d0d10"/>`,
        ];
        entities.forEach((e, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = 60 + col * 210;
          const y = 60 + row * (EH2 + e.attributes.length * 20 + 80);
          const mc =
            (
              {
                Entity: "#4f8ef7",
                Relation: "#34d399",
                Attribute: "#fbbf24",
                ValueSet: "#a78bfa",
              } as Record<string, string>
            )[e.metaclass] || "#4f8ef7";
          parts.push(
            `<rect x="${x}" y="${y}" width="${EW2}" height="${EH2 + e.attributes.length * 20 + 6}" rx="8" fill="#12121a" stroke="${mc}" stroke-width="1.5"/>`
          );
          parts.push(
            `<rect x="${x}" y="${y}" width="${EW2}" height="${EH2}" rx="8" fill="${mc}" fill-opacity="0.18"/>`
          );
          parts.push(
            `<text x="${x + 12}" y="${y + EH2 / 2 + 5}" font-family="sans-serif" font-size="13" font-weight="600" fill="#f0f0f5">${e.name}</text>`
          );
          parts.push(
            `<text x="${x + EW2 - 8}" y="${y + EH2 / 2 + 5}" font-family="monospace" font-size="9" fill="${mc}" text-anchor="end">${e.metaclass[0]}</text>`
          );
          e.attributes.forEach((a, ai) => {
            parts.push(
              `<text x="${x + 12}" y="${y + EH2 + 14 + ai * 20}" font-family="sans-serif" font-size="10" fill="${a.pk ? "#fbbf24" : a.fk ? "#4f8ef7" : "#888"}">${a.pk ? "[PK] " : a.fk ? "[FK] " : ""}${a.name}: ${a.type}</text>`
            );
          });
        });
        parts.push("</svg>");
        return parts.join("\n");
      },
    },
    {
      id: "html",
      label: "HTML Report",
      icon: "ti-file-text",
      ext: "html",
      color: "#fb7185",
      mime: "text/html",
      gen: () => {
        const turtle = entitiesToTurtle(entities, relations);
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${modelName}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;color:#1a1a2e;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #4f8ef7;padding-bottom:8px}h2{font-size:16px;margin-top:28px;border-left:3px solid #4f8ef7;padding-left:10px}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}th{background:#f0f4ff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #e8ecf4}pre{background:#f8f9ff;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;border:1px solid #e0e7ff;white-space:pre-wrap}</style></head><body>
<h1>Enterprise Data Model: ${modelName}</h1>
<p style="color:#666;font-size:13px">Exported ${new Date().toLocaleDateString("sv-SE")} · ${entities.length} entities · ${relations.length} relations</p>
<h2>Entities</h2><table><thead><tr><th>Entity</th><th>Metaclass</th><th>Attributes</th></tr></thead><tbody>
${entities
  .map(
    (e) =>
      "<tr><td><strong>" +
      e.name +
      "</strong></td><td>" +
      e.metaclass +
      "</td><td>" +
      e.attributes
        .map((a) => (a.pk ? "[PK] " : a.fk ? "[FK] " : "") + a.name + " (" + a.type + ")")
        .join(", ") +
      "</td></tr>"
  )
  .join("")}
</tbody></table>
<h2>Relations</h2><table><thead><tr><th>From</th><th>Relation</th><th>To</th><th>Cardinality</th></tr></thead><tbody>
${relations
  .map((r) => {
    const f = entities.find((e) => e.id === r.from);
    const t = entities.find((e) => e.id === r.to);
    return f && t
      ? "<tr><td>" +
          f.name +
          "</td><td><em>" +
          r.label +
          "</em></td><td>" +
          t.name +
          "</td><td>" +
          r.card +
          "</td></tr>"
      : "";
  })
  .join("")}
</tbody></table>
<h2>OWL / Turtle</h2><pre>${turtle.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
</body></html>`;
      },
    },
  ];

  const activeFormat = FORMATS.find((f) => f.id === selected);
  const content = activeFormat ? activeFormat.gen() : "";

  function copyToClipboard() {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        const ta = document.getElementById("export-content-ta") as HTMLTextAreaElement | null;
        if (ta) {
          ta.select();
          document.execCommand("copy");
        }
      });
  }

  function selectFormat(fid: string) {
    setSelected(fid);
    setCopied(false);
  }

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
          width: "min(900px,96vw)",
          height: "min(680px,92vh)",
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
              <i className="ti ti-upload" style={{ fontSize: 14, color: T.amber }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Export Model</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>
                Select a format — copy content or save the file
              </div>
            </div>
          </div>
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

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Format list */}
          <div
            style={{
              width: 190,
              borderRight: `1px solid ${T.border}`,
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => selectFormat(f.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 11px",
                  borderRadius: 8,
                  background:
                    selected === f.id
                      ? `rgba(${hexToRgb(f.color)},0.12)`
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selected === f.id ? f.color : T.border}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all .1s",
                }}
                onMouseEnter={(e) => {
                  if (selected !== f.id) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.borderColor = T.borderHi;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selected !== f.id) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = T.border;
                  }
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: `rgba(${hexToRgb(f.color)},0.15)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <i className={`ti ${f.icon}`} style={{ fontSize: 13, color: f.color }} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: selected === f.id ? 500 : 400,
                      color: selected === f.id ? f.color : T.text,
                    }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: T.textDim,
                      fontFamily: "JetBrains Mono,monospace",
                      marginTop: 1,
                    }}
                  >
                    .{f.ext}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selected && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: 0.5,
                }}
              >
                <i className="ti ti-arrow-left" style={{ fontSize: 24, color: T.textDim }} />
                <p style={{ fontSize: 12, color: T.textDim, margin: 0 }}>
                  Select a format to preview and export
                </p>
              </div>
            )}
            {selected && activeFormat && (
              <>
                {/* Toolbar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderBottom: `1px solid ${T.border}`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: T.textDim,
                      fontFamily: "JetBrains Mono,monospace",
                      flex: 1,
                    }}
                  >
                    {modelName}.{activeFormat.ext} &nbsp;·&nbsp;{" "}
                    {content.length.toLocaleString()} chars
                  </span>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 14px",
                      borderRadius: 7,
                      background: copied ? "rgba(52,211,153,0.15)" : T.accentDim,
                      border: `1px solid ${copied ? T.green : T.accent}`,
                      color: copied ? T.green : T.accent,
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    <i
                      className={`ti ${copied ? "ti-check" : "ti-copy"}`}
                      style={{ fontSize: 12 }}
                    />
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </button>
                  <a
                    href={`data:${activeFormat.mime};charset=utf-8,${encodeURIComponent(content)}`}
                    download={`${modelName}.${activeFormat.ext}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 14px",
                      borderRadius: 7,
                      background: "rgba(251,191,36,0.12)",
                      border: "1px solid rgba(251,191,36,0.35)",
                      color: T.amber,
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(251,191,36,0.22)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "rgba(251,191,36,0.12)")
                    }
                  >
                    <i className="ti ti-download" style={{ fontSize: 12 }} />
                    Save file
                  </a>
                </div>
                <textarea
                  id="export-content-ta"
                  readOnly
                  value={content}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    padding: "14px 16px",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono,monospace",
                    color: T.textMid,
                    lineHeight: 1.7,
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
