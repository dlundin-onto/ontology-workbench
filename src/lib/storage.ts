import type {
  Entity,
  Relation,
  Principle,
  SwarmSession,
  ValidationResult,
  ModelRecord,
  ModelVersion,
  VersionTrigger,
  WorkContext,
  Persona,
} from "../types";

export const STORAGE_KEY_MODELS = "owb:models";
export const STORAGE_KEY_ACTIVE = "owb:active";
export const STORAGE_KEY_AUTOSAVE = "owb:autosave";
export const STORAGE_KEY_CONTEXT = "owb:context";
export const STORAGE_KEY_PERSONAS = "owb:personas";
export const MAX_VERSIONS = 50;

export async function storageGet(key: string): Promise<any> {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function storageSet(key: string, val: unknown): Promise<boolean> {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}

export function getAutoSave(): boolean {
  return localStorage.getItem(STORAGE_KEY_AUTOSAVE) === "true";
}

export function setAutoSave(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY_AUTOSAVE, enabled ? "true" : "false");
}

export function getWorkContext(): WorkContext {
  try {
    const v = localStorage.getItem(STORAGE_KEY_CONTEXT);
    return v ? JSON.parse(v) : { company: "", department: "", project: "" };
  } catch {
    return { company: "", department: "", project: "" };
  }
}

export function saveWorkContext(ctx: WorkContext): void {
  localStorage.setItem(STORAGE_KEY_CONTEXT, JSON.stringify(ctx));
}

export function getCustomPersonas(): Persona[] | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY_PERSONAS);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function saveCustomPersonas(personas: Persona[]): void {
  localStorage.setItem(STORAGE_KEY_PERSONAS, JSON.stringify(personas));
}

export function clearCustomPersonas(): void {
  localStorage.removeItem(STORAGE_KEY_PERSONAS);
}

export function makeVersion(
  trigger: VersionTrigger,
  label: string,
  entities: Entity[],
  relations: Relation[],
  swarmSessions: SwarmSession[],
  validationResults: ValidationResult[],
  paradigm: string,
  principles: Principle[]
): ModelVersion {
  return {
    id: `v${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    savedAt: new Date().toISOString(),
    label,
    trigger,
    entityCount: entities.length,
    relationCount: relations.length,
    swarmCount: swarmSessions.length,
    validationCount: validationResults.length,
    entities: JSON.parse(JSON.stringify(entities)),
    relations: JSON.parse(JSON.stringify(relations)),
    swarmSessions: JSON.parse(JSON.stringify(swarmSessions)),
    validationResults: JSON.parse(JSON.stringify(validationResults)),
    paradigm,
    principles: JSON.parse(JSON.stringify(principles)),
  };
}

export function makeModelRecord(
  id: string,
  name: string,
  entities: Entity[],
  relations: Relation[],
  principles: Principle[],
  paradigm: string,
  swarmSessions: SwarmSession[],
  validationResults: ValidationResult[],
  versions: ModelVersion[] = []
): ModelRecord {
  return {
    id,
    name,
    savedAt: new Date().toISOString(),
    entities,
    relations,
    principles,
    paradigm,
    swarmSessions: swarmSessions || [],
    validationResults: validationResults || [],
    versions: (versions || []).slice(0, MAX_VERSIONS),
  };
}
