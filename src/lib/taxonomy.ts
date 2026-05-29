import type { Attribute, Entity, Relation } from "../types";

// ── Pattern sets ──────────────────────────────────────────────────────────────
const GEN_C2P = /^(is\s+a(\s+kind\s+of)?|kind\s+of|subtype(\s+of)?|subclass(\s+of)?|extends|inherits(\s+from)?|is\s+classified\s+as|specializ(es|ation\s+of)?)$/i;
const GEN_P2C = /^(classifies|has\s+subtype|has\s+subclass|is\s+supertype\s+of|is\s+parent\s+of|extended\s+by)$/i;
const REA_C2P = /^(implements|realizes|conforms\s+to|adheres\s+to|fulfils?|satisfies)$/i;
const REA_P2C = /^(implemented\s+by|realized\s+by|conformed\s+to\s+by|fulfilled\s+by)$/i;
const INFER_GEN = /\b(is\s+a|kind\s+of|subtype|subclass|extend[s]?|inherit[s]?|classif|generaliz|specializ)\b/i;
const INFER_REA = /\b(implement[s]?|realize[s]?|conform[s]?|fulfil|satisf)\b/i;

// ── Exported types ────────────────────────────────────────────────────────────
export type HierarchyFamily = "generalization" | "realization";
export type DetectionSource = "explicit" | "pattern" | "inferred";

export interface HierarchyEdge {
  parentId: string;
  childId: string;
  family: HierarchyFamily;
  source: DetectionSource;
  originalRelId: string;
  label: string;
}

export interface InheritedAttr {
  attr: Attribute;
  fromEntityId: string;
  fromEntityName: string;
}

export interface AttributeInheritance {
  own: Attribute[];
  inherited: InheritedAttr[];
  overrides: InheritedAttr[]; // own attr that shadows an ancestor attr of same name
}

export interface ContractAttr {
  attr: Attribute;
  fulfilled: boolean;
  fulfilledBy?: "own" | "inherited";
  fromInheritorName?: string;
}

export interface HierarchyNode {
  entityId: string;
  children: HierarchyNode[];
  edge?: HierarchyEdge; // edge from parent to this node (undefined for roots)
}

export interface HierarchyTree {
  family: HierarchyFamily;
  root: HierarchyNode;
  size: number;
  depth: number;
}

export interface TaxonomyForest {
  classification: HierarchyTree[];
  realization: HierarchyTree[];
  unclassified: Entity[];
  inferred: HierarchyEdge[];
  allEdges: HierarchyEdge[]; // all confirmed (non-inferred) edges
}

// ── resolveHierarchyEdge ──────────────────────────────────────────────────────
export function resolveHierarchyEdge(rel: Relation): HierarchyEdge | null {
  const label = rel.label.trim();

  // Explicit relationType takes priority, but direction still depends on label.
  // "classifies" / "has subtype" etc. mean from=parent → to=child (P2C).
  // "is a kind of" / "extends" etc. mean from=child → to=parent (C2P, the default).
  if (rel.relationType === "generalization") {
    const isP2C = GEN_P2C.test(label);
    return {
      parentId: isP2C ? rel.from : rel.to,
      childId:  isP2C ? rel.to   : rel.from,
      family: "generalization",
      source: "explicit",
      originalRelId: rel.id,
      label,
    };
  }
  if (rel.relationType === "realization") {
    const isP2C = REA_P2C.test(label);
    return {
      parentId: isP2C ? rel.from : rel.to,
      childId:  isP2C ? rel.to   : rel.from,
      family: "realization",
      source: "explicit",
      originalRelId: rel.id,
      label,
    };
  }
  // Non-hierarchy explicit types → no hierarchy edge
  if (
    rel.relationType === "association" ||
    rel.relationType === "composition" ||
    rel.relationType === "aggregation"
  ) {
    return null;
  }

  // Pattern matching
  if (GEN_C2P.test(label)) {
    return { parentId: rel.to, childId: rel.from, family: "generalization", source: "pattern", originalRelId: rel.id, label };
  }
  if (GEN_P2C.test(label)) {
    return { parentId: rel.from, childId: rel.to, family: "generalization", source: "pattern", originalRelId: rel.id, label };
  }
  if (REA_C2P.test(label)) {
    return { parentId: rel.to, childId: rel.from, family: "realization", source: "pattern", originalRelId: rel.id, label };
  }
  if (REA_P2C.test(label)) {
    return { parentId: rel.from, childId: rel.to, family: "realization", source: "pattern", originalRelId: rel.id, label };
  }

  // Inferred (loose match)
  if (INFER_GEN.test(label)) {
    return { parentId: rel.to, childId: rel.from, family: "generalization", source: "inferred", originalRelId: rel.id, label };
  }
  if (INFER_REA.test(label)) {
    return { parentId: rel.to, childId: rel.from, family: "realization", source: "inferred", originalRelId: rel.id, label };
  }

  return null;
}

