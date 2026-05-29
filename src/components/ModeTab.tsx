import { T } from "../tokens";

interface ModeTabProps {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

export function ModeTab({ label, icon, active, onClick, badge }: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 13px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontSize: 11.5,
        fontWeight: active ? 500 : 400,
        background: active ? "rgba(255,255,255,0.07)" : "transparent",
        color: active ? T.text : T.textMid,
        boxShadow: active ? `inset 0 0 0 1px ${T.border}` : "none",
        transition: "all .15s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = T.text;
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = T.textMid;
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
      {label}
      {badge != null && badge > 0 && (
        <span
          style={{
            background: T.red,
            color: "#fff",
            fontSize: 9,
            width: 14,
            height: 14,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 1,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
