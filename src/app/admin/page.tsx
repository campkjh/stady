"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Counts {
  workbooks: number;
  oxQuizSets: number;
  vocabQuizSets: number;
  users: number;
  inquiries: number;
}

interface SourceStat {
  source: string;
  count: number;
}

interface RecentUser {
  id: string;
  nickname: string;
  email: string;
  signupSource: string | null;
  createdAt: string;
}

interface RecentInquiry {
  id: string;
  name: string;
  category: string;
  title: string;
  status: string;
  createdAt: string;
}

interface ReferralInvitee {
  id: string;
  nickname: string;
  email: string;
  invitedAt: string;
}

interface ReferralInviter {
  inviterId: string;
  nickname: string;
  email: string;
  inviteCode: string;
  invitedCount: number;
  invitees: ReferralInvitee[];
}

interface ReferralStats {
  totalInvites: number;
  inviters: ReferralInviter[];
}

/* ── 제이씨랩 자가견적 톤 토큰 ──
   면: 카드 #FFFFFF(--c-bg) / 보조면 #F2F3F5(--c-bg-muted-3) / 강조 #EAF2FF(--c-brand-soft-6)
   선: 1px solid #F2F3F5 가 유일한 경계 · 그림자 없음
   라운드: 카드 18 / 작은 요소 13 / 알약 999
   글자: 제목 #2B313D(--c-text-2) 700 · 본문 #51535C(--c-text-3c) · 보조 #8A909C · 강조 #3180F7 */
const SURFACE_SUB = "var(--c-bg-muted-3)"; // #F2F3F5
const SURFACE_ACCENT = "var(--c-brand-soft-6)"; // #EAF2FF
const LINE = "1px solid var(--c-bg-muted-3)"; // 1px solid #F2F3F5
const TEXT_TITLE = "var(--c-text-2)"; // #2B313D
const TEXT_BODY = "var(--c-text-3c)"; // #51535C
const TEXT_SUB = "#8A909C";
const ACCENT = "#3180F7";

const cardStyle: React.CSSProperties = {
  background: "var(--c-bg)",
  border: LINE,
  borderRadius: 18,
  boxShadow: "none",
  overflow: "hidden",
};

const cardHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "20px 24px",
  borderBottom: LINE,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 24px",
  fontSize: 12,
  fontWeight: 600,
  color: TEXT_SUB,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 24px",
  fontSize: 13,
  fontWeight: 500,
  color: TEXT_BODY,
};

