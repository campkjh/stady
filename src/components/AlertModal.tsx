"use client";

interface AlertButton {
  label: string;
  color?: string;
  bgColor?: string;
  onClick: () => void;
}

interface AlertModalProps {
  title: string;
  subtitle?: string;
  buttons: AlertButton[];
  onClose?: () => void;
}

export default function AlertModal({ title, subtitle, buttons, onClose }: AlertModalProps) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <div style={{
        position: "relative",
        width: "calc(100% - 32px)",
        maxWidth: 375,
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 12,
        animation: "slideUpAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: "0 4px 40px rgba(0,0,0,0.15)",
      }}>
        {/* Text */}
        <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2B313D", lineHeight: 1.5, whiteSpace: "pre-line" }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: 15, color: "#8A909C", marginTop: 1 }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {buttons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              onClick={btn.onClick}
              className="press"
              style={{
                width: "100%",
                height: 48,
                borderRadius: 12,
                backgroundColor: btn.bgColor || (idx === 0 ? "#FFC84D" : "#292A2E"),
                color: btn.color || (idx === 0 ? "#3E1918" : "#fff"),
                fontSize: 18,
                fontWeight: 700,
                border: "none",
                textAlign: "center",
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideUpAlert {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
