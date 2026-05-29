import type { Entity, Relation } from "../types";

export function executeTool(
  toolName: string,
  input: Record<string, any>,
  entities: Entity[],
  relations: Relation[]
): {
  newEntities: Entity[];
  newRelations: Relation[];
  summary: string;
  newEntityId: string | null;
} {
  let E = [...entities];
  let R = [...relations];
  let summary = "";
  let newEntityId: string | null = null;

  switch (toolName) {
    case "create_entity": {
      const id = `e${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const col = E.length % 5;
      const row = Math.floor(E.length / 5);
      const x = input.x ?? 60 + col * 210;
      const y = input.y ?? 60 + row * 260;
      const metaclass = input.metaclass || "Entity";
      const attrs = (input.attributes || []).map((a: any) =>
        typeof a === "string" ? { name: a, type: "String" } : a
      );
      E = [
        ...E,
        {
          id,
          name: input.name || "New",
          metaclass,
          x,
          y,
          attributes: attrs,
          implementations: [],
        },
      ];
      newEntityId = id;
      summary = `Created ${metaclass} "${input.name}"`;
      break;
    }
    case "delete_entity":
      summary = `Deleted "${E.find((e) => e.id === input.entityId)?.name}"`;
      E = E.filter((e) => e.id !== input.entityId);
      R = R.filter((r) => r.from !== input.entityId && r.to !== input.entityId);
      break;
    case "rename_entity":
      E = E.map((e) => (e.id === input.entityId ? { ...e, name: input.newName } : e));
      summary = `Renamed to "${input.newName}"`;
      break;
    case "set_metaclass":
      E = E.map((e) => (e.id === input.entityId ? { ...e, metaclass: input.metaclass } : e));
      summary = `Set metaclass to ${input.metaclass}`;
      break;
    case "add_attributes": {
      const attrs = (input.attributes || []).map((a: any) =>
        typeof a === "string" ? { name: a, type: "String" } : a
      );
      E = E.map((e) =>
        e.id === input.entityId ? { ...e, attributes: [...e.attributes, ...attrs] } : e
      );
      summary = `Added ${attrs.length} attribute(s)`;
      break;
    }
    case "remove_attribute":
      E = E.map((e) =>
        e.id === input.entityId
          ? { ...e, attributes: e.attributes.filter((a) => a.name !== input.attributeName) }
          : e
      );
      summary = `Removed "${input.attributeName}"`;
      break;
    case "update_attribute":
      E = E.map((e) =>
        e.id === input.entityId
          ? {
              ...e,
              attributes: e.attributes.map((a) =>
                a.name === input.attributeName
                  ? {
                      ...a,
                      name: input.newName ?? a.name,
                      type: input.newType ?? a.type,
                      pk: input.pk ?? a.pk,
                      fk: input.fk ?? a.fk,
                      unique: input.unique ?? a.unique,
                    }
                  : a
              ),
            }
          : e
      );
      summary = `Updated "${input.attributeName}"`;
      break;
    case "implement_attribute":
      E = E.map((e) =>
        e.id === input.hostEntityId
          ? {
              ...e,
              implementations: [
                ...(e.implementations || []),
                {
                  attributeEntityId: input.attributeEntityId,
                  enabled: input.enabled ?? true,
                  override: input.override ?? null,
                },
              ],
            }
          : e
      );
      summary = `Implemented attribute on "${E.find((e) => e.id === input.hostEntityId)?.name}"`;
      break;
    case "toggle_implementation":
      E = E.map((e) =>
        e.id === input.hostEntityId
          ? {
              ...e,
              implementations: (e.implementations || []).map((im) =>
                im.attributeEntityId === input.attributeEntityId
                  ? { ...im, enabled: input.enabled }
                  : im
              ),
            }
          : e
      );
      summary = `${input.enabled ? "Enabled" : "Disabled"} attribute implementation`;
      break;
    case "create_relation": {
      const fromExists = E.some((e) => e.id === input.fromEntityId);
      const toExists = E.some((e) => e.id === input.toEntityId);
      if (!fromExists || !toExists) {
        summary = `⚠ Skipped relation "${input.label}" — unresolved entity ref (from: ${input.fromEntityId}, to: ${input.toEntityId})`;
        break;
      }
      const id = `r${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      R = [
        ...R,
        {
          id,
          from: input.fromEntityId,
          to: input.toEntityId,
          label: input.label || "",
          card: input.cardinality || "1 → N",
        },
      ];
      summary = `Created relation "${input.label}"`;
      break;
    }
    case "delete_relation":
      summary = `Deleted relation "${R.find((r) => r.id === input.relationId)?.label}"`;
      R = R.filter((r) => r.id !== input.relationId);
      break;
    case "update_relation":
      R = R.map((r) =>
        r.id === input.relationId
          ? { ...r, label: input.label ?? r.label, card: input.cardinality ?? r.card }
          : r
      );
      summary = `Updated relation`;
      break;
    default:
      summary = `Unknown: ${toolName}`;
  }

  return { newEntities: E, newRelations: R, summary, newEntityId };
}
