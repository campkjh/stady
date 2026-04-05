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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}.${day} ${hours}:${mins}`;
}

function getStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "접수":
      return { background: "#FEF3C7", color: "#D97706" };
    case "처리중":
      return { background: "#DBEAFE", color: "#2563EB" };
    case "완료":
      return { background: "#D1FAE5", color: "#059669" };
    default:
      return { background: "#F3F4F6", color: "#6B7280" };
  }
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

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.counts) setCounts(data.counts);
        if (data.sources) setSourceStats(data.sources);
        if (data.recentUsers) setRecentUsers(data.recentUsers);
        if (data.recentInquiries) setRecentInquiries(data.recentInquiries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: "회원 수",
      count: counts.users,
      href: "/admin",
      color: "#F59E0B",
      bgColor: "#FFFBEB",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="#F59E0B" strokeWidth="1.5"/>
          <path d="M5 20C5 16.6863 8.13401 14 12 14C15.866 14 19 16.6863 19 20" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: "문제집 수",
      count: counts.workbooks,
      href: "/admin/workbooks",
      color: "#3787FF",
      bgColor: "#EBF3FF",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5Z" stroke="#3787FF" strokeWidth="1.5"/>
          <path d="M8 7H16M8 11H16M8 15H12" stroke="#3787FF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: "OX퀴즈 수",
      count: counts.oxQuizSets,
      href: "/admin/ox-quiz",
      color: "#10B981",
      bgColor: "#ECFDF5",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="8" cy="12" r="4.5" stroke="#10B981" strokeWidth="1.5"/>
          <path d="M16 7.5L20 16.5M20 7.5L16 16.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: "영단어퀴즈 수",
      count: counts.vocabQuizSets,
      href: "/admin/vocab-quiz",
      color: "#8B5CF6",
      bgColor: "#F5F3FF",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" stroke="#8B5CF6" strokeWidth="1.5"/>
          <path d="M8 8H9.5L12 16L14.5 8H16" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: "문의 수",
      count: counts.inquiries,
      href: "/admin/inquiries",
      color: "#EF4444",
      bgColor: "#FEF2F2",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V14C20 15.1046 19.1046 16 18 16H10L5 20V16H6C4.89543 16 4 15.1046 4 14V6Z" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 9H16M8 12H12" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#2B313D" }}>관리자 대시보드</h1>
        <p style={{ fontSize: 14, color: "#8A909C", marginTop: 4 }}>Stady 서비스 현황을 한눈에 확인하세요</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div style={{ width: 28, height: 28, border: "3px solid #E5E7EB", borderTopColor: "#3787FF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="press"
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #E5E7EB",
                  padding: "20px 18px",
                  textDecoration: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "box-shadow 0.2s, transform 0.2s",
                  display: "block",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, background: card.bgColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {card.icon}
                  </div>
                </div>
                <p style={{ fontSize: 28, fontWeight: 700, color: "#2B313D", lineHeight: 1 }}>{card.count}</p>
                <p style={{ fontSize: 13, color: "#8A909C", marginTop: 6, fontWeight: 500 }}>{card.label}</p>
              </Link>
            ))}
          </div>

          {/* Recent Users & Inquiries Side by Side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }} className="admin-dashboard-grid">
            {/* Recent Users */}
            <div style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: "1px solid #F3F4F6",
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#2B313D" }}>최근 가입 회원</h2>
                <span style={{ fontSize: 12, color: "#8A909C" }}>최근 5명</span>
              </div>
              {recentUsers.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#8A909C", fontSize: 14 }}>
                  가입한 회원이 없습니다.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>닉네임</th>
                      <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>이메일</th>
                      <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>경로</th>
                      <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((user) => (
                      <tr key={user.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", background: "#EBF3FF",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 600, color: "#3787FF", flexShrink: 0,
                            }}>
                              {user.nickname.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 600, color: "#2B313D" }}>{user.nickname}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px", color: "#8A909C" }}>{user.email}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 4,
                            background: "#F3F4F6", color: "#6B7280", fontWeight: 500,
                          }}>
                            {user.signupSource || "미응답"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "#8A909C", fontSize: 12 }}>
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Inquiries */}
            <div style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: "1px solid #F3F4F6",
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#2B313D" }}>최근 문의</h2>
                <Link href="/admin/inquiries" style={{ fontSize: 12, color: "#3787FF", textDecoration: "none", fontWeight: 500 }}>
                  전체보기
                </Link>
              </div>
              {recentInquiries.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#8A909C", fontSize: 14 }}>
                  접수된 문의가 없습니다.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>제목</th>
                      <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>카테고리</th>
                      <th style={{ textAlign: "center", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>상태</th>
                      <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600, color: "#8A909C", fontSize: 12 }}>접수일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInquiries.map((inq) => (
                      <tr key={inq.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 500, color: "#2B313D", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inq.title}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#8A909C" }}>{inq.category}</td>
                        <td style={{ padding: "10px 16px", textAlign: "center" }}>
                          <span style={{
                            fontSize: 11, padding: "3px 10px", borderRadius: 10,
                            fontWeight: 600,
                            ...getStatusStyle(inq.status),
                          }}>
                            {inq.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "#8A909C", fontSize: 12 }}>
                          {formatDate(inq.createdAt)}
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
            <div style={{ marginTop: 24 }}>
              <div style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "16px 20px", borderBottom: "1px solid #F3F4F6",
                }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#2B313D" }}>가입 경로 통계</h2>
                </div>
                <div style={{ padding: 20 }}>
                  {(() => {
                    const maxCount = Math.max(...sourceStats.map((s) => s.count), 1);
                    const colors = ["#3787FF", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4"];
                    return sourceStats
                      .sort((a, b) => b.count - a.count)
                      .map((stat, i) => (
                        <div key={stat.source} style={{ marginBottom: i < sourceStats.length - 1 ? 14 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#2B313D" }}>{stat.source}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: colors[i % colors.length] }}>{stat.count}명</span>
                          </div>
                          <div style={{ height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${(stat.count / maxCount) * 100}%`,
                                backgroundColor: colors[i % colors.length],
                                borderRadius: 4,
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
        @media (max-width: 900px) {
          .admin-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
