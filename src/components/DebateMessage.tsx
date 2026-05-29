import type { DebateRound } from "../types";
import { T, hexToRgb } from "../tokens";

interface DebateMessageProps {
  round: DebateRound;
}

export function DebateMessage({ round }: DebateMessageProps) {
  const p = round.persona;
  const isChallenge = round.type === "challenge";
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <div
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 7,
          background: `rgba(${hexToRgb(p.color)},0.2)`,
          border: `1px solid rgba(${hexToRgb(p.color)},0.4)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={p.name}
      >
        <i className={`ti ${p.icon}`} style={{ fontSize: 12, color: p.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: p.color }}>{p.short}</span>
          <span style={{ fontSize: 10, color: T.textDim }}>{p.name}</span>
          {isChallenge && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 6px",
                borderRadius: 20,
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: T.red,
              }}
            >
              rebuttal
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.65,
            color: T.text,
            background: "rgba(255,255,255,0.04)",
            padding: "9px 12px",
            borderRadius: 8,
            borderLeft: `2px solid ${p.color}`,
          }}
        >
          {round.text}
        </div>
      </div>
    </div>
  );
}