const pillBase: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}.${day} ${hours}:${mins}`;
}

// 완료만 강조 알약(#EAF2FF/#3180F7), 나머지는 중립 알약(#F2F3F5/#51535C)
function getStatusStyle(status: string): React.CSSProperties {
  if (status === "완료") {
    return { background: SURFACE_ACCENT, color: ACCENT };
  }
  return { background: SURFACE_SUB, color: TEXT_BODY };
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({
    workbooks: 0,
    oxQuizSets: 0,
    vocabQuizSets: 0,
    users: 0,
    inquiries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentInquiries, setRecentInquiries] = useState<RecentInquiry[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats>({ totalInvites: 0, inviters: [] });

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.counts) setCounts(data.counts);
        if (data.sources) setSourceStats(data.sources);
        if (data.recentUsers) setRecentUsers(data.recentUsers);
        if (data.recentInquiries) setRecentInquiries(data.recentInquiries);
        if (data.referralStats) setReferralStats(data.referralStats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 아이콘은 컬러 SVG(currentColor 불가) → <img> 로 사용, 타일은 전부 중립 #F2F3F5
  const cards = [
    { label: "회원 수", count: counts.users, href: "/admin/users", icon: "stat-users" },
    { label: "문제집 수", count: counts.workbooks, href: "/admin/workbooks", icon: "stat-workbook" },
    { label: "OX퀴즈 수", count: counts.oxQuizSets, href: "/admin/ox-quiz", icon: "stat-quiz" },
    { label: "영단어퀴즈 수", count: counts.vocabQuizSets, href: "/admin/vocab-quiz", icon: "stat-posts" },
    { label: "문의 수", count: counts.inquiries, href: "/admin/inquiries", icon: "stat-comments" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: TEXT_TITLE, letterSpacing: "-0.02em" }}>관리자 대시보드</h1>
        <p style={{ fontSize: 14, fontWeight: 500, color: TEXT_SUB, marginTop: 6 }}>Stady 서비스 현황을 한눈에 확인하세요</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 56 }}>
          <div style={{ width: 28, height: 28, border: "3px solid var(--c-bg-muted-3)", borderTopColor: ACCENT, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="press admin-stat-card"
                style={{
                  ...cardStyle,
                  padding: "22px 22px 24px",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div
                  className="admin-stat-tile"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: SURFACE_SUB,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                    transition: "background 0.18s ease",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/icons/admin-color/${card.icon}.svg`} alt="" aria-hidden width={24} height={24} style={{ display: "block" }} />
                </div>
                <p style={{ fontSize: 30, fontWeight: 800, color: TEXT_TITLE, lineHeight: 1, letterSpacing: "-0.02em" }}>{card.count}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: TEXT_BODY, marginTop: 10 }}>{card.label}</p>
              </Link>
            ))}
          </div>

          {/* Recent Users & Inquiries Side by Side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }} className="admin-dashboard-grid">
            {/* Recent Users */}
            <div style={cardStyle} className="admin-table-card">
              <div style={cardHeadStyle}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT_TITLE }}>최근 가입 회원</h2>
                <span style={{ fontSize: 12, fontWeight: 500, color: TEXT_SUB }}>최근 5명</span>
              </div>
              {recentUsers.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: TEXT_SUB, fontSize: 14, fontWeight: 500 }}>
                  가입한 회원이 없습니다.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>닉네임</th>
                      <th style={thStyle}>이메일</th>
                      <th style={thStyle}>경로</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((user) => (
                      <tr key={user.id} style={{ borderTop: LINE }}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 999, background: SURFACE_ACCENT,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0,
                            }}>
                              {user.nickname.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 700, color: TEXT_TITLE }}>{user.nickname}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>{user.email}</td>
                        <td style={tdStyle}>
                          <span style={{ ...pillBase, background: SURFACE_SUB, color: TEXT_BODY }}>
                            {user.signupSource || "미응답"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: TEXT_SUB, fontSize: 12 }}>
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Inquiries */}
            <div style={cardStyle} className="admin-table-card">
              <div style={cardHeadStyle}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT_TITLE }}>최근 문의</h2>
                <Link href="/admin/inquiries" style={{ fontSize: 12, color: ACCENT, textDecoration: "none", fontWeight: 700 }}>
                  전체보기
                </Link>
              </div>
              {recentInquiries.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: TEXT_SUB, fontSize: 14, fontWeight: 500 }}>
                  접수된 문의가 없습니다.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>제목</th>
                      <th style={thStyle}>카테고리</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>상태</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>접수일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInquiries.map((inq) => (
                      <tr key={inq.id} style={{ borderTop: LINE }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: TEXT_TITLE, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inq.title}
                        </td>
                        <td style={tdStyle}>{inq.category}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{ ...pillBase, ...getStatusStyle(inq.status) }}>
                            {inq.status}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: TEXT_SUB, fontSize: 12 }}>
                          {formatDate(inq.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Referral Event Stats */}
          <div style={{ marginTop: 20 }}>
            <div style={cardStyle} className="admin-table-card admin-referral-card">
              <div style={cardHeadStyle}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT_TITLE }}>친구초대 이벤트 현황</h2>
                  <p style={{ fontSize: 12, fontWeight: 500, color: TEXT_SUB, marginTop: 4 }}>누가 몇 명을 초대했는지 확인합니다</p>
                </div>
                <span style={{ ...pillBase, padding: "7px 14px", fontSize: 12, background: SURFACE_ACCENT, color: ACCENT }}>
                  총 {referralStats.totalInvites}명
                </span>
              </div>
              {referralStats.inviters.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: TEXT_SUB, fontSize: 14, fontWeight: 500 }}>
                  아직 친구초대 기록이 없습니다.
                </div>
              ) : (
                <table className="admin-referral-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>초대한 회원</th>
                      <th style={thStyle}>초대코드</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>초대 수</th>
                      <th style={thStyle}>가입한 친구</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralStats.inviters.map((inviter) => (
                      <tr key={inviter.inviterId} style={{ borderTop: LINE, verticalAlign: "top" }}>
                        <td style={{ ...tdStyle, padding: "16px 24px" }}>
                          <p style={{ fontWeight: 700, color: TEXT_TITLE, fontSize: 13 }}>{inviter.nickname}</p>
                          <p style={{ marginTop: 4, color: TEXT_SUB, fontSize: 12, fontWeight: 500 }}>{inviter.email}</p>
                        </td>
                        <td style={{ ...tdStyle, padding: "16px 24px" }}>
                          <span style={{ ...pillBase, fontSize: 12, background: SURFACE_ACCENT, color: ACCENT }}>
                            {inviter.inviteCode}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, padding: "16px 24px", textAlign: "center" }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>{inviter.invitedCount}</span>
                          <span style={{ marginLeft: 3, color: TEXT_SUB, fontSize: 12, fontWeight: 500 }}>명</span>
                        </td>
                        <td style={{ ...tdStyle, padding: "16px 24px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {inviter.invitees.map((invitee) => (
                              <div key={invitee.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <span style={{ fontWeight: 700, color: TEXT_TITLE }}>{invitee.nickname}</span>
                                  <span style={{ marginLeft: 6, color: TEXT_SUB, fontSize: 12, fontWeight: 500 }}>{invitee.email}</span>
                                </div>
                                <span style={{ color: TEXT_SUB, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{formatDate(invitee.invitedAt)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Sign-up Source Stats */}
          {sourceStats.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={cardStyle}>
                <div style={{ ...cardHeadStyle, justifyContent: "flex-start" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT_TITLE }}>가입 경로 통계</h2>
                </div>
                <div style={{ padding: 24 }}>
                  {(() => {
                    const maxCount = Math.max(...sourceStats.map((s) => s.count), 1);
                    return sourceStats
                      .sort((a, b) => b.count - a.count)
                      .map((stat, i) => (
                        <div key={stat.source} style={{ marginBottom: i < sourceStats.length - 1 ? 18 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_BODY }}>{stat.source}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{stat.count}명</span>
                          </div>
                          <div style={{ height: 8, background: SURFACE_SUB, borderRadius: 999, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${(stat.count / maxCount) * 100}%`,
                                background: ACCENT,
                                borderRadius: 999,
                                transition: "width 0.5s ease",
                              }}
                            />
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Responsive */}
      <style>{`
        .admin-stat-card:hover .admin-stat-tile { background: var(--c-brand-soft-6); }
        @media (max-width: 900px) {
          .admin-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-table-card {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          .admin-table-card table {
            min-width: 620px;
          }
          .admin-referral-table {
            min-width: 760px !important;
          }
        }
      `}</style>
    </div>
  );
}
