"use client";

interface StatusToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export default function StatusToggle({ checked, onChange, disabled = false, label = "노출" }: StatusToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid var(--c-border)",
        borderRadius: 999,
        background: checked ? "var(--c-success-soft)" : "var(--c-bg-muted)",
        color: checked ? "var(--c-success-c)" : "var(--c-text-3)",
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{
          width: 28,
          height: 16,
          borderRadius: 999,
          background: checked ? "var(--c-success)" : "var(--c-border-strong)",
          position: "relative",
          transition: "background 0.15s ease",
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--c-bg)",
            position: "absolute",
            top: 2,
            left: checked ? 14 : 2,
            transition: "left 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.16)",
          }}
        />
      </span>
      {checked ? label : "비노출"}
    </button>
  );
}
