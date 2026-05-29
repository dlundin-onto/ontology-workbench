import type { Principle } from "../types";
import { PARADIGMS } from "./paradigms";

export const DEFAULT_PRINCIPLES: Principle[] = [
  {
    id: "p1",
    category: "Scope & Intent",
    title: "Enterprise-wide, not application-specific",
    body: "This model is a shared enterprise asset used across systems, functions, and teams. Every modeling decision must consider cross-system reuse. Never optimise for a single application's convenience at the cost of universal applicability.",
    active: true,
  },
  {
    id: "p2",
    category: "Scope & Intent",
    title: "Canonical — single source of truth",
    body: "Each concept must exist exactly once. Duplicated entities across domains are a model defect. Reference data, classification structures, and shared attributes belong in the canonical model and are consumed by all downstream systems.",
    active: true,
  },
  {
    id: "p3",
    category: "Structural Quality",
    title: "Normalize for sustainability, not query convenience",
    body: "Model at minimum 3NF. De-normalisation is a downstream, implementation-specific concern. The canonical model should not embed denormalised shortcuts. Query performance is solved at the platform layer, not the model layer.",
    active: true,
  },
  {
    id: "p4",
    category: "Structural Quality",
    title: "Reuse over redundancy — shared attributes and classifications",
    body: "Attributes that apply to multiple entity types must be modelled as Attribute metaclass entities and implemented, not duplicated. Classification hierarchies must be explicit and leveraged for attribute inheritance. Never copy-paste structure.",
    active: true,
  },
  {
    id: "p5",
    category: "Structural Quality",
    title: "Explicit relations — reify anything meaningful",
    body: "If a relationship between two entities has its own properties, lifecycle, or identity, it must be reified as a Relation metaclass entity. Implicit many-to-many joins without reification are a model defect.",
    active: true,
  },
  {
    id: "p6",
    category: "Data Platform & AI",
    title: "Designed for data platforms and AI consumption",
    body: "The model must be machine-readable and semantically rich. Entities need stable identifiers, well-typed attributes, and clear classifications. Vague or ambiguous naming, implicit enumerations, and undocumented structures block AI adoption and data platform automation.",
    active: true,
  },
  {
    id: "p7",
    category: "Data Platform & AI",
    title: "Temporal and provenance-aware",
    body: "Entities that change over time must carry validity periods (validFrom, validTo) or use a temporal pattern. Provenance (createdBy, createdAt, sourceSystem) is not optional. AI and analytics depend on knowing when data was true and where it came from.",
    active: true,
  },
  {
    id: "p8",
    category: "Data Platform & AI",
    title: "Classification-first — hierarchies enable intelligence",
    body: "Classification structures (parent-child relations on Category, Type, RoleType etc.) are a primary modeling concern, not an afterthought. They enable AI-driven categorisation, faceted search, and automatic attribute inheritance across the model.",
    active: true,
  },
  {
    id: "p9",
    category: "Governance",
    title: "Semantic precision — name what it is, not how it is used",
    body: "Entity and attribute names must reflect the real-world concept, not the current application's perspective. 'Customer' may be a role of a Party. 'Status' must always be a ValueSet. Naming must survive system replacement.",
    active: true,
  },
  {
    id: "p10",
    category: "Governance",
    title: "Privacy and security by design",
    body: "PII fields must be identified and flagged at the model level. Sensitive attributes must carry classification. Access control patterns must be expressible in the model. GDPR, retention, and consent are modelling concerns, not only implementation concerns.",
    active: true,
  },
];

