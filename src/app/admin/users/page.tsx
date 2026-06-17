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
        <div style={{ width: 28, height: 28, border: "3px solid #E5E7EB", borderTopColor: "#3787FF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#2B313D" }}>회원 관리</h1>
        <p style={{ fontSize: 14, color: "#8A909C", marginTop: 4 }}>가입 정보, 연락처, 기기 정보, 활동 기록을 확인합니다.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }} className="admin-user-stats">
        <SummaryCard label="전체 회원" value={`${stats.total}명`} />
        <SummaryCard label="관리자" value={`${stats.admins}명`} />
        <SummaryCard label="오늘 가입" value={`${stats.joinedToday}명`} />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름, 이메일, 전화번호, 기기, 가입경로 검색"
          style={{
            width: "100%",
            height: 44,
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            background: "#fff",
            padding: "0 14px",
            color: "#111827",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>회원 리스트</h2>
          <span style={{ fontSize: 12, color: "#8A909C", fontWeight: 700 }}>{filteredUsers.length}명</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8A909C", fontSize: 14 }}>표시할 회원이 없습니다.</div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["가입일", "이름", "이메일", "전화번호", "권한", "가입경로", "가입 기기", "최근 접속", "활동"].map((heading) => (
                    <th key={heading} style={{ textAlign: "left", padding: "11px 14px", color: "#8A909C", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderTop: "1px solid #F3F4F6", verticalAlign: "top" }}>
                    <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EBF3FF", color: "#3787FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
                          {user.nickname.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 800, color: "#111827" }}>{user.nickname}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{user.email}</td>
                    <td style={tdStyle}>{fallback(user.phone)}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: user.role === "admin" ? "#EEF5FF" : "#F3F4F6", color: user.role === "admin" ? "#1F5EDC" : "#6B7280", fontSize: 12, fontWeight: 800 }}>
                        {user.role === "admin" ? "관리자" : "회원"}
                      </span>
                    </td>
                    <td style={tdStyle}>{fallback(user.signupSource)}</td>
                    <td style={tdStyle}>
                      <p style={{ fontWeight: 800, color: "#111827" }}>{fallback(user.signupDevice)}</p>
                      <p style={{ marginTop: 3, color: "#9CA3AF", fontSize: 11 }}>{fallback(user.signupIp)}</p>
                    </td>
                    <td style={tdStyle}>
                      <p style={{ fontWeight: 800, color: "#111827" }}>{fallback(user.lastLoginDevice)}</p>
                      <p style={{ marginTop: 3, color: "#9CA3AF", fontSize: 11 }}>{formatDate(user.lastLoginAt)}</p>
                    </td>
                    <td style={tdStyle}>
                      <p style={{ color: "#111827", fontWeight: 800 }}>풀이 {user.attemptCount}회</p>
                      <p style={{ marginTop: 3, color: "#6B7280" }}>공부 {formatStudyTime(user.totalStudySeconds)}</p>
                      <p style={{ marginTop: 3, color: "#6B7280" }}>문의 {user.inquiryCount}건</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minHeight: 78, borderRadius: 14, border: "1px solid #E5E7EB", background: "#fff", padding: 14 }}>
      <p style={{ fontSize: 12, color: "#8A909C", fontWeight: 800 }}>{label}</p>
      <p style={{ marginTop: 8, fontSize: 22, color: "#111827", fontWeight: 900 }}>{value}</p>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "13px 14px",
  color: "#4B5563",
  lineHeight: 1.45,
  whiteSpace: "nowrap",
};
