import type { Entity, Relation } from "../types";
import { T, META } from "../tokens";

interface InspectorProps {
  entity: Entity | undefined;
  relation?: Relation;
  onUpdateRelation?: (id: string, patch: Partial<Relation>) => void;
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  setRelations: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedId: string | null;
  mode: string;
}

export function Inspector({
  entity,
  relation,
  onUpdateRelation,
  entities,
  setEntities,
  setRelations,
  setSelectedId,
  selectedId,
  mode,
}: InspectorProps) {
  if (!entity && relation && onUpdateRelation) {
    const labelStyle: React.CSSProperties = {
      fontSize: 9.5,
      color: T.textDim,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 5,
    };
    const selectStyle: React.CSSProperties = {
      width: "100%",
      background: "rgba(20,20,28,0.9)",
      border: `1px solid ${T.border}`,
      borderRadius: 7,
      padding: "6px 8px",
      fontSize: 12,
      color: T.textMid,
      outline: "none",
    };
    const effectiveType = relation.relationType ?? "association";
    return (
      <div
        style={{
          width: 250,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Label */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <label style={labelStyle}>Relation Label</label>
            <button
              onClick={() => {
                setRelations((prev: any[]) => prev.filter((r) => r.id !== relation.id));
                setSelectedId(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 5,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: T.red,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(248,113,113,0.18)";
                e.currentTarget.style.borderColor = T.red;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(248,113,113,0.08)";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)";
              }}
            >
              <i className="ti ti-trash" style={{ fontSize: 11 }} /> Delete
            </button>
          </div>
          <input
            value={relation.label}
            onChange={(e) => onUpdateRelation(relation.id, { label: e.target.value })}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 500,
              color: T.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Cardinality */}
        <div>
          <label style={labelStyle}>Cardinality</label>
          <select
            value={relation.card}
            onChange={(e) => onUpdateRelation(relation.id, { card: e.target.value as any })}
            style={selectStyle}
          >
            {["1 → 1", "1 → N", "N → 1", "M → N"].map((c) => (
              <option key={c} style={{ background: "#1a1a22" }}>{c}</option>
            ))}
          </select>
        </div>

        {/* Relation type */}
        <div>
          <label style={labelStyle}>Relation Type</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { value: "association", label: "Association", desc: "Regular has-a / uses / references" },
              { value: "generalization", label: "Generalization", desc: "IS-A, subtype, extends, classifies" },
              { value: "realization", label: "Realization", desc: "Implements, conforms to, fulfils" },
              { value: "composition", label: "Composition", desc: "Strong ownership (part destroyed with whole)" },
              { value: "aggregation", label: "Aggregation", desc: "Weak ownership (part survives whole)" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  onUpdateRelation(relation.id, {
                    relationType: opt.value as any,
                    detectionSource: "explicit",
                  })
                }
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  textAlign: "left",
                  cursor: "pointer",
                  background:
                    effectiveType === opt.value
                      ? "rgba(79,142,247,0.12)"
                      : "rgba(255,255,255,0.025)",
                  border: `1px solid ${effectiveType === opt.value ? T.accent : T.border}`,
                  color: effectiveType === opt.value ? T.accent : T.textMid,
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 500 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          {relation.detectionSource === "inferred" && (
            <div style={{ marginTop: 6, fontSize: 10, color: T.amber }}>
              ~ Auto-inferred from label. Set explicitly above to confirm.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div
        style={{
          width: 250,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 20,
        }}
      >
        <i className="ti ti-click" style={{ fontSize: 24, color: T.textDim }} aria-hidden="true" />
        <p
          style={{
            fontSize: 11,
            color: T.textDim,
            textAlign: "center",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Select an entity or relation to inspect
        </p>
      </div>
    );
  }

  const m = META[entity.metaclass] || META.Entity;
  const attrEntities = entities.filter((e) => e.metaclass === "Attribute" && e.id !== entity.id);
  const implementedIds = new Set((entity.implementations || []).map((i) => i.attributeEntityId));

  function update(patch: Partial<Entity>) {
    setEntities((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
  }

  function deleteSelected() {
    setEntities((prev) => prev.filter((e) => e.id !== selectedId));
    setRelations((prev: any[]) =>
      prev.filter((r) => r.from !== selectedId && r.to !== selectedId)
    );
    setSelectedId(null);
  }

  function addImpl(attrId: string) {
    if (!entity) return;
    update({
      implementations: [
        ...(entity.implementations || []),
        { attributeEntityId: attrId, enabled: true },
      ],
    });
  }

  function toggleImpl(attrId: string, enabled: boolean) {
    if (!entity) return;
    update({
      implementations: (entity.implementations || []).map((im) =>
        im.attributeEntityId === attrId ? { ...im, enabled } : im
      ),
    });
  }

  function removeImpl(attrId: string) {
    if (!entity) return;
    update({
      implementations: (entity.implementations || []).filter(
        (im) => im.attributeEntityId !== attrId
      ),
    });
  }

  return (
    <div
      style={{
        width: 250,
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Name */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <label
            style={{
              fontSize: 9.5,
              color: T.textDim,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            Name
          </label>
          <button
            onClick={deleteSelected}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 5,
              background: "rgba(248,113,113,0.08)",
              border: `1px solid rgba(248,113,113,0.2)`,
              color: T.red,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(248,113,113,0.18)";
              e.currentTarget.style.borderColor = T.red;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(248,113,113,0.08)";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)";
            }}
          >
            <i className="ti ti-trash" style={{ fontSize: 11 }} /> Delete
          </button>
        </div>
        <input
          value={entity.name}
          onChange={(e) => update({ name: e.target.value })}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 500,
            color: T.text,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = m.color)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
      </div>

      {/* Metaclass */}
      <div>
        <label
          style={{
            fontSize: 9.5,
            color: T.textDim,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            display: "block",
            marginBottom: 5,
          }}
        >
          Metaclass
        </label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Object.keys(META).map((k) => (
            <button
              key={k}
              onClick={() => update({ metaclass: k as Entity["metaclass"] })}
              style={{
                fontSize: 10,
                padding: "3px 9px",
                borderRadius: 20,
                cursor: "pointer",
                background: entity.metaclass === k ? META[k as keyof typeof META].dim : "transparent",
                border: `1px solid ${entity.metaclass === k ? META[k as keyof typeof META].color : T.border}`,
                color: entity.metaclass === k ? META[k as keyof typeof META].color : T.textDim,
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Attributes */}
      {mode === "logical" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 7,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                color: T.textDim,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}
            >
              Attributes
            </span>
            <button
              onClick={() =>
                update({ attributes: [...entity.attributes, { name: "newField", type: "String" }] })
              }
              style={{
                background: "none",
                border: `1px solid ${T.border}`,
                borderRadius: 5,
                padding: "2px 8px",
                fontSize: 10,
                color: T.accent,
                cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
          {entity.attributes.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
              <span
                style={{
                  width: 14,
                  textAlign: "center",
                  fontSize: 10,
                  color: a.pk ? T.amber : a.fk ? T.accent : T.textDim,
                  flexShrink: 0,
                }}
              >
                {a.pk ? "⬡" : a.fk ? "◈" : "·"}
              </span>
              <input
                value={a.name}
                onChange={(ev) =>
                  update({
                    attributes: entity.attributes.map((at, ai) =>
                      ai === i ? { ...at, name: ev.target.value } : at
                    ),
                  })
                }
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 5,
                  padding: "4px 7px",
                  fontSize: 10.5,
                  color: T.text,
                  outline: "none",
                }}
              />
              <select
                value={a.type}
                onChange={(ev) =>
                  update({
                    attributes: entity.attributes.map((at, ai) =>
                      ai === i ? { ...at, type: ev.target.value as any } : at
                    ),
                  })
                }
                style={{
                  width: 72,
                  background: "rgba(20,20,28,0.9)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 5,
                  padding: "4px",
                  fontSize: 9.5,
                  color: T.textMid,
                  outline: "none",
                }}
              >
                {["UUID", "String", "Integer", "Decimal", "Boolean", "DateTime", "Enum", "Text"].map(
                  (t) => (
                    <option key={t} style={{ background: "#1a1a22" }}>
                      {t}
                    </option>
                  )
                )}
              </select>
              <button
                onClick={() =>
                  update({ attributes: entity.attributes.filter((_, ai) => ai !== i) })
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.textDim,
                  fontSize: 13,
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attribute Implementations */}
      {mode === "logical" && entity.metaclass !== "Attribute" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 7,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                color: T.textDim,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}
            >
              Implemented Attributes
            </span>
          </div>
          {(entity.implementations || []).length === 0 && attrEntities.length === 0 && (
            <p style={{ fontSize: 10.5, color: T.textDim, margin: 0 }}>
              No Attribute entities exist yet.
            </p>
          )}
          {(entity.implementations || []).map((im) => {
            const ae = entities.find((x) => x.id === im.attributeEntityId);
            const enabled = im.enabled !== false;
            return (
              <div
                key={im.attributeEntityId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 5,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: `rgba(${enabled ? "251,191,36" : "255,255,255"},${enabled ? ".06" : ".02"})`,
                  border: `1px solid ${enabled ? META.Attribute.color : T.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    flex: 1,
                    color: enabled ? META.Attribute.color : T.textDim,
                    fontWeight: 500,
                  }}
                >
                  {ae?.name || im.attributeEntityId}
                </span>
                <button
                  onClick={() => toggleImpl(im.attributeEntityId, !enabled)}
                  title={enabled ? "Disable" : "Enable"}
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "none",
                    border: `1px solid ${T.border}`,
                    color: enabled ? T.amber : T.textDim,
                    cursor: "pointer",
                  }}
                >
                  {enabled ? "On" : "Off"}
                </button>
                <button
                  onClick={() => removeImpl(im.attributeEntityId)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: T.textDim,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                >
                  ×
                </button>
              </div>
            );
          })}
          {attrEntities.filter((ae) => !implementedIds.has(ae.id)).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addImpl(e.target.value);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 11,
                  color: T.textMid,
                  outline: "none",
                }}
              >
                <option value="">+ Implement attribute…</option>
                {attrEntities
                  .filter((ae) => !implementedIds.has(ae.id))
                  .map((ae) => (
                    <option key={ae.id} value={ae.id} style={{ background: "#1a1a22" }}>
                      {ae.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}

      {mode === "conceptual" && (
        <div
          style={{
            padding: "9px 12px",
            background: "rgba(79,142,247,0.06)",
            borderRadius: 8,
            border: `1px solid rgba(79,142,247,0.15)`,
          }}
        >
          <p style={{ fontSize: 11, color: T.textMid, margin: 0, lineHeight: 1.5 }}>
            Switch to <strong style={{ color: T.accent }}>Logical</strong> mode to edit attributes
            and implementations.
          </p>
        </div>
      )}
    </div>
  );
}
