import { useState } from "react";
import type { Entity, Field } from "../types";
import { T } from "../tokens";

interface LinkedViewProps {
  entities: Entity[];
  fields: Field[];
  setFields: React.Dispatch<React.SetStateAction<Field[]>>;
}

export function LinkedView({ entities, fields, setFields }: LinkedViewProps) {
  const allAttrs = entities.flatMap((e) =>
    e.attributes.map((a) => ({
      path: `${e.id}.${a.name}`,
      label: `${e.name} · ${a.name}`,
    }))
  );
  const sources = ["all", ...new Set(fields.map((f) => f.source))];
  const [src, setSrc] = useState("all");
  const shown = src === "all" ? fields : fields.filter((f) => f.source === src);
  const unmapped = shown.filter((f) => !f.mapped);
  const mapped = shown.filter((f) => f.mapped);

  function Row({ f }: { f: Field }) {
    const isUnmapped = !f.mapped;
    const entity = entities.find((e) => e.id === f.mapped?.split(".")[0]);
    const attrName = f.mapped?.split(".")[1];
    const col = isUnmapped ? "248,113,113" : "52,211,153";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 14px",
          marginBottom: 3,
          borderRadius: 8,
          background: `rgba(${col},0.05)`,
          border: `1px solid rgba(${col},0.14)`,
        }}
      >
        <div
          style={{
            width: 3,
            height: 32,
            borderRadius: 2,
            background: isUnmapped ? T.red : T.green,
            flexShrink: 0,
            opacity: 0.8,
          }}
        />
        <div style={{ flex: "0 0 115px" }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: T.text,
              fontFamily: "JetBrains Mono,monospace",
            }}
          >
            {f.field}
          </div>
          <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 1 }}>{f.source}</div>
        </div>
        <span
          style={{
            fontSize: 9.5,
            padding: "2px 7px",
            borderRadius: 20,
            background: `rgba(${col},0.12)`,
            color: isUnmapped ? T.red : T.green,
            fontFamily: "JetBrains Mono,monospace",
            flexShrink: 0,
          }}
        >
          {f.type}
        </span>
        <div
          style={{
            flex: "0 0 80px",
            fontSize: 10,
            color: T.textDim,
            fontFamily: "JetBrains Mono,monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {f.sample}
        </div>
        {isUnmapped ? (
          <select
            value=""
            onChange={(e) =>
              setFields((prev) =>
                prev.map((sf) =>
                  sf.id === f.id ? { ...sf, mapped: e.target.value || null } : sf
                )
              )
            }
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              color: T.textMid,
              outline: "none",
            }}
          >
            <option value="">Map to model field…</option>
            {allAttrs.map((a) => (
              <option key={a.path} value={a.path} style={{ background: "#1a1a22" }}>
                {a.label}
              </option>
            ))}
          </select>
        ) : (
          <>
            <i className="ti ti-arrow-right" style={{ color: T.textDim, fontSize: 12 }} />
            <span
              style={{ flex: 1, fontSize: 11, color: T.green, fontFamily: "JetBrains Mono,monospace" }}
            >
              {entity?.name} · {attrName}
            </span>
            <button
              onClick={() =>
                setFields((prev) =>
                  prev.map((sf) => (sf.id === f.id ? { ...sf, mapped: null } : sf))
                )
              }
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: T.textDim,
                fontSize: 13,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
            >
              ×
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 5, marginBottom: 20, alignItems: "center" }}>
        <span
          style={{ fontSize: 10.5, color: T.textDim, marginRight: 4, letterSpacing: "0.04em" }}
        >
          SOURCE
        </span>
        {sources.map((s) => (
          <button
            key={s}
            onClick={() => setSrc(s)}
            style={{
              fontSize: 10.5,
              padding: "3px 11px",
              borderRadius: 20,
              background: src === s ? T.accentDim : "transparent",
              border: `1px solid ${src === s ? T.accent : T.border}`,
              color: src === s ? T.accent : T.textMid,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.textDim }}>
          {unmapped.length} gaps · {mapped.length} mapped
        </span>
      </div>
      {unmapped.length > 0 && (
        <div style={{ marginBottom: 20 }}>
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
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: T.red,
                display: "inline-block",
              }}
            />
            Unmapped — {unmapped.length}
          </div>
          {unmapped.map((f) => (
            <Row key={f.id} f={f} />
          ))}
        </div>
      )}
      <div>
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
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: T.green,
              display: "inline-block",
            }}
          />
          Mapped — {mapped.length}
        </div>
        {mapped.map((f) => (
          <Row key={f.id} f={f} />
        ))}
      </div>
    </div>
  );
}