// ── buildForest ───────────────────────────────────────────────────────────────
export function buildForest(entities: Entity[], relations: Relation[]): TaxonomyForest {
  const entityIds = new Set(entities.map((e) => e.id));

  const allResolved: HierarchyEdge[] = [];
  for (const rel of relations) {
    const edge = resolveHierarchyEdge(rel);
    if (edge) allResolved.push(edge);
  }

  // Split into confirmed and inferred; deduplicate confirmed by (parentId|childId|family),
  // preferring explicit source over pattern so that bidirectional label pairs
  // (e.g. "classifies" + "is a kind of" on the same entity pair) don't create duplicate tree nodes.
  const allConfirmed = allResolved.filter(
    (e) => e.source !== "inferred" && entityIds.has(e.parentId) && entityIds.has(e.childId)
  );
  const edgeMap = new Map<string, HierarchyEdge>();
  for (const e of allConfirmed) {
    const key = `${e.parentId}|${e.childId}|${e.family}`;
    const existing = edgeMap.get(key);
    if (!existing || (e.source === "explicit" && existing.source !== "explicit")) {
      edgeMap.set(key, e);
    }
  }
  const confirmedEdges = [...edgeMap.values()];
  const inferredEdges = allResolved.filter(
    (e) => e.source === "inferred" && entityIds.has(e.parentId) && entityIds.has(e.childId)
  );

  // Build trees for each family
  function buildTree(rootId: string, edges: HierarchyEdge[]): HierarchyNode {
    const children = edges
      .filter((e) => e.parentId === rootId)
      .map((e) => {
        const child = buildTree(e.childId, edges);
        child.edge = e;
        return child;
      });
    return { entityId: rootId, children };
  }

  function treeDepth(node: HierarchyNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(treeDepth));
  }

  function treeSize(node: HierarchyNode): number {
    return 1 + node.children.reduce((sum, c) => sum + treeSize(c), 0);
  }

  function buildTreesForFamily(family: HierarchyFamily): HierarchyTree[] {
    const edges = confirmedEdges.filter((e) => e.family === family);
    const childIds = new Set(edges.map((e) => e.childId));
    const parentIds = new Set(edges.map((e) => e.parentId));
    // Roots: appear as parentId but NOT as childId
    const rootIds = [...parentIds].filter((id) => !childIds.has(id));

    // Also: if any childId's parent is not in edges (orphaned child acting as root) — skip
    // because roots cover that via rootIds already

    return rootIds.map((rootId) => {
      const root = buildTree(rootId, edges);
      return {
        family,
        root,
        size: treeSize(root),
        depth: treeDepth(root),
      };
    });
  }

  const classificationTrees = buildTreesForFamily("generalization");
  const realizationTrees = buildTreesForFamily("realization");

  // Entities appearing in any confirmed edge
  const classifiedIds = new Set<string>();
  for (const e of confirmedEdges) {
    classifiedIds.add(e.parentId);
    classifiedIds.add(e.childId);
  }

  const unclassified = entities.filter((e) => !classifiedIds.has(e.id));

  return {
    classification: classificationTrees,
    realization: realizationTrees,
    unclassified,
    inferred: inferredEdges,
    allEdges: confirmedEdges,
  };
}

