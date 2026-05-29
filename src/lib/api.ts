export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6",       label: "Claude Sonnet 4.6", badge: "Fast · Recommended", color: "#4f8ef7" },
  { id: "claude-opus-4-5",         label: "Claude Opus 4.5",   badge: "Most capable",       color: "#a78bfa" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", badge: "Fastest · Economical", color: "#34d399" },
];

export const DEFAULT_MODEL = "claude-sonnet-4-6";

// Secure runtime config — API key lives only in sessionStorage, never in code
export const CFG = {
  getKey:   () => sessionStorage.getItem("owb:apikey") || "",
  setKey:   (k: string) => sessionStorage.setItem("owb:apikey", k.trim()),
  clearKey: () => sessionStorage.removeItem("owb:apikey"),
  getModel: (role: string) => localStorage.getItem(`owb:model:${role}`) || DEFAULT_MODEL,
  setModel: (role: string, m: string) => localStorage.setItem(`owb:model:${role}`, m),
};

/** Returns true if the user has stored an API key for this session. */
export function hasApiKey(): boolean {
  return !!CFG.getKey();
}

// ── Activity tracker ───────────────────────────────────────────────────────
// Module-level singleton so every component shares the same task list.

export interface ActiveTask {
  id: string;
  role: string;
  label: string;
  startedAt: number;
}

type TaskListener = (tasks: ActiveTask[]) => void;

const _tasks = new Map<string, ActiveTask>();
const _listeners = new Set<TaskListener>();

function _notify() {
  const snapshot = [..._tasks.values()];
  _listeners.forEach((l) => l(snapshot));
}

/** Subscribe to live task updates. Returns an unsubscribe function. */
export function subscribeToActiveTasks(listener: TaskListener): () => void {
  _listeners.add(listener);
  listener([..._tasks.values()]); // immediate emit of current state
  return () => _listeners.delete(listener);
}

/** Read the current active tasks without subscribing. */
export function getActiveTasks(): ActiveTask[] {
  return [..._tasks.values()];
}

// Human-readable fallback labels per role
const ROLE_LABELS: Record<string, string> = {
  assistant: "AI Agent",
  swarm:     "Agent Swarm",
  validator: "Platform Validator",
  main:      "AI Call",
};

// ── Centralized fetch ──────────────────────────────────────────────────────
// Returns the parsed JSON data object directly — do NOT call .json() on the result.
export async function apiFetch(body: object, role = "main", label?: string): Promise<any> {
  const key = CFG.getKey();
  if (!key) throw new Error("NO_API_KEY");
  const model = CFG.getModel(role);

  // Register this task
  const taskId = `t${Date.now()}_${Math.random().toString(36).slice(2, 4)}`;
  _tasks.set(taskId, {
    id: taskId,
    role,
    label: label ?? ROLE_LABELS[role] ?? role,
    startedAt: Date.now(),
  });
  _notify();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": key,
        // Required for direct browser-to-API access
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ ...body, model }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "API error");
    return data;
  } finally {
    _tasks.delete(taskId);
    _notify();
  }
}
