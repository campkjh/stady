"use client";

import { useEffect, useMemo, useState } from "react";
import { primeDaysLeft } from "@/lib/primeRemaining";

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
interface FreeGrant {
  userId: string;
  email: string | null;
  nickname: string | null;
  source: string;
  totalDays: number;
  expiresAt: string;
}
interface Churn { monthLabel: string; newSubs: number; canceled: number; ratePct: number }
interface Revenue { grossKrw: number; googleGrossKrw: number; appleGrossKrw: number; mrrKrw: number }
interface PaymentsData {
  summary: { active: number; total: number; googleActive: number; appleActive: number; freeActive: number; refunded: number };
  iap: IapPayment[];
  free: FreeGrant[];
  churn: Churn;
  revenue: Revenue;
}

// 무료 지급 출처 라벨 — 어떤 경로로 무료가 됐는지.
function grantSourceLabel(src: string) {
  switch (src) {
    case "referral": return "친구초대(초대한 사람)";
    case "referral_invitee": return "친구초대(초대받은 친구)";
    case "referral_backfill": return "친구초대(소급 지급)";
    case "admin":
    case "admin_grant": return "수동 지급";
    default: return src;
  }
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

type Filter = "all" | "google" | "apple" | "free" | "refunded";

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [revoking, setRevoking] = useState<string | null>(null);
  // 스토어 수수료율 — 애플 소규모 개발자/구글 첫 100만$ 구간이면 15%, 아니면 30%.
  const [feePct, setFeePct] = useState<15 | 30>(30);
  // 정산 상세는 기본 접어두고, 접힌 상태에선 핵심 수치 2개만 나란히 보여준다.
  const [revenueOpen, setRevenueOpen] = useState(false);

  // 무료 지급 개별 회수 — 결제와 무관, PremiumGrant 삭제.
  async function revokeFree(g: FreeGrant) {
    if (revoking) return;
    if (!confirm(`${g.nickname || g.email || "이 사용자"}의 무료 이용권을 회수할까요?\n(${grantSourceLabel(g.source)} · ${fmtDate(g.expiresAt)}까지)`)) return;
    setRevoking(g.userId);
    try {
      const res = await fetch("/api/admin/premium-grant", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: g.userId }),
      });
      if (!res.ok) throw new Error("회수 실패");
      setData((prev) =>
        prev
          ? { ...prev, free: prev.free.filter((f) => f.userId !== g.userId), summary: { ...prev.summary, freeActive: Math.max(0, prev.summary.freeActive - 1) } }
          : prev
      );
    } catch {
      alert("회수에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setRevoking(null);
    }
  }

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
      { label: "활성 구독 (결제)", value: s ? String(s.active) : "-" },
      { label: "안드로이드 활성", value: s ? String(s.googleActive) : "-" },
      { label: "앱스토어 활성", value: s ? String(s.appleActive) : "-" },
      { label: "무료 이용중 (지급)", value: s ? String(s.freeActive) : "-" },
      { label: "환불", value: s ? String(s.refunded) : "-" },
    ];
  }, [data]);

  const rows = useMemo(() => {
    const all = data?.iap ?? [];
    if (filter === "all") return all;
    if (filter === "refunded") return all.filter((r) => r.status === "REFUNDED");
    return all.filter((r) => r.platform === filter);
  }, [data, filter]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "전체 결제" },
    { key: "google", label: "안드로이드 (구글)" },
    { key: "apple", label: "앱스토어 (애플)" },
    { key: "free", label: "무료 이용중" },
    { key: "refunded", label: "환불" },
  ];
  const tabCount = (key: Filter) =>
    key === "all"
      ? data!.iap.length
      : key === "free"
        ? data!.free.length
        : key === "refunded"
          ? data!.iap.filter((r) => r.status === "REFUNDED").length
          : data!.iap.filter((r) => r.platform === key).length;

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

          {data?.churn && data?.revenue && (
            <div style={{ ...cardStyle, marginBottom: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 22 }}>
                {/* 전월 해지율 */}
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 10 }}>
                    전월({data.churn.monthLabel}) 구독 대비 해지
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: data.churn.ratePct >= 30 ? "#D63A3A" : "var(--c-text-2)", letterSpacing: "-0.02em" }}>
                      {data.churn.ratePct}%
                    </span>
                    <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>
                      해지 {data.churn.canceled} / 신규 {data.churn.newSubs}건
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, color: MUTED, margin: "8px 0 0", lineHeight: 1.6 }}>
                    전월에 새로 구독한 사람 중 환불·해지했거나 자동갱신을 끈 비율입니다.
                  </p>
                </div>

                {/* 정산 추정 — 접고 펼치기 */}
                <div>
                  <button
                    type="button"
                    onClick={() => setRevenueOpen((v) => !v)}
                    aria-expanded={revenueOpen}
                    style={{
                      width: "100%", border: "none", background: "none", padding: 0, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--c-text-2)" }}>예상 정산금액 (안드로이드+애플)</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: ACCENT }}>
                      {revenueOpen ? "접기" : "자세히"}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        style={{ transform: revenueOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>

                  {/* 접힌 상태: 핵심 수치 2개를 나란히 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 4 }}>정산 예상 (수수료 {feePct}%)</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text-2)", letterSpacing: "-0.02em" }}>
                        {won(Math.round(data.revenue.grossKrw * (1 - feePct / 100)))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 4 }}>총 결제액 (차감 전)</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text-2)", letterSpacing: "-0.02em" }}>
                        {won(data.revenue.grossKrw)}
                      </div>
                    </div>
                  </div>

                  {revenueOpen && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                        {([15, 30] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setFeePct(p)}
                            style={{
                              border: "none", borderRadius: 999, padding: "4px 10px", cursor: "pointer",
                              fontSize: 11.5, fontWeight: 700,
                              background: feePct === p ? "var(--c-brand-soft-6)" : "var(--c-bg-muted-3)",
                              color: feePct === p ? ACCENT : "var(--c-text-3c)",
                            }}
                          >
                            수수료 {p}%
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
                        안드로이드 {won(data.revenue.googleGrossKrw)} · 앱스토어 {won(data.revenue.appleGrossKrw)}<br />
                        월 환산 예상 수입(MRR) {won(data.revenue.mrrKrw)} · 정산 시 {won(Math.round(data.revenue.mrrKrw * (1 - feePct / 100)))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {revenueOpen && (
                <p style={{ fontSize: 11.5, color: MUTED, margin: "16px 0 0", lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                  환불·테스트(Sandbox) 건은 제외한 금액입니다. 표시가(부가세 포함) 기준이며, 실제 입금액은
                  스토어 수수료율·환율·세금 처리에 따라 달라질 수 있습니다.
                </p>
              )}
            </div>
          )}

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
                <span style={{ opacity: 0.7 }}>{tabCount(t.key)}</span>
              </button>
            ))}
          </div>

          {filter === "refunded" && (
            <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 12px" }}>
              스토어(앱스토어·구글플레이)에서 환불 처리된 구독입니다. 환불 시점에 이용권은 즉시 해제됩니다.
            </p>
          )}

          {filter === "free" && (
            <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 12px" }}>
              결제 없이 지급된 무료 프리미엄(친구초대·수동지급)입니다. 결제 건수에는 포함되지 않으며, 개별 회수할 수 있습니다.
            </p>
          )}

          <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
            {filter === "free"
              ? <FreeGrantTable rows={data!.free} onRevoke={revokeFree} revoking={revoking} />
              : <IapTable rows={rows} />}
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

// 만료일 옆 남은 기간. 3일 이하는 임박 표시(빨강).
function DaysLeft({ expiresAt }: { expiresAt: string }) {
  const d = primeDaysLeft(expiresAt);
  if (d === null) return null;
  const soon = d <= 3;
  return (
    <span
      style={{
        marginLeft: 8, display: "inline-block", padding: "2px 8px", borderRadius: 999,
        fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
        background: soon ? "#FDECEC" : "#F2F4F6",
        color: soon ? "#D63A3A" : "#8A909C",
      }}
    >
      {d <= 0 ? "오늘 만료" : `${d}일 남음`}
    </span>
  );
}

function FreeGrantTable({ rows, onRevoke, revoking }: { rows: FreeGrant[]; onRevoke: (g: FreeGrant) => void; revoking: string | null }) {
  if (rows.length === 0) return <div style={{ padding: 48, textAlign: "center", color: MUTED, fontSize: 13.5 }}>무료 이용중인 사용자가 없습니다.</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
      <thead>
        <tr>
          <th style={thStyle}>상태</th>
          <th style={thStyle}>사용자</th>
          <th style={thStyle}>지급 경로</th>
          <th style={thStyle}>누적 일수</th>
          <th style={thStyle}>만료일</th>
          <th style={{ ...thStyle, textAlign: "right" }}>관리</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.userId}>
            <td style={tdStyle}><StatusBadge text="무료" tone="neutral" /></td>
            <td style={tdStyle}><User nickname={g.nickname} email={g.email} /></td>
            <td style={tdStyle}>{grantSourceLabel(g.source)}</td>
            <td style={tdStyle}>{g.totalDays > 0 ? `${g.totalDays}일` : "-"}</td>
            <td style={tdStyle}>
              <span>{fmtDate(g.expiresAt)}</span>
              <DaysLeft expiresAt={g.expiresAt} />
            </td>
            <td style={{ ...tdStyle, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => onRevoke(g)}
                disabled={revoking === g.userId}
                className="press"
                style={{
                  border: "1px solid #F1B4B4", borderRadius: 8, padding: "6px 12px", cursor: revoking === g.userId ? "default" : "pointer",
                  fontSize: 12.5, fontWeight: 700, background: "#FDECEC", color: "#D63A3A", opacity: revoking === g.userId ? 0.6 : 1, whiteSpace: "nowrap",
                }}
              >
                {revoking === g.userId ? "회수중…" : "회수"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
