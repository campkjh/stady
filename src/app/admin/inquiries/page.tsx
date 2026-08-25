"use client";

import { useEffect, useState } from "react";
import { EmptyInquiryIcon } from "@/components/admin/admin-icons";

interface Inquiry {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  category: string;
  title: string;
  content: string;
  status: string;
  reply: string | null;
  createdAt: string;
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("완료");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  async function fetchInquiries() {
    try {
      const res = await fetch("/api/inquiries", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setReplyText("");
    } else {
      setExpandedId(id);
      const inquiry = inquiries.find((i) => i.id === id);
      setReplyText(inquiry?.reply || "");
      setReplyStatus(inquiry?.status === "완료" ? "완료" : "처리중");
    }
  }

  async function handleReply(id: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: replyStatus, reply: replyText }),
        credentials: "include",
      });
      if (res.ok) {
        await fetchInquiries();
        setExpandedId(null);
        setReplyText("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // 완료는 강조 알약(#EAF2FF/#3180F7), 접수·처리중은 중립 알약(#F2F3F5/#51535C).
  const statusColors: Record<string, { bg: string; text: string }> = {
    "접수": { bg: JC.soft, text: JC.body },
    "처리중": { bg: "var(--c-warn-soft-2)", text: "var(--c-warn-c)" },
    "완료": { bg: JC.accentBg, text: JC.accent },
  };

  function statusBadge(status: string) {
    const c = statusColors[status] || statusColors["접수"];
    return (
      <span style={{
        display: "inline-block", padding: "4px 12px", borderRadius: 999,
        fontSize: 12, fontWeight: 700, background: c.bg, color: c.text,
      }}>
        {status}
      </span>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 13,
    border: `1px solid ${JC.soft}`,
    background: "var(--c-bg)",
    fontSize: 14,
    color: JC.title,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: JC.title }}>문의 관리</h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: JC.sub, marginTop: 6 }}>총 {inquiries.length}개의 문의</p>
      </div>

      {inquiries.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <EmptyInquiryIcon
            size={48}
            style={{ margin: "0 auto 12px", display: "block", color: "#C9CFD6" }}
            aria-hidden="true"
          />
          <p style={{ color: JC.sub, fontSize: 15 }}>접수된 문의가 없습니다.</p>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "100px 70px 90px minmax(200px, 1fr) 80px",
            minWidth: 620,
            padding: "14px 20px",
            borderBottom: `1px solid ${JC.soft}`,
            fontSize: 12,
            fontWeight: 600,
            color: JC.sub,
          }}>
            <span>날짜</span>
            <span>유형</span>
            <span>이름</span>
            <span>제목</span>
            <span style={{ textAlign: "center" }}>상태</span>
          </div>

          {/* Rows — 줄무늬 대신 면과 구분선으로만 나눈다 */}
          {inquiries.map((inquiry, idx) => (
            <div key={inquiry.id} style={{ minWidth: 620 }}>
              <div
                onClick={() => toggleExpand(inquiry.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 70px 90px minmax(200px, 1fr) 80px",
                  padding: "16px 20px",
                  borderBottom: idx === inquiries.length - 1 ? "none" : `1px solid ${JC.soft}`,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  background: expandedId === inquiry.id ? JC.accentBg : "var(--c-bg)",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = expandedId === inquiry.id ? JC.accentBg : JC.soft}
                onMouseLeave={(e) =>
                  e.currentTarget.style.background = expandedId === inquiry.id ? JC.accentBg : "var(--c-bg)"
                }
              >
                <span style={{ color: JC.sub, fontSize: 13, fontWeight: 400 }}>{formatDate(inquiry.createdAt)}</span>
                <span style={{ color: JC.body, fontSize: 13, fontWeight: 500 }}>{inquiry.category}</span>
                <span style={{ color: JC.body, fontWeight: 600, fontSize: 13 }}>{inquiry.name}</span>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: JC.title, fontWeight: 700,
                }}>
                  {inquiry.title}
                </span>
                <span style={{ textAlign: "center" }}>{statusBadge(inquiry.status)}</span>
              </div>

              {/* Expanded detail — 클릭한 행 바로 아래에 인라인으로 펼친다.
                  표는 minWidth 620 가로스크롤이라, 상세는 sticky+left0 로
                  왼쪽에 붙이고 폭은 .inq-detail 미디어쿼리로 화면폭에 맞춘다
                  (모바일 calc(100vw-32) / 데스크톱 100%). 그래서 오른쪽이
                  잘리지 않는다. */}
              {expandedId === inquiry.id && (
                <div
                  className="inq-detail"
                  style={{
                    background: JC.soft,
                    borderTop: `1px solid ${JC.soft}`,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {/* Email */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 13, fontWeight: 400, color: JC.sub, marginBottom: 12,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="#8A909C" strokeWidth="1.2"/>
                      <path d="M1 4.5L7 8L13 4.5" stroke="#8A909C" strokeWidth="1.2"/>
                    </svg>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{inquiry.email}</span>
                  </div>

                  {/* Content */}
                  <div style={{
                    background: "var(--c-bg)",
                    borderRadius: 13,
                    border: `1px solid ${JC.soft}`,
                    padding: 16,
                    marginBottom: 16,
                    fontSize: 14,
                    fontWeight: 500,
                    color: JC.body,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    lineHeight: 1.7,
                  }}>
                    {inquiry.content}
                  </div>

                  {/* Existing reply */}
                  {inquiry.reply && (
                    <div style={{
                      background: JC.accentBg,
                      borderRadius: 13,
                      padding: 16,
                      marginBottom: 16,
                      fontSize: 14,
                      fontWeight: 500,
                      color: JC.title,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      lineHeight: 1.7,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: JC.accent, marginBottom: 6 }}>관리자 답변</div>
                      {inquiry.reply}
                    </div>
                  )}

                  {/* Reply form */}
                  <div style={{
                    background: "var(--c-bg)",
                    borderRadius: 13,
                    border: `1px solid ${JC.soft}`,
                    padding: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: JC.title, marginBottom: 12 }}>답변 작성</div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: JC.body, marginBottom: 6 }}>상태 변경</label>
                      <select
                        value={replyStatus}
                        onChange={(e) => setReplyStatus(e.target.value)}
                        style={{
                          ...inputStyle,
                          width: 130,
                          appearance: "auto" as const,
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                      >
                        <option value="접수">접수</option>
                        <option value="처리중">처리중</option>
                        <option value="완료">완료</option>
                      </select>
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="답변을 입력하세요"
                      rows={3}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        minHeight: 80,
                        marginBottom: 12,
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="press"
                        onClick={() => handleReply(inquiry.id)}
                        disabled={submitting}
                        style={{
                          padding: "11px 24px",
                          borderRadius: 13,
                          border: "none",
                          background: JC.accent,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: submitting ? "not-allowed" : "pointer",
                          opacity: submitting ? 0.6 : 1,
                          boxShadow: "none",
                        }}
                      >
                        {submitting ? "저장 중..." : "답변 저장"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{JC_FOCUS_CSS}</style>
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
  boxShadow: "none",
};

/* 인라인 style 로는 :focus 를 못 준다. 포커스 테두리만 클래스로 뺀다.
   page.tsx 는 default 외 named export 가 금지라 모듈 로컬 상수로 둔다. */
const JC_FOCUS_CSS = `
  .jc-admin input:focus,
  .jc-admin textarea:focus,
  .jc-admin select:focus { border-color: #3180F7 !important; }

  /* 펼친 상세: 표는 minWidth 620 가로스크롤이라 상세를 왼쪽에 sticky 로
     붙이고, 폭은 화면폭에 맞춰 오른쪽 잘림을 없앤다. 데스크톱은 카드 전체폭. */
  .inq-detail {
    position: sticky;
    left: 0;
    box-sizing: border-box;
    width: 100%;
    padding: 20px 24px;
  }
  @media (max-width: 768px) {
    .inq-detail {
      width: calc(100vw - 32px);
      padding: 16px 12px;
    }
  }
`;
