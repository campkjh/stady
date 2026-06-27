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
    <div style={{ minHeight: "100vh", background: "#fff", maxWidth: 720, margin: "0 auto" }}>
      <BackHeader title="결제로그" />

      {loading ? (
        <div style={centerBox}>
          <div style={spinner} />
        </div>
      ) : items.length === 0 ? (
        <div style={centerBox}>
          <p style={{ color: "#8B95A1", fontSize: 15, fontWeight: 500 }}>결제 내역이 없어요</p>
        </div>
      ) : (
        <div style={{ padding: "8px 0" }}>
          {items.map((it, i) => {
            const failed = it.status !== "DONE";
            return (
              <div key={i} style={itemRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#191F28", margin: 0 }}>{it.name}</p>
                  <p style={{ fontSize: 12.5, color: "#8B95A1", margin: "4px 0 0", fontWeight: 500 }}>
                    {new Date(it.date).toLocaleDateString("ko-KR")} · {it.type === "subscription" ? "정기결제" : "단건결제"}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#191F28", margin: 0 }}>
                    {it.amount.toLocaleString()}원
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: "4px 0 0", color: failed ? "#E85D5D" : "#16A34A" }}>
                    {failed ? "실패" : "완료"}
                  </p>
                </div>
              </div>
            );
          })}
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
  border: "4px solid #E5E7EB",
  borderTopColor: "#3787FF",
  animation: "payspin 0.8s linear infinite",
} as const;

const itemRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 20px",
  borderBottom: "1px solid #F5F6F8",
} as const;
