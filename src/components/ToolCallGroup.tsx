import { useState } from "react";
import type { ToolCallResult } from "../types";
import { T } from "../tokens";

interface ToolCallPillProps {
  name: string;
  summary: string;
  status: "done" | "error";
}

export function ToolCallPill({ name, summary, status }: ToolCallPillProps) {
  const col = status === "done" ? T.green : status === "error" ? T.red : T.amber;
  const bg =
    status === "done"
      ? "rgba(52,211,153,0.08)"
      : status === "error"
        ? "rgba(248,113,113,0.08)"
        : "rgba(251,191,36,0.08)";
  const brd =
    status === "done"
      ? "rgba(52,211,153,0.2)"
      : status === "error"
        ? "rgba(248,113,113,0.2)"
        : "rgba(251,191,36,0.2)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 10px",
        borderRadius: 7,
        background: bg,
        border: `1px solid ${brd}`,
        marginTop: 3,
      }}
    >
      <i
        className={`ti ${status === "done" ? "ti-check" : "ti-loader-2"}`}
        style={{ fontSize: 11, color: col, flexShrink: 0 }}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 500, color: col, fontFamily: T.mono }}>
          {name.replace(/_/g, " ")}
        </div>
        {summary && (
          <div style={{ fontSize: 10.5, color: T.textMid, marginTop: 1, lineHeight: 1.4 }}>
            {summary}
          </div>
        )}
      </div>
    </div>
  );
}

interface ToolCallGroupProps {
  toolCalls: ToolCallResult[];
}

export function ToolCallGroup({ toolCalls }: ToolCallGroupProps) {
  const [open, setOpen] = useState(false);
  const count = toolCalls.length;
  const kinds = [...new Set(toolCalls.map((t) => t.name.replace(/_/g, " ")))];
  const summary =
    kinds.length <= 2
      ? kinds.join(", ")
      : `${kinds.slice(0, 2).join(", ")} +${kinds.length - 2} more`;

  return (
    <div
      style={{
        marginTop: 4,
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid rgba(52,211,153,0.2)`,
        background: "rgba(52,211,153,0.05)",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <i className="ti ti-check" style={{ fontSize: 11, color: T.green, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: T.green, flex: 1 }}>
          {count} change{count !== 1 ? "s" : ""}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: T.textDim,
            fontFamily: T.mono,
            flex: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <i
          className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`}
          style={{ fontSize: 10, color: T.textDim, flexShrink: 0 }}
        />
      </button>
      {open && (
        <div
          style={{
            borderTop: `1px solid rgba(52,211,153,0.15)`,
            padding: "6px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {toolCalls.map((tc, i) => (
            <ToolCallPill key={i} {...tc} />
          ))}
        </div>
      )}
    </div>
  );
}
