export type Metaclass = "Entity" | "Relation" | "Attribute" | "ValueSet";

export type AttributeType =
  | "UUID"
  | "String"
  | "Integer"
  | "Decimal"
  | "Boolean"
  | "DateTime"
  | "Enum"
  | "Text";

export type Cardinality = "1 → 1" | "1 → N" | "N → 1" | "M → N";

export interface Attribute {
  name: string;
  type: AttributeType;
  pk?: boolean;
  fk?: boolean;
  unique?: boolean;
}

export interface Implementation {
  attributeEntityId: string;
  enabled?: boolean;
  override?: string | null;
}

export interface Entity {
  id: string;
  name: string;
  metaclass: Metaclass;
  x: number;
  y: number;
  attributes: Attribute[];
  implementations: Implementation[];
  abstract?: boolean;
  isInterface?: boolean;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
  label: string;
  card: Cardinality;
  relationType?: "association" | "generalization" | "realization" | "composition" | "aggregation";
  detectionSource?: "explicit" | "pattern" | "inferred";
}

export interface Field {
  id: string;
  source: string;
  field: string;
  type: string;
  sample: string;
  mapped: string | null;
}

export interface Principle {
  id: string;
  category: string;
  title: string;
  body: string;
  active: boolean;
}

export interface Persona {
  id: string;
  name: string;
  short: string;
  color: string;
  icon: string;
  voice: string;
}

export interface DebateRound {
  persona: Persona;
  text: string;
  type: "initial" | "challenge" | "error";
}

export interface SwarmConsensus {
  text: string;
  raw: string;
}

export interface SwarmSession {
  id: string;
  topic: string;
  rounds: DebateRound[];
  consensus: SwarmConsensus | null;
  savedAt: string;
}

export interface Platform {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  context: string;
}

export interface PlatformRisk {
  issue: string;
  severity: "high" | "medium" | "low";
  detail: string;
  resolution?: string;
}

export interface PlatformAnalysis {
  fit_score: number;
  executive_summary: string;
  analysis: string;
  pros: string[];
  cons: string[];
  risks: PlatformRisk[];
  recommendations: string[];
  migration_notes: string;
}

export interface ValidationResult {
  platformId: string;
  platformName: string;
  result: PlatformAnalysis;
  savedAt: string;
}

export type VersionTrigger = "manual" | "autosave" | "swarm" | "import" | "restore";

export interface ModelVersion {
  id: string;
  savedAt: string;
  label: string;
  trigger: VersionTrigger;
  entityCount: number;
  relationCount: number;
  swarmCount: number;
  validationCount: number;
  entities: Entity[];
  relations: Relation[];
  swarmSessions: SwarmSession[];
  validationResults: ValidationResult[];
  paradigm: string;
  principles: Principle[];
}

export interface ModelRecord {
  id: string;
  name: string;
  savedAt: string;
  entities: Entity[];
  relations: Relation[];
  principles: Principle[];
  paradigm: string;
  swarmSessions: SwarmSession[];
  validationResults: ValidationResult[];
  versions: ModelVersion[];
}

export interface WorkContext {
  company: string;
  department: string;
  project: string;
}

export interface ToolCallResult {
  name: string;
  summary: string;
  status: "done" | "error";
}

export interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  toolCalls?: ToolCallResult[];
}

export interface ContentBlock {
  type: "text";
  text: string;
}

export interface ApiHistoryMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}
