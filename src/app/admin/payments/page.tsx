"use client";

import { useEffect, useMemo, useState } from "react";

interface IapPayment {
  id: string;
  email: string | null;
  nickname: string | null;
  platform: string;
  planId: string;
  planName: string;
  productId: string;
  amountKrw: number | null;
  status: string;
  active: boolean;
  autoRenew: boolean;
  environment: string;
  purchasedAt: string | null;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
}
interface PaymentsData {
  summary: { active: number; total: number; googleActive: number; appleActive: number };
  iap: IapPayment[];
}

const ACCENT = "#3180F7";
const MUTED = "#8A909C";
const BORDER = "var(--c-bg-muted-3)";

function won(n: number | null | undefined) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}
function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000); // KST
  const p = (x: number) => String(x).padStart(2, "0");
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
function platformLabel(p: string) {
  return p === "apple" ? "앱스토어" : p === "google" ? "안드로이드" : p;
}

function StatusBadge({ text, tone }: { text: string; tone: "on" | "off" | "warn" | "neutral" }) {
  const map = {
    on: { bg: "#E7F4EA", fg: "#1B8A3B" },
    off: { bg: "#F2F4F6", fg: "#8A909C" },
    warn: { bg: "#FDECEC", fg: "#D63A3A" },
    neutral: { bg: "#EAF2FF", fg: ACCENT },
  }[tone];
  return (
    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: map.bg, color: map.fg, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function User({ nickname, email }: { nickname: string | null; email: string | null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nickname || "(탈퇴/미상)"}</div>
      <div style={{ fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email || "-"}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--c-bg)",
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};
const thStyle: React.CSSProperties = { textAlign: "left", fontSize: 12, fontWeight: 700, color: MUTED, padding: "10px 12px", whiteSpace: "nowrap", borderBottom: `1px solid ${BORDER}` };
const tdStyle: React.CSSProperties = { fontSize: 13, color: "var(--c-text-3c)", padding: "12px", borderBottom: `1px solid ${BORDER}`, verticalAlign: "middle" };

type Filter = "all" | "google" | "apple";

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/admin/payments", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "관리자 권한이 필요합니다." : "불러오지 못했습니다.");
        return res.json();
      })
      .then((d: PaymentsData) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const summaryCards = useMemo(() => {
    const s = data?.summary;
    return [
      { label: "활성 구독 (전체)", value: s ? String(s.active) : "-" },
      { label: "안드로이드 활성", value: s ? String(s.googleActive) : "-" },
      { label: "앱스토어 활성", value: s ? String(s.appleActive) : "-" },
      { label: "구독 전체 (만료 포함)", value: s ? String(s.total) : "-" },
    ];
  }, [data]);

  const rows = useMemo(() => {
    const all = data?.iap ?? [];
    if (filter === "all") return all;
    return all.filter((r) => r.platform === filter);
  }, [data, filter]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "google", label: "안드로이드 (구글)" },
    { key: "apple", label: "앱스토어 (애플)" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--c-text-2)", margin: "0 0 4px" }}>결제 관리</h1>
      <p style={{ fontSize: 13.5, color: MUTED, margin: "0 0 22px" }}>프리미엄 구독 결제 내역 — 안드로이드·앱스토어 인앱결제(IAP) 두 채널.</p>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: MUTED }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "#D63A3A", fontWeight: 600 }}>{error}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
            {summaryCards.map((c) => (
              <div key={c.label} style={cardStyle}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: MUTED }}>{c.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--c-text-2)", marginTop: 8, letterSpacing: "-0.02em" }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className="press"
                style={{
                  border: "none", borderRadius: 999, padding: "9px 15px", cursor: "pointer",
                  fontSize: 13.5, fontWeight: 700,
                  background: filter === t.key ? "var(--c-brand-soft-6)" : "var(--c-bg-muted-3)",
                  color: filter === t.key ? ACCENT : "var(--c-text-3c)",
                }}
              >
                {t.label}{" "}
                <span style={{ opacity: 0.7 }}>
                  {t.key === "all"
                    ? data!.iap.length
                    : data!.iap.filter((r) => r.platform === t.key).length}
                </span>
              </button>
            ))}
          </div>

          <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
            <IapTable rows={rows} />
          </div>
        </>
      )}
    </div>
  );
}

function IapTable({ rows }: { rows: IapPayment[] }) {
  if (rows.length === 0) return <div style={{ padding: 48, textAlign: "center", color: MUTED, fontSize: 13.5 }}>해당하는 구독 내역이 없습니다.</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
      <thead>
        <tr>
          <th style={thStyle}>상태</th>
          <th style={thStyle}>사용자</th>
          <th style={thStyle}>플랜</th>
          <th style={thStyle}>스토어</th>
          <th style={thStyle}>금액</th>
          <th style={thStyle}>구매일</th>
          <th style={thStyle}>만료/갱신일</th>
          <th style={thStyle}>자동갱신</th>
          <th style={thStyle}>환경</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={tdStyle}>
              {r.active ? (
                <StatusBadge text="활성" tone="on" />
              ) : r.status === "REFUNDED" ? (
                <StatusBadge text="환불" tone="warn" />
              ) : (
                <StatusBadge text="만료" tone="off" />
              )}
            </td>
            <td style={tdStyle}><User nickname={r.nickname} email={r.email} /></td>
            <td style={tdStyle}><span style={{ fontWeight: 600, color: "var(--c-text-2)" }}>{r.planName}</span></td>
            <td style={tdStyle}>{platformLabel(r.platform)}</td>
            <td style={tdStyle}>{won(r.amountKrw)}</td>
            <td style={tdStyle}>{fmtDate(r.purchasedAt || r.createdAt)}</td>
            <td style={tdStyle}>{fmtDate(r.currentPeriodEnd)}</td>
            <td style={tdStyle}>{r.autoRenew ? "ON" : "OFF"}</td>
            <td style={tdStyle}>{r.environment === "Sandbox" ? <StatusBadge text="Sandbox" tone="neutral" /> : "운영"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
