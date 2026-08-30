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
interface TossPayment {
  id: string;
  orderId: string;
  email: string | null;
  nickname: string | null;
  productId: string;
  amount: number;
  status: string;
  method: string | null;
  approvedAt: string | null;
  createdAt: string;
}
interface TossSub {
  id: string;
  email: string | null;
  nickname: string | null;
  planId: string;
  amount: number;
  status: string;
  cardCompany: string | null;
  cardNumber: string | null;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
}
interface PaymentsData {
  summary: { iapActive: number; iapTotal: number; tossPaidCount: number; tossPaidAmount: number; tossSubActive: number };
  iap: IapPayment[];
  toss: TossPayment[];
  tossSub: TossSub[];
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
  // KST 표시
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
function platformLabel(p: string) {
  return p === "apple" ? "App Store" : p === "google" ? "Google Play" : p;
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

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"iap" | "toss" | "tossSub">("iap");

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
      { label: "프리미엄 활성 구독", value: s ? String(s.iapActive) : "-" },
      { label: "프리미엄 구독 전체", value: s ? String(s.iapTotal) : "-" },
      { label: "단건 결제(완료)", value: s ? `${s.tossPaidCount}건` : "-" },
      { label: "단건 결제 합계", value: s ? won(s.tossPaidAmount) : "-" },
    ];
  }, [data]);

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: "iap", label: "프리미엄 구독 (인앱결제)", count: data?.iap.length ?? 0 },
    { key: "toss", label: "단건 결제 (토스)", count: data?.toss.length ?? 0 },
    { key: "tossSub", label: "정기결제 (토스·레거시)", count: data?.tossSub.length ?? 0 },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--c-text-2)", margin: "0 0 4px" }}>결제 관리</h1>
      <p style={{ fontSize: 13.5, color: MUTED, margin: "0 0 22px" }}>프리미엄 구독(애플·구글 인앱결제)과 토스 결제 내역을 확인할 수 있어요.</p>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: MUTED }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "#D63A3A", fontWeight: 600 }}>{error}</div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
            {summaryCards.map((c) => (
              <div key={c.label} style={cardStyle}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: MUTED }}>{c.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--c-text-2)", marginTop: 8, letterSpacing: "-0.02em" }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* 탭 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="press"
                style={{
                  border: "none", borderRadius: 999, padding: "9px 15px", cursor: "pointer",
                  fontSize: 13.5, fontWeight: 700,
                  background: tab === t.key ? "var(--c-brand-soft-6)" : "var(--c-bg-muted-3)",
                  color: tab === t.key ? ACCENT : "var(--c-text-3c)",
                }}
              >
                {t.label} <span style={{ opacity: 0.7 }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* 표 */}
          <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
            {tab === "iap" && <IapTable rows={data!.iap} />}
            {tab === "toss" && <TossTable rows={data!.toss} />}
            {tab === "tossSub" && <TossSubTable rows={data!.tossSub} />}
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 48, textAlign: "center", color: MUTED, fontSize: 13.5 }}>{text}</div>;
}

function IapTable({ rows }: { rows: IapPayment[] }) {
  if (rows.length === 0) return <Empty text="프리미엄 구독 내역이 없습니다." />;
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

function TossTable({ rows }: { rows: TossPayment[] }) {
  if (rows.length === 0) return <Empty text="토스 단건 결제 내역이 없습니다." />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
      <thead>
        <tr>
          <th style={thStyle}>상태</th>
          <th style={thStyle}>사용자</th>
          <th style={thStyle}>상품</th>
          <th style={thStyle}>금액</th>
          <th style={thStyle}>결제수단</th>
          <th style={thStyle}>승인일시</th>
          <th style={thStyle}>주문번호</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={tdStyle}>
              {r.status === "DONE" ? (
                <StatusBadge text="완료" tone="on" />
              ) : r.status === "PENDING" ? (
                <StatusBadge text="대기" tone="neutral" />
              ) : (
                <StatusBadge text={r.status} tone="warn" />
              )}
            </td>
            <td style={tdStyle}><User nickname={r.nickname} email={r.email} /></td>
            <td style={tdStyle}>{r.productId}</td>
            <td style={tdStyle}>{won(r.amount)}</td>
            <td style={tdStyle}>{r.method || "-"}</td>
            <td style={tdStyle}>{fmtDate(r.approvedAt || r.createdAt)}</td>
            <td style={{ ...tdStyle, fontSize: 11.5, color: MUTED, fontFamily: "monospace" }}>{r.orderId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TossSubTable({ rows }: { rows: TossSub[] }) {
  if (rows.length === 0) return <Empty text="토스 정기결제 내역이 없습니다. (현재는 인앱결제로 대체됨)" />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
      <thead>
        <tr>
          <th style={thStyle}>상태</th>
          <th style={thStyle}>사용자</th>
          <th style={thStyle}>플랜</th>
          <th style={thStyle}>금액</th>
          <th style={thStyle}>카드</th>
          <th style={thStyle}>만료/다음결제</th>
          <th style={thStyle}>시작일</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={tdStyle}>
              {r.status === "ACTIVE" ? (
                <StatusBadge text="활성" tone="on" />
              ) : r.status === "CANCELED" ? (
                <StatusBadge text="해지" tone="off" />
              ) : (
                <StatusBadge text={r.status} tone="warn" />
              )}
            </td>
            <td style={tdStyle}><User nickname={r.nickname} email={r.email} /></td>
            <td style={tdStyle}>{r.planId}</td>
            <td style={tdStyle}>{won(r.amount)}</td>
            <td style={tdStyle}>{[r.cardCompany, r.cardNumber].filter(Boolean).join(" ") || "-"}</td>
            <td style={tdStyle}>{fmtDate(r.currentPeriodEnd)}</td>
            <td style={tdStyle}>{fmtDate(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
