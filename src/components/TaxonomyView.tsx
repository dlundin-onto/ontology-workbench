import { useState, useMemo } from "react";
import type { Entity, Relation } from "../types";
import { T } from "../tokens";
import {
  buildForest,
  computeAttributeInheritance,
  checkContractGaps,
  getParadigmNote,
  type HierarchyNode,
  type HierarchyTree,
  type AttributeInheritance,
  type ContractAttr,
} from "../lib/taxonomy";
import { downloadReportHtml } from "../lib/report";

interface TaxonomyViewProps {
  entities: Entity[];
  relations: Relation[];
  paradigm: string;
  onConfirmInferred: (
    updates: Array<{ relId: string; relationType: "generalization" | "realization" }>
  ) => void;
  onOpenEntity: (id: string) => void;
  onClose: () => void;
}

function collectIds(node: HierarchyNode): string[] {
  return [node.entityId, ...node.children.flatMap(collectIds)];
}

// ── Attribute row ─────────────────────────────────────────────────────────────
function AttrRow({
  symbol,
  name,
  type,
  suffix,
  color,
  suffixColor,
  badges,
}: {
  symbol: string;
  name: string;
  type: string;
  suffix?: string;
  color?: string;
  suffixColor?: string;
  badges?: string[];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px 2px 4px",
        fontSize: 11,
      }}
    >
      <span style={{ color: color ?? T.textDim, width: 14, flexShrink: 0, textAlign: "center" }}>
        {symbol}
      </span>
      <span style={{ color: color ?? T.text, flex: 1, fontWeight: 450 }}>{name}</span>
      <span style={{ color: T.textDim, fontFamily: "JetBrains Mono,monospace", fontSize: 9.5 }}>
        {type}
      </span>
      {badges &&
        badges.map((b, i) => (
          <span
            key={i}
            style={{
              fontSize: 8.5,
              padding: "1px 4px",
              borderRadius: 3,
              background: "rgba(251,191,36,0.12)",
              color: T.amber,
              fontWeight: 600,
            }}
          >
            {b}
          </span>
        ))}
      {suffix && (
        <span style={{ fontSize: 9.5, color: suffixColor ?? T.textDim, whiteSpace: "nowrap" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 0 3px",
        borderBottom: `1px solid ${T.border}`,
        marginBottom: 4,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: T.textDim,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 9,
          padding: "1px 5px",
          borderRadius: 3,
          background: "rgba(255,255,255,0.07)",
          color: T.textMid,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        padding: "1px 6px",
        borderRadius: 4,
        background: bg,
        color,
        fontWeight: 600,
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
}

// ── EntityCard ────────────────────────────────────────────────────────────────
interface EntityCardProps {
  node: HierarchyNode;
  entityMap: Map<string, Entity>;
  inheritanceMap: Map<string, AttributeInheritance>;
  contractMap: Map<string, ContractAttr[]>;
  isRoot: boolean;
  isRealization: boolean;
  showInherited: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onOpenEntity: (id: string) => void;
  depth: number;
}

function EntityCard({
  node,
  entityMap,
  inheritanceMap,
  contractMap,
  isRoot,
  isRealization,
  showInherited,
  collapsed,
  onToggle,
  onOpenEntity,
  depth,
}: EntityCardProps) {
  const entity = entityMap.get(node.entityId);
  if (!entity) return null;

  const isCollapsed = collapsed.has(node.entityId);
  const hasChildren = node.children.length > 0;
  const inheritance = inheritanceMap.get(node.entityId);
  const contracts = contractMap.get(node.entityId);

  // Contract summary for realization non-root nodes
  const gapCount = contracts ? contracts.filter((c) => !c.fulfilled).length : 0;
  const isComplete = contracts ? gapCount === 0 : true;

  // Interface root display
  const interfaceName =
    node.edge ? entityMap.get(node.edge.parentId)?.name ?? "" : "";

  const cardBg = depth % 2 === 0 ? "rgba(255,255,255,0.022)" : "rgba(255,255,255,0.014)";

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Entity header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderRadius: 8,
          background: cardBg,
          border: `1px solid ${T.border}`,
          cursor: hasChildren ? "pointer" : "default",
        }}
        onClick={() => hasChildren && onToggle(node.entityId)}
      >
        {/* Collapse toggle */}
        <span
          style={{
            fontSize: 9,
            color: hasChildren ? T.textMid : "transparent",
            width: 10,
            flexShrink: 0,
          }}
        >
          {hasChildren ? (isCollapsed ? "▶" : "▼") : "·"}
        </span>

        {/* Metaclass icon */}
        <span
          style={{
            fontSize: 9,
            padding: "1px 4px",
            borderRadius: 3,
            background: isRealization && isRoot
              ? "rgba(167,139,250,0.15)"
              : "rgba(79,142,247,0.12)",
            color: isRealization && isRoot ? T.purple : T.accent,
            fontWeight: 700,
            fontFamily: "JetBrains Mono,monospace",
            flexShrink: 0,
          }}
        >
          {entity.metaclass.charAt(0)}
        </span>

        {/* Name */}
        <span style={{ fontSize: 12.5, fontWeight: 500, color: T.text, flex: 1 }}>
          {entity.name}
        </span>

        {/* Badges */}
        {entity.abstract && <Badge label="Abstract" color={T.textMid} bg="rgba(255,255,255,0.06)" />}
        {(entity.isInterface || (isRealization && isRoot)) && (
          <Badge label="Interface" color={T.purple} bg="rgba(167,139,250,0.12)" />
        )}

        {/* Contract status for realization implementors */}
        {isRealization && !isRoot && contracts && (
          <span
            style={{
              fontSize: 10,
              color: isComplete ? T.green : T.red,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {isComplete ? (
              <>
                <i className="ti ti-check" style={{ fontSize: 10 }} /> complete
              </>
            ) : (
              <>
                <i className="ti ti-alert-triangle" style={{ fontSize: 10 }} /> {gapCount} gap
                {gapCount !== 1 ? "s" : ""}
              </>
            )}
          </span>
        )}

        {/* Open button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenEntity(node.entityId);
          }}
          style={{
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 4,
            background: "none",
            border: `1px solid ${T.border}`,
            color: T.textDim,
            cursor: "pointer",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = T.accent;
            e.currentTarget.style.borderColor = T.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = T.textDim;
            e.currentTarget.style.borderColor = T.border;
          }}
        >
          ↗
        </button>
      </div>

      {/* Expanded content */}
      {!isCollapsed && (
        <div style={{ paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
          {/* Classification: own + inherited + overrides */}
          {!isRealization && inheritance && (
            <div style={{ marginBottom: 4 }}>
              {inheritance.own.length > 0 && (
                <>
                  <SectionLabel label="Own" count={inheritance.own.length} />
                  {inheritance.own.map((a, i) => (
                    <AttrRow
                      key={i}
                      symbol="●"
                      name={a.name}
                      type={a.type}
                      color={T.accent}
                      badges={[...(a.pk ? ["PK"] : []), ...(a.unique ? ["UQ"] : [])]}
                    />
                  ))}
                </>
              )}

              {showInherited && inheritance.inherited.length > 0 && (
                <>
                  <SectionLabel label="Inherited" count={inheritance.inherited.length} />
                  {inheritance.inherited.map((ia, i) => (
                    <AttrRow
                      key={i}
                      symbol="○"
                      name={ia.attr.name}
                      type={ia.attr.type}
                      color={T.textMid}
                      suffix={`↑ ${ia.fromEntityName}`}
                      suffixColor={T.textDim}
                    />
                  ))}
                </>
              )}

              {!showInherited && inheritance.inherited.length > 0 && (
                <div style={{ fontSize: 10, color: T.textDim, padding: "3px 4px" }}>
                  ○ ··· +{inheritance.inherited.length} inherited (hidden)
                </div>
              )}

              {inheritance.overrides.length > 0 && (
                <>
                  <SectionLabel label="Overrides" count={inheritance.overrides.length} />
                  {inheritance.overrides.map((ia, i) => (
                    <AttrRow
                      key={i}
                      symbol="▲"
                      name={ia.attr.name}
                      type={ia.attr.type}
                      color={T.amber}
                      suffix={`↑ overrides ${ia.fromEntityName}`}
                      suffixColor={T.amber}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Realization root: contract definition */}
          {isRealization && isRoot && (
            <div style={{ marginBottom: 4 }}>
              <SectionLabel
                label={`Contract Definition`}
                count={entity.attributes.length}
              />
              {entity.attributes.map((a, i) => (
                <AttrRow
                  key={i}
                  symbol="◎"
                  name={a.name}
                  type={a.type}
                  color={T.purple}
                  suffix="required"
                  suffixColor={T.textDim}
                />
              ))}
            </div>
          )}

          {/* Realization implementor: contract fulfillment */}
          {isRealization && !isRoot && contracts && contracts.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <SectionLabel
                label={`Contract (from ${interfaceName})`}
                count={contracts.length}
              />
              {contracts.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 8px 2px 4px",
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{ color: T.purple, width: 14, flexShrink: 0, textAlign: "center" }}
                  >
                    ◎
                  </span>
                  <span style={{ color: c.fulfilled ? T.text : T.red, flex: 1, fontWeight: c.fulfilled ? 450 : 600 }}>
                    {c.attr.name}
                  </span>
                  <span style={{ color: T.textDim, fontFamily: "JetBrains Mono,monospace", fontSize: 9.5 }}>
                    {c.attr.type}
                  </span>
                  {c.fulfilled && c.fulfilledBy === "own" && (
                    <span style={{ fontSize: 9.5, color: T.green }}>
                      <i className="ti ti-check" style={{ fontSize: 9 }} /> own attr
                    </span>
                  )}
                  {c.fulfilled && c.fulfilledBy === "inherited" && (
                    <span style={{ fontSize: 9.5, color: T.green, opacity: 0.75 }}>
                      <i className="ti ti-check" style={{ fontSize: 9 }} /> ↑ inherited
                    </span>
                  )}
                  {!c.fulfilled && (
                    <span style={{ fontSize: 9.5, color: T.red, fontWeight: 700 }}>
                      ✗ MISSING
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Children (recursive) */}
      {!isCollapsed && node.children.length > 0 && (
        <div
          style={{
            marginLeft: 20,
            paddingLeft: 8,
            borderLeft: isRealization
              ? `1px dashed rgba(167,139,250,0.2)`
              : `1px solid rgba(167,139,250,0.2)`,
            marginTop: 4,
          }}
        >
          {node.children.map((child) => (
            <EntityCard
              key={child.entityId}
              node={child}
              entityMap={entityMap}
              inheritanceMap={inheritanceMap}
              contractMap={contractMap}
              isRoot={false}
              isRealization={isRealization}
              showInherited={showInherited}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpenEntity={onOpenEntity}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── HierarchyBlock ────────────────────────────────────────────────────────────
interface HierarchyBlockProps {
  tree: HierarchyTree;
  entityMap: Map<string, Entity>;
  inheritanceMap: Map<string, AttributeInheritance>;
  contractMap: Map<string, ContractAttr[]>;
  showInherited: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onOpenEntity: (id: string) => void;
  paradigm: string;
}

function HierarchyBlock({
  tree,
  entityMap,
  inheritanceMap,
  contractMap,
  showInherited,
  collapsed,
  onToggle,
  onOpenEntity,
  paradigm,
}: HierarchyBlockProps) {
  const isRealization = tree.family === "realization";
  const rootEntity = entityMap.get(tree.root.entityId);
  const familyColor = isRealization ? T.purple : T.accent;
  const familyBg = isRealization ? "rgba(167,139,250,0.08)" : "rgba(79,142,247,0.07)";
  const paradigmNote = getParadigmNote(paradigm, tree.family, tree.depth, tree.size);

  // Count gaps across whole tree
  const totalGaps = isRealization
    ? [...contractMap.entries()]
        .filter(([id]) => {
          function inTree(node: HierarchyNode): boolean {
            return node.entityId === id || node.children.some(inTree);
          }
          return inTree(tree.root);
        })
        .reduce((sum, [, contracts]) => sum + contracts.filter((c) => !c.fulfilled).length, 0)
    : 0;

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${isRealization ? "rgba(167,139,250,0.15)" : "rgba(79,142,247,0.15)"}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ background: familyBg, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: familyColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: familyColor,
            }}
          >
            {isRealization ? "Realization" : "Classification"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            {rootEntity?.name ?? tree.root.entityId}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: T.textMid }}>
            {tree.size} {tree.size === 1 ? "entity" : "entities"} · {tree.depth}{" "}
            {tree.depth === 1 ? "level" : "levels"}
          </span>
          {isRealization && totalGaps > 0 && (
            <Badge
              label={`${totalGaps} gap${totalGaps !== 1 ? "s" : ""}`}
              color={T.red}
              bg="rgba(248,113,113,0.12)"
            />
          )}
        </div>
        <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.5 }}>{paradigmNote}</div>
      </div>

      {/* Tree */}
      <div style={{ padding: "10px 12px" }}>
        <EntityCard
          node={tree.root}
          entityMap={entityMap}
          inheritanceMap={inheritanceMap}
          contractMap={contractMap}
          isRoot={true}
          isRealization={isRealization}
          showInherited={showInherited}
          collapsed={collapsed}
          onToggle={onToggle}
          onOpenEntity={onOpenEntity}
          depth={0}
        />
      </div>
    </div>
  );
}

// ── Main TaxonomyView ─────────────────────────────────────────────────────────
export function TaxonomyView({
  entities,
  relations,
  paradigm,
  onConfirmInferred,
  onOpenEntity,
  onClose,
}: TaxonomyViewProps) {
  const [showInherited, setShowInherited] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dismissedInferred, setDismissedInferred] = useState<Set<string>>(new Set());

  const entityMap = useMemo(
    () => new Map(entities.map((e) => [e.id, e])),
    [entities]
  );

  const forest = useMemo(() => buildForest(entities, relations), [entities, relations]);

  const inheritanceMap = useMemo(() => {
    const map = new Map<string, AttributeInheritance>();
    function walk(node: HierarchyNode) {
      map.set(
        node.entityId,
        computeAttributeInheritance(node.entityId, forest.allEdges, entities)
      );
      node.children.forEach(walk);
    }
    forest.classification.forEach((t) => walk(t.root));
    return map;
  }, [forest, entities]);

  const contractMap = useMemo(() => {
    const map = new Map<string, ContractAttr[]>();
    function walk(node: HierarchyNode) {
      if (node.edge) {
        map.set(
          node.entityId,
          checkContractGaps(node.entityId, node.edge.parentId, forest.allEdges, entities)
        );
      }
      node.children.forEach(walk);
    }
    forest.realization.forEach((t) => walk(t.root));
    return map;
  }, [forest, entities]);

  const totalTrees = forest.classification.length + forest.realization.length;
  const totalClassified =
    forest.classification.reduce((s, t) => s + t.size, 0) +
    forest.realization.reduce((s, t) => s + t.size, 0);

  function toggleNode(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function collapseAll() {
    const allIds = [
      ...forest.classification.flatMap((t) => collectIds(t.root)),
      ...forest.realization.flatMap((t) => collectIds(t.root)),
    ];
    setCollapsed(new Set(allIds));
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  const visibleInferred = forest.inferred.filter((e) => !dismissedInferred.has(e.originalRelId));

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    const lines: string[] = [];
    function renderTree(node: HierarchyNode, indent = 0) {
      const entity = entityMap.get(node.entityId);
      const prefix = "  ".repeat(indent);
      lines.push(`${prefix}${entity?.name ?? node.entityId}`);
      const attrs = entity?.attributes ?? [];
      if (attrs.length) {
        attrs.forEach((a) => {
          lines.push(`${prefix}  ${a.pk ? "[PK] " : ""}${a.name}: ${a.type}`);
        });
      }
      node.children.forEach((c) => renderTree(c, indent + 1));
    }

    if (forest.classification.length > 0) {
      lines.push("== CLASSIFICATION HIERARCHIES ==");
      forest.classification.forEach((tree) => {
        lines.push("");
        renderTree(tree.root);
      });
    }
    if (forest.realization.length > 0) {
      lines.push("");
      lines.push("== REALIZATION HIERARCHIES ==");
      forest.realization.forEach((tree) => {
        lines.push("");
        renderTree(tree.root);
      });
    }
    if (forest.unclassified.length > 0) {
      lines.push("");
      lines.push("== UNCLASSIFIED ==");
      forest.unclassified.forEach((e) => lines.push(`  ${e.name}`));
    }

    downloadReportHtml("Taxonomy", lines.join("\n"));
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "DM Sans,sans-serif",
        color: T.text,
      }}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          flexShrink: 0,
          borderBottom: `1px solid ${T.border}`,
          background: "rgba(13,13,16,0.95)",
        }}
      >
        <span style={{ fontSize: 15 }}>🌿</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Taxonomy Explorer</span>
        <span style={{ fontSize: 10.5, color: T.textDim }}>
          {totalTrees} {totalTrees === 1 ? "hierarchy" : "hierarchies"} · {totalClassified} classified ·{" "}
          {forest.unclassified.length} unclassified
        </span>

        {/* Attr legend */}
        <div
          style={{
            marginLeft: 8,
            display: "flex",
            gap: 10,
            padding: "3px 10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${T.border}`,
          }}
        >
          {[
            { sym: "●", label: "own", color: T.accent },
            { sym: "○", label: "inherited", color: T.textMid },
            { sym: "▲", label: "overrides", color: T.amber },
            { sym: "◎", label: "contract", color: T.purple },
          ].map(({ sym, label, color }) => (
            <span key={label} style={{ fontSize: 10, color, display: "flex", gap: 3, alignItems: "center" }}>
              {sym} <span style={{ color: T.textDim }}>{label}</span>
            </span>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Show inherited toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 10.5, color: T.textDim }}>Show inherited</span>
          <div
            onClick={() => setShowInherited((p) => !p)}
            style={{
              width: 34,
              height: 18,
              borderRadius: 9,
              background: showInherited ? T.accent : "rgba(255,255,255,0.1)",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.15s",
              border: `1px solid ${showInherited ? T.accent : T.border}`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: showInherited ? 16 : 2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
              }}
            />
          </div>
        </div>

        {/* Collapse / Expand */}
        <button
          onClick={collapsed.size > 0 ? expandAll : collapseAll}
          style={{
            fontSize: 10.5,
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${T.border}`,
            color: T.textMid,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.textMid)}
        >
          {collapsed.size > 0 ? "Expand all" : "Collapse all"}
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          style={{
            fontSize: 10.5,
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(79,142,247,0.07)",
            border: `1px solid rgba(79,142,247,0.2)`,
            color: T.accent,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.16)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.07)")}
        >
          <i className="ti ti-download" style={{ fontSize: 11 }} /> Export
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            color: T.textMid,
            cursor: "pointer",
            fontSize: 16,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = T.red;
            e.currentTarget.style.borderColor = T.red;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = T.textMid;
            e.currentTarget.style.borderColor = T.border;
          }}
        >
          ×
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* ── Left sidebar ── */}
        <div
          style={{
            width: 240,
            borderRight: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "rgba(255,255,255,0.01)",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
            {/* Classification section */}
            {forest.classification.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: T.accent,
                    marginBottom: 5,
                  }}
                >
                  Classification
                </div>
                {forest.classification.map((tree) => {
                  const root = entityMap.get(tree.root.entityId);
                  return (
                    <div
                      key={tree.root.entityId}
                      style={{
                        padding: "6px 9px",
                        borderRadius: 7,
                        marginBottom: 3,
                        background: "rgba(79,142,247,0.06)",
                        border: `1px solid rgba(79,142,247,0.12)`,
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text }}>
                        {root?.name ?? tree.root.entityId}
                      </div>
                      <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 1 }}>
                        {tree.size} entities · depth {tree.depth}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Realization section */}
            {forest.realization.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: T.purple,
                    marginBottom: 5,
                  }}
                >
                  Realization
                </div>
                {forest.realization.map((tree) => {
                  const root = entityMap.get(tree.root.entityId);
                  const treeGaps = [...contractMap.entries()]
                    .filter(([id]) => {
                      function inTree(node: HierarchyNode): boolean {
                        return node.entityId === id || node.children.some(inTree);
                      }
                      return inTree(tree.root);
                    })
                    .reduce((sum, [, c]) => sum + c.filter((x) => !x.fulfilled).length, 0);
                  return (
                    <div
                      key={tree.root.entityId}
                      style={{
                        padding: "6px 9px",
                        borderRadius: 7,
                        marginBottom: 3,
                        background: "rgba(167,139,250,0.06)",
                        border: `1px solid rgba(167,139,250,0.12)`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: T.text,
                        }}
                      >
                        {root?.name ?? tree.root.entityId}
                        {treeGaps > 0 && (
                          <Badge
                            label={`${treeGaps}⚠`}
                            color={T.red}
                            bg="rgba(248,113,113,0.12)"
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 1 }}>
                        {tree.size - 1} implementors · depth {tree.depth}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inferred section */}
            {visibleInferred.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: T.amber,
                    marginBottom: 5,
                  }}
                >
                  ~ Inferred
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: T.textDim,
                    marginBottom: 6,
                    lineHeight: 1.5,
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "rgba(251,191,36,0.06)",
                    border: `1px solid rgba(251,191,36,0.12)`,
                  }}
                >
                  {visibleInferred.length} relation
                  {visibleInferred.length !== 1 ? "s" : ""} may be hierarchy. Confirm to include in
                  the taxonomy.
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  <button
                    onClick={() =>
                      onConfirmInferred(
                        visibleInferred.map((e) => ({
                          relId: e.originalRelId,
                          relationType: e.family,
                        }))
                      )
                    }
                    style={{
                      flex: 1,
                      fontSize: 9.5,
                      padding: "4px 0",
                      borderRadius: 5,
                      background: "rgba(52,211,153,0.08)",
                      border: `1px solid rgba(52,211,153,0.2)`,
                      color: T.green,
                      cursor: "pointer",
                    }}
                  >
                    Confirm all
                  </button>
                  <button
                    onClick={() =>
                      setDismissedInferred(
                        new Set([...dismissedInferred, ...visibleInferred.map((e) => e.originalRelId)])
                      )
                    }
                    style={{
                      flex: 1,
                      fontSize: 9.5,
                      padding: "4px 0",
                      borderRadius: 5,
                      background: "rgba(248,113,113,0.06)",
                      border: `1px solid rgba(248,113,113,0.18)`,
                      color: T.red,
                      cursor: "pointer",
                    }}
                  >
                    Dismiss all
                  </button>
                </div>
                {visibleInferred.map((edge) => {
                  const fromEntity = entityMap.get(edge.childId);
                  const toEntity = entityMap.get(edge.parentId);
                  return (
                    <div
                      key={edge.originalRelId}
                      style={{
                        marginBottom: 6,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(251,191,36,0.04)",
                        border: `1px solid rgba(251,191,36,0.1)`,
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: T.text, marginBottom: 2 }}>
                        ~ {fromEntity?.name ?? edge.childId}{" "}
                        <span style={{ color: T.textDim }}>→</span>{" "}
                        {toEntity?.name ?? edge.parentId}
                      </div>
                      <div style={{ fontSize: 9.5, color: T.textDim, marginBottom: 5 }}>
                        "{edge.label}" (inferred {edge.family})
                      </div>
                      <div style={{ display: "flex", gap: 3 }}>
                        <button
                          onClick={() =>
                            onConfirmInferred([
                              { relId: edge.originalRelId, relationType: "generalization" },
                            ])
                          }
                          style={{
                            flex: 1,
                            fontSize: 9,
                            padding: "3px 0",
                            borderRadius: 4,
                            background: "rgba(79,142,247,0.1)",
                            border: `1px solid rgba(79,142,247,0.2)`,
                            color: T.accent,
                            cursor: "pointer",
                          }}
                        >
                          Gen
                        </button>
                        <button
                          onClick={() =>
                            onConfirmInferred([
                              { relId: edge.originalRelId, relationType: "realization" },
                            ])
                          }
                          style={{
                            flex: 1,
                            fontSize: 9,
                            padding: "3px 0",
                            borderRadius: 4,
                            background: "rgba(167,139,250,0.1)",
                            border: `1px solid rgba(167,139,250,0.2)`,
                            color: T.purple,
                            cursor: "pointer",
                          }}
                        >
                          Real
                        </button>
                        <button
                          onClick={() =>
                            setDismissedInferred(new Set([...dismissedInferred, edge.originalRelId]))
                          }
                          style={{
                            flex: 1,
                            fontSize: 9,
                            padding: "3px 0",
                            borderRadius: 4,
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${T.border}`,
                            color: T.textDim,
                            cursor: "pointer",
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unclassified section */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: T.textDim,
                  marginBottom: 5,
                }}
              >
                Unclassified ({forest.unclassified.length})
              </div>
              {forest.unclassified.length === 0 ? (
                <div style={{ fontSize: 10, color: T.green }}>All entities classified.</div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textDim,
                      lineHeight: 1.5,
                      marginBottom: 4,
                    }}
                  >
                    {forest.unclassified.slice(0, 8).map((e) => e.name).join(", ")}
                    {forest.unclassified.length > 8 && ` +${forest.unclassified.length - 8} more`}
                  </div>
                  <div style={{ fontSize: 9.5, color: T.textDim }}>
                    Add generalization or realization relations to classify these entities.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
            minHeight: 0,
          }}
        >
          {totalTrees === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 12,
                color: T.textDim,
              }}
            >
              <i className="ti ti-sitemap" style={{ fontSize: 40 }} />
              <div style={{ fontSize: 13, fontWeight: 500 }}>No hierarchies detected</div>
              <div style={{ fontSize: 11, maxWidth: 380, textAlign: "center", lineHeight: 1.6 }}>
                Add relations with labels like "extends", "implements", "is a kind of", or set the
                Relation Type to Generalization / Realization in the Inspector.
              </div>
            </div>
          )}

          {forest.classification.map((tree) => (
            <HierarchyBlock
              key={tree.root.entityId}
              tree={tree}
              entityMap={entityMap}
              inheritanceMap={inheritanceMap}
              contractMap={contractMap}
              showInherited={showInherited}
              collapsed={collapsed}
              onToggle={toggleNode}
              onOpenEntity={(id) => onOpenEntity(id)}
              paradigm={paradigm}
            />
          ))}

          {forest.realization.map((tree) => (
            <HierarchyBlock
              key={tree.root.entityId}
              tree={tree}
              entityMap={entityMap}
              inheritanceMap={inheritanceMap}
              contractMap={contractMap}
              showInherited={showInherited}
              collapsed={collapsed}
              onToggle={toggleNode}
              onOpenEntity={(id) => onOpenEntity(id)}
              paradigm={paradigm}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
