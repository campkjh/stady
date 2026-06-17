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
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        background: checked ? "#ECFDF5" : "#F3F4F6",
        color: checked ? "#047857" : "#6B7280",
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
          background: checked ? "#10B981" : "#D1D5DB",
          position: "relative",
          transition: "background 0.15s ease",
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
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
