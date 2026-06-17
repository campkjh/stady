"use client";

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel = "삭제",
  onConfirm,
  onClose,
  loading = false,
}: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(17, 24, 39, 0.45)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 8,
          background: "#fff",
          boxShadow: "0 18px 50px rgba(15,23,42,0.24)",
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0, color: "#111827", fontSize: 18, fontWeight: 800 }}>{title}</h2>
        <p style={{ margin: "10px 0 22px", color: "#6B7280", fontSize: 14, lineHeight: 1.55 }}>{description}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              border: "1px solid #D1D5DB",
              borderRadius: 8,
              background: "#fff",
              color: "#374151",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#DC2626",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