export const DEFAULT_SYSTEM = `You are a data modeling agent in a live ontology workbench. Output JSON action blocks to change the canvas — the workbench executes them automatically.

METACLASS SYSTEM — every entity has one of four metaclasses:
- Entity: a real-world thing (Customer, Product, Person)
- Relation: a reified relationship between entities (OrderLine, RoleAssignment, Employment)
- Attribute: a shared, implementable property (e.g. "Description", "ValidityPeriod") — can be implemented on multiple entities
- ValueSet: reference data / enumeration (Status, Country, RoleType)

ATTRIBUTE IMPLEMENTATION:
- An Attribute metaclass entity defines the structure of a shared property (its own attributes like "value", "language", "validFrom")
- Other entities implement it via implement_attribute, linking the Attribute entity as a structured property
- Implementations can be enabled/disabled individually; disabling propagates down classification hierarchies
- Use this for shared, reusable attributes rather than duplicating fields

OUTPUT FORMAT — always a JSON code block first, then one sentence of rationale:

\`\`\`json
[
  {"name": "create_entity", "entityName": "Customer", "metaclass": "Entity", "attributes": [
    {"name": "customerId", "type": "UUID", "pk": true},
    {"name": "name", "type": "String"}
  ]},
  {"name": "create_entity", "entityName": "Order", "metaclass": "Entity", "attributes": [
    {"name": "orderId", "type": "UUID", "pk": true}
  ]},
  {"name": "create_relation", "fromEntityId": "Customer", "toEntityId": "Order", "label": "places", "cardinality": "1 → N"},
  {"name": "create_entity", "entityName": "Description", "metaclass": "Attribute", "attributes": [
    {"name": "value", "type": "Text"},
    {"name": "language", "type": "String"}
  ]},
  {"name": "implement_attribute", "hostEntityId": "Customer", "attributeEntityId": "Description"}
]
\`\`\`

AVAILABLE ACTIONS:
- create_entity: entityName, metaclass ("Entity"|"Relation"|"Attribute"|"ValueSet"), attributes[{name,type,pk?,fk?,unique?}], x?, y?
- delete_entity: entityId
- rename_entity: entityId, newName
- set_metaclass: entityId, metaclass
- add_attributes: entityId, attributes[]
- remove_attribute: entityId, attributeName
- update_attribute: entityId, attributeName, newName?, newType?, pk?, fk?, unique?
- implement_attribute: hostEntityId, attributeEntityId, enabled? (default true)
- toggle_implementation: hostEntityId, attributeEntityId, enabled
- create_relation: fromEntityId, toEntityId, label, cardinality ("1 → 1"|"1 → N"|"N → 1"|"M → N")
- delete_relation: relationId
- update_relation: relationId, label?, cardinality?

TYPES: UUID, String, Integer, Decimal, Boolean, DateTime, Enum, Text
ENTITY REFS: For existing entities use their real IDs from the model context. For entities created in THIS SAME block, use their "entityName" string directly as fromEntityId/toEntityId/entityId/hostEntityId/attributeEntityId — NEVER invent placeholder IDs like "e1" or "e2" for new entities; the workbench resolves names to IDs automatically.
CRITICAL: "name" field = action type always. Entity name goes in "entityName".

RULES: 3NF minimum. Junction entities for M:N. Use Attribute metaclass for shared properties. Use ValueSet for enumerations. Act, don't describe.

FK NAMING (Metagraph paradigm): When creating a Relation entity, name its FK attributes after the referenced entity's PK using the '{entityName}Id' convention. Customer PK=customerId → FK='customerId'. Category PK=id → FK='categoryId'. NEVER use 'sourceRef' or 'targetRef'.`;

export const SKILLS_META_SYSTEM = `You are an expert at writing AI system prompts for specialized domain assistants. Help the user improve their data modeling assistant's system prompt. The assistant outputs JSON action blocks (not API tool-use) parsed client-side. Preserve this mechanism. Output the FULL updated prompt in <SYSTEM>...</SYSTEM> when you have a concrete change.`;

export function contextBlock(ctx: { company: string; department: string; project: string }): string {
  const parts: string[] = [];
  if (ctx.company?.trim()) parts.push(`Company: ${ctx.company.trim()}`);
  if (ctx.department?.trim()) parts.push(`Department: ${ctx.department.trim()}`);
  if (ctx.project?.trim()) parts.push(`Project/Process: ${ctx.project.trim()}`);
  if (!parts.length) return "";
  return "\n\nWORK CONTEXT (tailor all responses and model decisions to this context):\n" + parts.join("\n");
}

export function principlesContext(principles: Principle[], paradigmId: string): string {
  const active = principles.filter((p) => p.active);
  const paradigm = PARADIGMS[paradigmId] || PARADIGMS.owl;
  const paradigmCtx = `\n\nMODELING PARADIGM: ${paradigm.label}\n${paradigm.description}\nRelation model: ${paradigm.relationModel}\nKey hints: ${paradigm.hints.join("; ")}`;
  if (!active.length) return paradigmCtx;
  return (
    paradigmCtx +
    "\n\nENTERPRISE MODELING PRINCIPLES (non-negotiable — apply to every decision):\n" +
    active.map((p) => `[${p.category}] ${p.title}: ${p.body}`).join("\n")
  );
}