// ── computeAttributeInheritance ───────────────────────────────────────────────
export function computeAttributeInheritance(
  entityId: string,
  allEdges: HierarchyEdge[],
  entities: Entity[]
): AttributeInheritance {
  const entity = entities.find((e) => e.id === entityId);
  if (!entity) return { own: [], inherited: [], overrides: [] };

  const own = entity.attributes;
  const ownNames = new Set(own.map((a) => a.name));

  // Walk up the generalization ancestor chain
  const ancestors: Array<{ entityId: string; entity: Entity }> = [];
  const visited = new Set<string>();
  let currentId = entityId;
  visited.add(currentId);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const parentEdge = allEdges.find(
      (e) => e.family === "generalization" && e.childId === currentId
    );
    if (!parentEdge) break;
    if (visited.has(parentEdge.parentId)) break; // cycle guard
    visited.add(parentEdge.parentId);
    const parentEntity = entities.find((e) => e.id === parentEdge.parentId);
    if (!parentEntity) break;
    ancestors.push({ entityId: parentEdge.parentId, entity: parentEntity });
    currentId = parentEdge.parentId;
  }

  // Inherited attrs: deduplicated, nearest ancestor wins
  const inherited: InheritedAttr[] = [];
  const inheritedNames = new Set<string>();

  for (const anc of ancestors) {
    for (const attr of anc.entity.attributes) {
      if (!inheritedNames.has(attr.name) && !ownNames.has(attr.name)) {
        inherited.push({ attr, fromEntityId: anc.entityId, fromEntityName: anc.entity.name });
        inheritedNames.add(attr.name);
      }
    }
  }

  // Overrides: own attrs that shadow an ancestor attr of same name
  const ancestorAttrNames = new Set<string>();
  for (const anc of ancestors) {
    for (const attr of anc.entity.attributes) {
      ancestorAttrNames.add(attr.name);
    }
  }

  const overrides: InheritedAttr[] = [];
  for (const a of own) {
    if (ancestorAttrNames.has(a.name)) {
      // Find the ancestor that has this attr
      for (const anc of ancestors) {
        const ancestorAttr = anc.entity.attributes.find((x) => x.name === a.name);
        if (ancestorAttr) {
          overrides.push({ attr: ancestorAttr, fromEntityId: anc.entityId, fromEntityName: anc.entity.name });
          break;
        }
      }
    }
  }

  return { own, inherited, overrides };
}

// ── checkContractGaps ─────────────────────────────────────────────────────────
export function checkContractGaps(
  implementorId: string,
  interfaceEntityId: string,
  allEdges: HierarchyEdge[],
  entities: Entity[]
): ContractAttr[] {
  const interfaceEntity = entities.find((e) => e.id === interfaceEntityId);
  const implementor = entities.find((e) => e.id === implementorId);
  if (!interfaceEntity || !implementor) return [];

  const ownNames = new Set(implementor.attributes.map((a) => a.name));
  const inheritance = computeAttributeInheritance(implementorId, allEdges, entities);
  const inheritedNames = new Set(inheritance.inherited.map((i) => i.attr.name));

  return interfaceEntity.attributes.map((attr) => {
    if (ownNames.has(attr.name)) {
      return { attr, fulfilled: true, fulfilledBy: "own" as const };
    }
    if (inheritedNames.has(attr.name)) {
      return { attr, fulfilled: true, fulfilledBy: "inherited" as const };
    }
    return { attr, fulfilled: false };
  });
}

// ── getParadigmNote ───────────────────────────────────────────────────────────
export function getParadigmNote(
  paradigm: string,
  family: HierarchyFamily,
  depth: number,
  entityCount: number
): string {
  const p = paradigm.toLowerCase();

  if (family === "generalization") {
    if (p === "relational") {
      return `Table-per-type: ${entityCount} tables. Root table holds shared attributes; subtypes hold own attrs + FK to root.`;
    }
    if (p === "graph" || p === "lpg") {
      return `No structural inheritance in LPG. Use label multi-assignment: (:Subtype:Parent). Own attributes only at write time.`;
    }
    if (p === "owl") {
      return `rdfs:subClassOf chain. Properties are domain-restricted, not structurally inherited — inherited display is conceptual.`;
    }
    if (p === "document") {
      return `Embed inherited fields in leaf documents. Use JSON Schema allOf for strict validation.`;
    }
    if (p === "columnar" || p === "analytical") {
      return `Flatten hierarchy into a single wide table with a discriminator column. Depth ${depth} → avoid over-normalization.`;
    }
    if (p === "event") {
      return `Model subtypes as separate event types sharing a common header schema. ${entityCount} event families.`;
    }
    return `${entityCount} entities in ${depth}-level generalization hierarchy. Apply discriminator or union pattern per platform conventions.`;
  }

  // realization
  if (p === "relational") {
    return `Each implementor table must contain all interface attribute columns. Enforce via CHECK constraints or triggers.`;
  }
  if (p === "graph" || p === "lpg") {
    return `Realization is implicit in LPG. Tag implementor nodes with the interface label and validate attributes at application level.`;
  }
  if (p === "owl") {
    return `Use owl:Class + rdfs:subClassOf or owl:equivalentClass for realization. Reason over completeness with OWL DL.`;
  }
  if (p === "document") {
    return `Embed interface fields in implementor documents. Use JSON Schema $ref to the interface definition for validation.`;
  }
  return `${entityCount} entities realize this interface. Validate all required attributes are present in each implementor.`;
}
