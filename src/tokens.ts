import type { Metaclass } from "./types";

export const T = {
  bg: "#0d0d10",
  surface: "rgba(255,255,255,0.04)",
  surfaceHover: "rgba(255,255,255,0.07)",
  glass: "rgba(18,18,24,0.82)",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.16)",
  accent: "#4f8ef7",
  accentDim: "rgba(79,142,247,0.15)",
  accentGlow: "rgba(79,142,247,0.35)",
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  purple: "#a78bfa",
  purpleDim: "rgba(167,139,250,0.15)",
  text: "#f0f0f5",
  textMid: "rgba(240,240,245,0.55)",
  textDim: "rgba(240,240,245,0.28)",
  mono: "'JetBrains Mono','Fira Code',monospace",
} as const;

export const META: Record<Metaclass, { color: string; dim: string; label: string; icon: string }> =
  {
    Entity: { color: "#4f8ef7", dim: "rgba(79,142,247,0.18)", label: "Entity", icon: "E" },
    Relation: { color: "#34d399", dim: "rgba(52,211,153,0.18)", label: "Relation", icon: "R" },
    Attribute: { color: "#fbbf24", dim: "rgba(251,191,36,0.18)", label: "Attribute", icon: "A" },
    ValueSet: { color: "#a78bfa", dim: "rgba(167,139,250,0.18)", label: "Value Set", icon: "V" },
  };

export const EW = 160;
export const EH = 42;

export function ec(e: { x: number; y: number }): { x: number; y: number } {
  return { x: e.x + EW / 2, y: e.y + EH / 2 };
}

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
