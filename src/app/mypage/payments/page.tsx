"use client";

import { useEffect, useState } from "react";
import LoginRequired from "@/components/LoginRequired";
import BackHeader from "@/components/BackHeader";

interface HistoryItem {
  type: "product" | "subscription";
  name: string;
  amount: number;
  status: string;
  date: string;
}

export default function PaymentsLogPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/payments/history", { credentials: "include" });
        const data = await res.json();
        setAuthed(data.authenticated !== false);
        setItems(data.items || []);
      } catch {
        setAuthed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (authed === false) return <LoginRequired />;

  return (
    // body가 flex-col이라 가로 auto 마진만 있으면 fit-content로 쪼그라듦 → width 100% 필수
    <div style={{ width: "100%", minHeight: "100vh", background: "var(--c-bg)", maxWidth: 720, margin: "0 auto" }}>
      <BackHeader title="결제/환불 내역" />

      {loading ? (
        <div style={centerBox}>
          <div style={spinner} />
        </div>
      ) : items.length === 0 ? (
        <div style={centerBox}>
          <p style={{ color: "var(--c-text-5)", fontSize: 15, fontWeight: 600 }}>결제 내역이 없어요</p>
        </div>
      ) : (
        <div style={{ padding: "8px 20px 28px" }}>
          <div style={card}>
            {items.map((it, i) => {
              const failed = it.status !== "DONE";
              return (
                <div key={i} style={{ ...itemRow, borderBottom: i < items.length - 1 ? "1px solid var(--c-bg-muted)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</p>
                    <p style={{ fontSize: 12, color: "var(--c-text-5)", margin: "4px 0 0", fontWeight: 600 }}>
                      {new Date(it.date).toLocaleDateString("ko-KR")} · {it.type === "subscription" ? "정기결제" : "단건결제"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: failed ? "var(--c-danger)" : "var(--c-text-2)", margin: 0 }}>
                      {it.amount.toLocaleString()}원
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 600, margin: "4px 0 0", color: failed ? "var(--c-danger)" : "var(--c-success-e)" }}>
                      {failed ? "실패" : "완료"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <style>{`@keyframes payspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const centerBox = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "60vh",
} as const;

const spinner = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "4px solid var(--c-border)",
  borderTopColor: "var(--c-brand)",
  animation: "payspin 0.8s linear infinite",
} as const;

const card = {
  borderRadius: 18,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg)",
  overflow: "hidden",
} as const;

const itemRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 58,
  padding: "10px 18px",
} as const;
