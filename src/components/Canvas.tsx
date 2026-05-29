import { useState, useRef, useEffect } from "react";
import type { Entity, Relation } from "../types";
import { T, META, EW, EH, ec } from "../tokens";
import { resolveHierarchyEdge } from "../lib/taxonomy";

interface CanvasProps {
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  relations: Relation[];
  setRelations: React.Dispatch<React.SetStateAction<Relation[]>>;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  showAttrs: boolean;
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  type: "entity" | "pan";
  id?: string;
  ox?: number;
  oy?: number;
  sx?: number;
  sy?: number;
}

interface WireState {
  fromId: string;
  cx?: number;
  cy?: number;
  toId: string | null;
}

export function Canvas({
  entities,
  setEntities,
  relations,
  setRelations,
  selectedId,
  setSelectedId,
  showAttrs,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const vpRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const dragState = useRef<DragState | null>(null);
  const [wire, setWire] = useState<WireState | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [hovRel, setHovRel] = useState<string | null>(null);

  // Quick-connect popup shown after dragging a wire onto a target entity
  interface QuickConnect { fromId: string; toId: string; x: number; y: number; }
  const [quickConnect, setQuickConnect] = useState<QuickConnect | null>(null);

  useEffect(() => {
    vpRef.current = vp;
  }, [vp]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.909;
      setVp((v) => {
        const ns = Math.max(0.12, Math.min(4, v.scale * factor));
        return {
          scale: ns,
          x: px - (px - v.x) * (ns / v.scale),
          y: py - (py - v.y) * (ns / v.scale),
        };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  function screenToCanvas(sx: number, sy: number) {
    const v = vpRef.current;
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (sx - rect.left - v.x) / v.scale, y: (sy - rect.top - v.y) / v.scale };
  }

  function fitAll() {
    if (!entities.length || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pad = 60;
    const minX = Math.min(...entities.map((e) => e.x));
    const minY = Math.min(...entities.map((e) => e.y));
    const maxX = Math.max(...entities.map((e) => e.x + EW));
    const maxY = Math.max(
      ...entities.map((e) => e.y + (showAttrs ? e.attributes.length * 22 + EH + 10 : EH))
    );
    const ns = Math.min(
      (rect.width - pad * 2) / (maxX - minX),
      (rect.height - pad * 2) / (maxY - minY),
      1.5
    );
    setVp({ scale: ns, x: pad - minX * ns, y: pad - minY * ns });
  }

  function addEntity() {
    const id = `e${Date.now()}`;
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = (rect.width / 2 - vp.x) / vp.scale - EW / 2;
    const cy = (rect.height / 2 - vp.y) / vp.scale - EH / 2;
    setEntities((prev) => [
      ...prev,
      {
        id,
        name: "NewEntity",
        metaclass: "Entity",
        x: Math.max(0, cx),
        y: Math.max(0, cy),
        attributes: [{ name: "id", type: "UUID", pk: true }],
        implementations: [],
      },
    ]);
    setSelectedId(id);
  }

  function deleteSelected(id: string) {
    if (!id) return;
    setEntities((prev) => prev.filter((e) => e.id !== id));
    setRelations((prev) => prev.filter((r) => r.id !== id && r.from !== id && r.to !== id));
    setSelectedId(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (quickConnect) { setQuickConnect(null); return; }
        setSelectedId(null);
        return;
      }
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const el = document.activeElement as HTMLElement;
        if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;
        e.preventDefault();
        deleteSelected(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, quickConnect]);

  function onSVGPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    let el: Element | null = e.target as Element;
    let entityId: string | null = null;
    let relationId: string | null = null;
    while (el && el !== e.currentTarget) {
      if ((el as HTMLElement).dataset?.eid) {
        entityId = (el as HTMLElement).dataset.eid!;
        break;
      }
      if ((el as HTMLElement).dataset?.rid) {
        relationId = (el as HTMLElement).dataset.rid!;
        break;
      }
      el = el.parentElement;
    }

    if (entityId) {
      const c = screenToCanvas(e.clientX, e.clientY);
      const ent = entities.find((x) => x.id === entityId);
      if (!ent) return;
      dragState.current = { type: "entity", id: entityId, ox: c.x - ent.x, oy: c.y - ent.y };
      setSelectedId(entityId);
    } else if (relationId) {
      // Select the relation; don't start a pan drag
      setSelectedId(relationId);
    } else {
      const v = vpRef.current;
      dragState.current = { type: "pan", sx: e.clientX - v.x, sy: e.clientY - v.y };
      setSelectedId(null);
    }
  }

  function onSVGPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const ds = dragState.current;
    if (!ds) {
      if (wire) {
        const c = screenToCanvas(e.clientX, e.clientY);
        setWire((w) => (w ? { ...w, cx: c.x, cy: c.y } : null));
      }
      return;
    }
    if (ds.type === "pan") {
      setVp((v) => ({ ...v, x: e.clientX - ds.sx!, y: e.clientY - ds.sy! }));
    } else if (ds.type === "entity") {
      const c = screenToCanvas(e.clientX, e.clientY);
      setEntities((prev) =>
        prev.map((en) =>
          en.id === ds.id
            ? { ...en, x: Math.max(0, c.x - ds.ox!), y: Math.max(0, c.y - ds.oy!) }
            : en
        )
      );
    }
  }

  function onSVGPointerUp() {
    if (wire?.toId) {
      // Show quick-connect popup instead of immediately creating with a default label
      const ef = entities.find((e) => e.id === wire.fromId);
      const et = entities.find((e) => e.id === wire.toId);
      if (ef && et) {
        const a = ec(ef);
        const b = ec(et);
        const canvasMx = (a.x + b.x) / 2;
        const canvasMy = (a.y + b.y) / 2 - 38;
        const { x: vpX, y: vpY, scale } = vpRef.current;
        const px = Math.round(canvasMx * scale + vpX);
        const py = Math.round(canvasMy * scale + vpY);
        setQuickConnect({ fromId: wire.fromId, toId: wire.toId, x: px, y: py });
      }
    }
    dragState.current = null;
    setWire(null);
  }

  interface QuickOpt {
    type: "generalization" | "realization" | "association";
    label: string;
    card: "1 → 1" | "1 → N" | "N → 1" | "M → N";
    icon: string;
    color: string;
    heading: string;
    sub: string;
  }

  function getQuickOpts(fromName: string, toName: string): QuickOpt[] {
    return [
      {
        type: "generalization",
        label: "is a kind of",
        card: "N → 1",
        icon: "ti-git-merge",
        color: "#a78bfa",
        heading: `${fromName} is a kind of ${toName}`,
        sub: "child → parent · subtype · extends",
      },
      {
        type: "generalization",
        label: "classifies",
        card: "1 → N",
        icon: "ti-git-branch",
        color: "#a78bfa",
        heading: `${fromName} classifies ${toName}`,
        sub: "parent → child · supertype · generalizes",
      },
      {
        type: "realization",
        label: "implements",
        card: "N → 1",
        icon: "ti-circle-dotted",
        color: "#a78bfa",
        heading: `${fromName} implements ${toName}`,
        sub: "implementor → interface · conforms to",
      },
      {
        type: "association",
        label: "relates to",
        card: "1 → N",
        icon: "ti-arrow-right",
        color: "rgba(240,240,245,0.5)",
        heading: "relates to",
        sub: "generic · has · uses · references",
      },
    ];
  }

  function createQuickRelation(opt: QuickOpt) {
    if (!quickConnect) return;
    const rel: Relation = {
      id: `r${Date.now()}`,
      from: quickConnect.fromId,
      to: quickConnect.toId,
      label: opt.label,
      card: opt.card,
    };
    if (opt.type !== "association") {
      (rel as any).relationType = opt.type;
      (rel as any).detectionSource = "explicit";
    }
    setRelations((prev) => [...prev, rel]);
    setSelectedId(rel.id);
    setQuickConnect(null);
  }

  function onPortPointerDown(e: React.PointerEvent<SVGCircleElement>, fromId: string) {
    e.stopPropagation();
    const c = screenToCanvas(e.clientX, e.clientY);
    setWire({ fromId, cx: c.x, cy: c.y, toId: null });
    dragState.current = null;
  }

  const { x: vpX, y: vpY, scale } = vp;
  const transform = `translate(${vpX},${vpY}) scale(${scale})`;

  // Compute arc slots so parallel / anti-parallel relations between the same entity pair
  // are offset onto separate curves rather than overlapping.
  const arcSlot = (() => {
    const pairRels = new Map<string, string[]>();
    for (const r of relations) {
      const key = [r.from, r.to].sort().join("|");
      if (!pairRels.has(key)) pairRels.set(key, []);
      pairRels.get(key)!.push(r.id);
    }
    const map = new Map<string, number>();
    for (const ids of pairRels.values()) {
      ids.forEach((id, i) => map.set(id, i));
    }
    return map;
  })();

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: T.bg }}>
      {/* Floating toolbar TL */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 10,
          display: "flex",
          gap: 6,
          pointerEvents: "all",
        }}
      >
        <button
          onClick={addEntity}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 500,
            background: T.glass,
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            color: T.text,
            cursor: "pointer",
            backdropFilter: "blur(16px)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.surfaceHover;
            e.currentTarget.style.borderColor = T.borderHi;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T.glass;
            e.currentTarget.style.borderColor = T.border;
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 12 }} /> Entity
        </button>
        <button
          onClick={fitAll}
          title="Fit all"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.glass,
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            color: T.textMid,
            cursor: "pointer",
            backdropFilter: "blur(16px)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.textMid)}
        >
          <i className="ti ti-maximize" style={{ fontSize: 13 }} />
        </button>
        {selectedId && (
          <button
            onClick={() => deleteSelected(selectedId)}
            title="Delete selected (Del)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              fontSize: 11,
              fontWeight: 500,
              background: "rgba(248,113,113,0.1)",
              border: `1px solid rgba(248,113,113,0.3)`,
              borderRadius: 7,
              color: T.red,
              cursor: "pointer",
              backdropFilter: "blur(16px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(248,113,113,0.22)";
              e.currentTarget.style.borderColor = T.red;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(248,113,113,0.1)";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
            }}
          >
            <i className="ti ti-trash" style={{ fontSize: 12 }} /> Delete
          </button>
        )}
      </div>

      {/* Zoom controls TR */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 10,
          display: "flex",
          gap: 4,
          alignItems: "center",
          pointerEvents: "all",
        }}
      >
        <button
          onClick={() => setVp((v) => ({ ...v, scale: Math.min(4, v.scale * 1.2) }))}
          style={{
            width: 28,
            height: 28,
            background: T.glass,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.textMid,
            cursor: "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(12px)",
            lineHeight: 1,
          }}
        >
          +
        </button>
        <span
          style={{
            fontSize: 10.5,
            color: T.textDim,
            minWidth: 38,
            textAlign: "center",
            fontFamily: T.mono,
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setVp((v) => ({ ...v, scale: Math.max(0.12, v.scale / 1.2) }))}
          style={{
            width: 28,
            height: 28,
            background: T.glass,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.textMid,
            cursor: "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(12px)",
            lineHeight: 1,
          }}
        >
          −
        </button>
        <button
          onClick={() => setVp({ x: 0, y: 0, scale: 1 })}
          style={{
            fontSize: 9.5,
            padding: "4px 8px",
            background: T.glass,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.textDim,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
          }}
        >
          Reset
        </button>
      </div>

      {/* Stats BL */}
      <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 10, pointerEvents: "none" }}>
        <span
          style={{
            fontSize: 10,
            padding: "4px 10px",
            background: "rgba(13,13,16,0.75)",
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            color: T.textDim,
          }}
        >
          {entities.length} entities · {relations.length} relations
        </span>
      </div>

      {/* Legend BR */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          zIndex: 10,
          display: "flex",
          gap: 8,
          padding: "6px 12px",
          background: "rgba(13,13,16,0.75)",
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          pointerEvents: "none",
        }}
      >
        {Object.entries(META).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color, opacity: 0.8 }} />
            <span style={{ fontSize: 9.5, color: T.textDim }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Main SVG */}
      {/* ── Quick-connect popup ─────────────────────────────────────── */}
      {quickConnect && (() => {
        const fromEnt = entities.find((e) => e.id === quickConnect.fromId);
        const toEnt   = entities.find((e) => e.id === quickConnect.toId);
        const fName = fromEnt?.name ?? "?";
        const tName = toEnt?.name   ?? "?";
        const opts = getQuickOpts(fName, tName);

        // Clamp so popup stays inside container
        const popW = 272, popH = 294;
        const rect = containerRef.current?.getBoundingClientRect();
        const cW = rect?.width ?? 800, cH = rect?.height ?? 600;
        const left = Math.min(Math.max(quickConnect.x - popW / 2, 8), cW - popW - 8);
        const top  = Math.min(Math.max(quickConnect.y - popH / 2, 8), cH - popH - 8);
        return (
          <div
            style={{
              position: "absolute", left, top, width: popW, zIndex: 60,
              background: "rgba(18,18,26,0.97)",
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 12,
              boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
              padding: "10px 10px 8px",
              display: "flex", flexDirection: "column", gap: 4,
              backdropFilter: "blur(16px)",
              animation: "fadeInScale .12s ease",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 9.5, color: T.textDim, letterSpacing: "0.06em", textTransform: "uppercase", paddingLeft: 4, marginBottom: 2 }}>
              Relation type
            </div>
            {opts.map((opt) => (
              <button
                key={opt.label}
                onClick={() => createQuickRelation(opt)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(255,255,255,0.07)`,
                  cursor: "pointer", textAlign: "left",
                  transition: "background .1s, border-color .1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `rgba(${opt.type === "association" ? "255,255,255" : "167,139,250"},0.08)`;
                  e.currentTarget.style.borderColor = opt.type === "association" ? T.borderHi : "rgba(167,139,250,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <i className={`ti ${opt.icon}`} style={{ fontSize: 15, color: opt.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: opt.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.heading}
                  </div>
                  <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 1 }}>{opt.sub}</div>
                </div>
              </button>
            ))}
            <button
              onClick={() => setQuickConnect(null)}
              style={{ fontSize: 10, color: T.textDim, background: "none", border: "none", cursor: "pointer", paddingTop: 3, paddingBottom: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.textMid)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
            >
              Cancel (Esc)
            </button>
          </div>
        );
      })()}

      <svg
        style={{ width: "100%", height: "100%", display: "block", cursor: "default" }}
        onPointerDown={onSVGPointerDown}
        onPointerMove={onSVGPointerMove}
        onPointerUp={onSVGPointerUp}
        onPointerCancel={onSVGPointerUp}
      >
        <defs>
          <pattern
            id="dots"
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
            patternTransform={transform}
          >
            <circle cx={12} cy={12} r={0.85} fill="rgba(255,255,255,0.09)" />
          </pattern>
          <marker id="arr" markerWidth={8} markerHeight={8} refX={7} refY={3} orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.3)" />
          </marker>
          <marker id="arr-impl" markerWidth={8} markerHeight={8} refX={7} refY={3} orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={META.Attribute.color} opacity={0.7} />
          </marker>
          {/* Hollow triangle for generalization (IS-A) */}
          <marker id="arr-gen" markerWidth={12} markerHeight={12} refX={10} refY={5} orient="auto">
            <path d="M0,0 L0,10 L10,5 z" fill="#0d0d10" stroke="rgba(167,139,250,0.75)" strokeWidth={1.5} />
          </marker>
          {/* Hollow triangle for realization (implements) */}
          <marker id="arr-real" markerWidth={12} markerHeight={12} refX={10} refY={5} orient="auto">
            <path d="M0,0 L0,10 L10,5 z" fill="#0d0d10" stroke="rgba(167,139,250,0.55)" strokeWidth={1.5} />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#dots)" />

        <g transform={transform}>
          {/* Relations */}
          {relations.map((r) => {
            const ef = entities.find((e) => e.id === r.from);
            const et = entities.find((e) => e.id === r.to);
            if (!ef || !et) return null;
            const a = ec(ef);
            const b = ec(et);

            // Slot-based perpendicular offset separates parallel / anti-parallel arcs.
            // Slot 0 keeps the existing arc shape; subsequent slots mirror to the other side.
            const slot = arcSlot.get(r.id) ?? 0;
            let mx: number, my: number;
            if (slot === 0) {
              mx = (a.x + b.x) / 2;
              my = (a.y + b.y) / 2 - 38;
            } else {
              const SLOT_PERP = [-38, 38, -68, 68, -98, 98];
              const perpOff = SLOT_PERP[Math.min(slot, SLOT_PERP.length - 1)];
              const rdx = b.x - a.x;
              const rdy = b.y - a.y;
              const rlen = Math.hypot(rdx, rdy) || 1;
              mx = (a.x + b.x) / 2 + (-rdy / rlen) * perpOff;
              my = (a.y + b.y) / 2 + (rdx / rlen) * perpOff;
            }
            const path = `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;

            const hierEdge = resolveHierarchyEdge(r);
            const isGen = hierEdge?.family === "generalization";
            const isReal = hierEdge?.family === "realization";
            const lineColor = selectedId === r.id
              ? "rgba(248,113,113,0.5)"
              : isGen || isReal
                ? "rgba(167,139,250,0.45)"
                : "rgba(255,255,255,0.22)";
            const marker = isGen ? "url(#arr-gen)" : isReal ? "url(#arr-real)" : "url(#arr)";
            const strokeDash = isReal ? "5,4" : undefined;

            const isHovRel = hovRel === r.id;
            const isSelRel = selectedId === r.id;
            return (
              <g
                key={r.id}
                data-rid={r.id}
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}
                onMouseEnter={() => setHovRel(r.id)}
                onMouseLeave={() => setHovRel(null)}
              >
                {/* Wide invisible hit zone */}
                <path d={path} fill="none" stroke="transparent" strokeWidth={14} strokeLinecap="round" />
                {/* Glow behind line when hovered/selected */}
                {(isHovRel || isSelRel) && (
                  <path
                    d={path}
                    fill="none"
                    stroke={isSelRel ? "rgba(248,113,113,0.15)" : "rgba(167,139,250,0.12)"}
                    strokeWidth={8}
                    strokeLinecap="round"
                  />
                )}
                <path
                  d={path}
                  fill="none"
                  stroke={
                    isSelRel
                      ? "rgba(248,113,113,0.7)"
                      : isHovRel
                        ? (isGen || isReal ? "rgba(167,139,250,0.75)" : "rgba(255,255,255,0.55)")
                        : lineColor
                  }
                  strokeWidth={isSelRel || isHovRel ? 1.5 : 1}
                  strokeDasharray={strokeDash}
                  markerEnd={marker}
                />
                <rect
                  x={mx - 32}
                  y={my - 10}
                  width={64}
                  height={18}
                  rx={5}
                  fill="rgba(13,13,16,0.9)"
                  stroke={
                    isSelRel ? T.red
                    : isHovRel ? (isGen || isReal ? "rgba(167,139,250,0.5)" : T.borderHi)
                    : T.border
                  }
                  strokeWidth={isSelRel || isHovRel ? 1 : 0.5}
                />
                <text
                  x={mx}
                  y={my + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isSelRel ? T.red : isHovRel ? T.text : T.textMid}
                  fontFamily="DM Sans,sans-serif"
                >
                  {r.label}
                </text>
                <text
                  x={mx}
                  y={my + 21}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill={T.textDim}
                  fontFamily={T.mono}
                >
                  {r.card}
                </text>
                {selectedId === r.id && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSelected(r.id);
                    }}
                  >
                    <circle
                      cx={mx + 34}
                      cy={my - 8}
                      r={7}
                      fill="rgba(248,113,113,0.18)"
                      stroke={T.red}
                      strokeWidth={0.8}
                      style={{ cursor: "pointer" }}
                    />
                    <text
                      x={mx + 34}
                      y={my - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill={T.red}
                      fontWeight={600}
                      style={{ pointerEvents: "none" }}
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Attribute implementation dashes */}
          {entities.flatMap((host) =>
            (host.implementations || [])
              .filter((im) => im.enabled !== false)
              .map((im) => {
                const ae = entities.find((e) => e.id === im.attributeEntityId);
                if (!ae) return null;
                return (
                  <line
                    key={`impl-${host.id}-${im.attributeEntityId}`}
                    x1={host.x + EW / 2}
                    y1={host.y + EH / 2}
                    x2={ae.x + EW / 2}
                    y2={ae.y + EH / 2}
                    stroke={META.Attribute.color}
                    strokeWidth={1}
                    strokeDasharray="5,3"
                    opacity={0.45}
                    markerEnd="url(#arr-impl)"
                  />
                );
              })
          )}

          {/* Wire preview */}
          {wire &&
            (() => {
              const ef = entities.find((e) => e.id === wire.fromId);
              if (!ef) return null;
              return (
                <line
                  x1={ef.x + EW / 2}
                  y1={ef.y + EH / 2}
                  x2={wire.cx ?? ef.x}
                  y2={wire.cy ?? ef.y}
                  stroke={T.accent}
                  strokeWidth={1.5}
                  strokeDasharray="5,3"
                  markerEnd="url(#arr)"
                  opacity={0.7}
                />
              );
            })()}

          {/* Entities */}
          {entities.map((e) => {
            const isSel = selectedId === e.id;
            const isHov = hov === e.id;
            const m = META[e.metaclass] || META.Entity;
            const implCount = (e.implementations || []).length;
            const attrH = showAttrs
              ? e.attributes.length * 22 + (implCount > 0 ? implCount * 18 + 12 : 0) + 10
              : 0;
            const totalH = EH + attrH;

            return (
              <g
                key={e.id}
                data-eid={e.id}
                onMouseEnter={() => setHov(e.id)}
                onMouseLeave={() => setHov(null)}
                style={{ cursor: "grab" }}
              >
                {isSel && (
                  <rect
                    x={e.x - 5}
                    y={e.y - 5}
                    width={EW + 10}
                    height={totalH + 10}
                    rx={13}
                    fill="none"
                    stroke={m.color}
                    strokeWidth={8}
                    opacity={0.15}
                  />
                )}
                <rect
                  x={e.x}
                  y={e.y}
                  width={EW}
                  height={totalH}
                  rx={9}
                  fill="rgba(18,18,26,0.93)"
                  stroke={isSel ? m.color : isHov ? "rgba(255,255,255,0.2)" : T.border}
                  strokeWidth={isSel ? 1.5 : 0.7}
                />
                <rect x={e.x} y={e.y} width={EW} height={EH} rx={9} fill={m.dim} />
                {attrH > 0 && (
                  <rect x={e.x} y={e.y + EH - 8} width={EW} height={8} fill={m.dim} />
                )}
                <rect x={e.x + EW - 22} y={e.y + 7} width={15} height={15} rx={3} fill={m.color} opacity={0.22} />
                <text
                  x={e.x + EW - 14.5}
                  y={e.y + 19}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={m.color}
                  fontFamily={T.mono}
                >
                  {m.icon}
                </text>
                <text
                  x={e.x + 12}
                  y={e.y + EH / 2 + 5}
                  fontSize={13}
                  fontWeight={500}
                  fill={T.text}
                  fontFamily="DM Sans,sans-serif"
                >
                  {e.name}
                </text>

                {showAttrs &&
                  e.attributes.map((a, i) => (
                    <g key={`${e.id}-a-${i}`}>
                      <line
                        x1={e.x + 6}
                        y1={e.y + EH + i * 22}
                        x2={e.x + EW - 6}
                        y2={e.y + EH + i * 22}
                        stroke={T.border}
                        strokeWidth={0.4}
                      />
                      <text
                        x={e.x + 12}
                        y={e.y + EH + 15 + i * 22}
                        fontSize={10.5}
                        fill={a.pk ? T.amber : a.fk ? T.accent : T.textMid}
                        fontFamily="DM Sans,sans-serif"
                      >
                        {a.pk ? "⬡ " : a.fk ? "◈ " : " "}
                        {a.name}
                      </text>
                      <text
                        x={e.x + EW - 10}
                        y={e.y + EH + 15 + i * 22}
                        textAnchor="end"
                        fontSize={9}
                        fill={T.textDim}
                        fontFamily={T.mono}
                      >
                        {a.type}
                      </text>
                    </g>
                  ))}

                {showAttrs &&
                  implCount > 0 &&
                  (() => {
                    const baseY = e.y + EH + e.attributes.length * 22 + 6;
                    return (
                      <g>
                        <line
                          x1={e.x + 6}
                          y1={baseY}
                          x2={e.x + EW - 6}
                          y2={baseY}
                          stroke={META.Attribute.color}
                          strokeWidth={0.5}
                          strokeDasharray="3,3"
                          opacity={0.5}
                        />
                        {(e.implementations || []).map((im, i) => {
                          const ae = entities.find((x) => x.id === im.attributeEntityId);
                          const off = im.enabled === false;
                          return (
                            <g key={`${e.id}-im-${i}`}>
                              <text
                                x={e.x + 12}
                                y={baseY + 13 + i * 18}
                                fontSize={10}
                                fill={off ? "rgba(251,191,36,0.3)" : META.Attribute.color}
                                fontFamily="DM Sans,sans-serif"
                                fontStyle={off ? "italic" : "normal"}
                              >
                                {off ? "✕ " : "◆ "}
                                {ae?.name || im.attributeEntityId}
                              </text>
                              <text
                                x={e.x + EW - 10}
                                y={baseY + 13 + i * 18}
                                textAnchor="end"
                                fontSize={8.5}
                                fill={T.textDim}
                                fontFamily={T.mono}
                              >
                                impl
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                {isHov && (
                  <circle
                    cx={e.x + EW}
                    cy={e.y + EH / 2}
                    r={6}
                    fill={T.accent}
                    stroke="rgba(13,13,16,0.9)"
                    strokeWidth={1.5}
                    style={{ cursor: "crosshair" }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onPortPointerDown(ev, e.id);
                    }}
                    onPointerEnter={() => setWire((w) => (w ? { ...w, toId: e.id } : w))}
                    onPointerLeave={() => setWire((w) => (w ? { ...w, toId: null } : w))}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
