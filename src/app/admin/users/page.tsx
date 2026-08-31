"use client";

import { useEffect, useMemo, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  role: string;
  signupSource: string | null;
  phone: string | null;
  signupDevice: string | null;
  signupIp: string | null;
  signupUserAgent: string | null;
  lastLoginAt: string | null;
  lastLoginDevice: string | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  createdAt: string;
  attemptCount: number;
  inquiryCount: number;
  totalStudySeconds: number;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "기록 없음";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatStudyTime(seconds: number) {
  if (!seconds) return "0분";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function fallback(value: string | null | undefined) {
  return value?.trim() || "미수집";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null); // 프리미엄 지급 모달 대상

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) =>
      [user.nickname, user.email, user.phone, user.signupSource, user.signupDevice, user.lastLoginDevice]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword))
    );
  }, [query, users]);

  const stats = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return {
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      joinedToday: users.filter((user) => {
        const key = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(user.createdAt));
        return key === todayKey;
      }).length,
    };
  }, [users]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${JC.soft}`, borderTopColor: JC.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="jc-admin">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: JC.title }}>회원 관리</h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: JC.sub, marginTop: 6 }}>가입 정보, 연락처, 기기 정보, 활동 기록을 확인합니다.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }} className="admin-user-stats">
        <SummaryCard label="전체 회원" value={`${stats.total}명`} />
        <SummaryCard label="관리자" value={`${stats.admins}명`} />
        <SummaryCard label="오늘 가입" value={`${stats.joinedToday}명`} />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름, 이메일, 전화번호, 기기, 가입경로 검색"
          style={{
            width: "100%",
            height: 46,
            borderRadius: 13,
            border: `1px solid ${JC.soft}`,
            background: "var(--c-bg)",
            padding: "0 16px",
            color: JC.title,
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      <div style={cardStyle}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${JC.soft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: JC.title }}>회원 리스트</h2>
          <span style={{ fontSize: 12, color: JC.accent, fontWeight: 700 }}>{filteredUsers.length}명</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: JC.sub, fontSize: 14 }}>표시할 회원이 없습니다.</div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["가입일", "이름", "이메일", "전화번호", "권한", "가입경로", "가입 기기", "최근 접속", "활동", "프리미엄"].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    style={{
                      // 헤더 아래 구분선과 겹치지 않게 첫 행은 선 없음, 마지막 행도 아래 선 없음
                      borderTop: index === 0 ? "none" : `1px solid ${JC.soft}`,
                      verticalAlign: "top",
                    }}
                  >
                    <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 13, background: JC.accentBg, color: JC.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                          {user.nickname.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 700, color: JC.title }}>{user.nickname}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{user.email}</td>
                    <td style={tdStyle}>{fallback(user.phone)}</td>
                    <td style={tdStyle}>
                      <span style={user.role === "admin" ? chipAccent : chipNeutral}>
                        {user.role === "admin" ? "관리자" : "회원"}
                      </span>
                    </td>
                    <td style={tdStyle}>{fallback(user.signupSource)}</td>
                    <td style={tdStyle}>
                      <p style={{ fontWeight: 700, color: JC.title }}>{fallback(user.signupDevice)}</p>
                      <p style={{ marginTop: 3, color: JC.sub, fontSize: 11, fontWeight: 400 }}>{fallback(user.signupIp)}</p>
                    </td>
                    <td style={tdStyle}>
                      <p style={{ fontWeight: 700, color: JC.title }}>{fallback(user.lastLoginDevice)}</p>
                      <p style={{ marginTop: 3, color: JC.sub, fontSize: 11, fontWeight: 400 }}>{formatDate(user.lastLoginAt)}</p>
                    </td>
                    <td style={tdStyle}>
                      <p style={{ color: JC.accent, fontWeight: 700 }}>풀이 {user.attemptCount}회</p>
                      <p style={{ marginTop: 3, color: JC.body }}>공부 {formatStudyTime(user.totalStudySeconds)}</p>
                      <p style={{ marginTop: 3, color: JC.body }}>문의 {user.inquiryCount}건</p>
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => setGrantUser(user)}
                        style={{ border: "none", borderRadius: 8, background: JC.accentBg, color: JC.accent, padding: "7px 12px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        지급
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {grantUser && <PremiumGrantModal user={grantUser} onClose={() => setGrantUser(null)} />}

      <style>{JC_FOCUS_CSS}</style>
      <style>{`
        @media (max-width: 768px) {
          .admin-user-stats {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// 프리미엄권 지급 모달 — 계정별 무료 프리미엄 지급/회수. 2주·한달·두달.
function PremiumGrantModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/premium-grant?userId=${encodeURIComponent(user.id)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setExpiresAt(d?.expiresAt ?? null))
      .catch(() => setExpiresAt(null))
      .finally(() => setLoading(false));
  }, [user.id]);

  const now = Date.now();
  const active = !!expiresAt && new Date(expiresAt).getTime() > now;

  async function grant(days: number, label: string) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/premium-grant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, days }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "지급 실패");
      setExpiresAt(d.expiresAt);
      setMsg(`${label} 지급 완료`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "지급 실패");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/premium-grant", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error("회수 실패");
      setExpiresAt(null);
      setMsg("회수 완료");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "회수 실패");
    } finally {
      setBusy(false);
    }
  }

  const DURATIONS: { days: number; label: string }[] = [
    { days: 14, label: "2주권" },
    { days: 30, label: "한달권" },
    { days: 60, label: "두달권" },
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(43,49,61,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, background: "var(--c-bg)", border: `1px solid ${JC.soft}`, borderRadius: 18, padding: "24px 22px 20px", boxSizing: "border-box" }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: JC.title }}>프리미엄권 지급</div>
        <div style={{ marginTop: 6, fontSize: 13, color: JC.body }}>
          <b style={{ color: JC.title }}>{user.nickname}</b> · {user.email}
        </div>

        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: JC.soft, fontSize: 13, fontWeight: 700, color: active ? "#1B8A3B" : JC.sub }}>
          {loading ? "확인 중…" : active ? `프리미엄 이용 중 · ${formatDate(expiresAt)}까지` : "현재 무료 프리미엄 없음"}
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              disabled={busy}
              onClick={() => grant(d.days, d.label)}
              className="press"
              style={{ border: "none", borderRadius: 12, background: "#3180F7", color: "#fff", padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 11.5, color: JC.sub }}>여러 번 누르면 기간이 누적됩니다.</p>

        {msg && <p style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: JC.accent, textAlign: "center" }}>{msg}</p>}

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          {active && (
            <button type="button" disabled={busy} onClick={revoke} style={{ flex: 1, border: `1px solid ${JC.soft}`, borderRadius: 12, background: "var(--c-bg)", color: "#D63A3A", padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              회수
            </button>
          )}
          <button type="button" onClick={onClose} style={{ flex: 1, border: "none", borderRadius: 12, background: JC.soft, color: JC.body, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...cardStyle, minHeight: 82, padding: "16px 18px" }}>
      <p style={{ fontSize: 12, color: JC.body, fontWeight: 600 }}>{label}</p>
      <p style={{ marginTop: 8, fontSize: 22, color: JC.accent, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

/* 제이씨랩 자가견적(jaicylab.com/estimate) 톤.
   면=흰색, 보조면·경계=#F2F3F5, 강조=#EAF2FF/#3180F7, 그림자 없음. */
const JC = {
  soft: "var(--c-bg-muted-3)", // #F2F3F5
  accentBg: "var(--c-brand-soft-6)", // #EAF2FF
  title: "var(--c-text-2)", // #2B313D
  body: "var(--c-text-3c)", // #51535C
  sub: "#8A909C",
  accent: "#3180F7",
};

const cardStyle: React.CSSProperties = {
  background: "var(--c-bg)",
  borderRadius: 18,
  border: `1px solid ${JC.soft}`,
  overflow: "hidden",
  boxShadow: "none",
};

const chipBase: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const chipAccent: React.CSSProperties = { ...chipBase, background: JC.accentBg, color: JC.accent };
const chipNeutral: React.CSSProperties = { ...chipBase, background: JC.soft, color: JC.body };

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  color: JC.sub,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${JC.soft}`,
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  color: JC.body,
  fontWeight: 500,
  lineHeight: 1.45,
  whiteSpace: "nowrap",
};

/* 인라인 style 로는 :focus 를 못 준다. 포커스 테두리만 클래스로 뺀다.
   page.tsx 는 default 외 named export 가 금지라 모듈 로컬 상수로 둔다. */
const JC_FOCUS_CSS = `
  .jc-admin input:focus,
  .jc-admin textarea:focus,
  .jc-admin select:focus { border-color: #3180F7 !important; }
`;
