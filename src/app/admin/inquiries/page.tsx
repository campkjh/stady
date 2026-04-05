"use client";

import { useEffect, useState } from "react";

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

  const statusColors: Record<string, { bg: string; text: string }> = {
    "접수": { bg: "#DBEAFE", text: "#1D4ED8" },
    "처리중": { bg: "#FFFBEB", text: "#D97706" },
    "완료": { bg: "#ECFDF5", text: "#059669" },
  };

  function statusBadge(status: string) {
    const c = statusColors[status] || statusColors["접수"];
    return (
      <span style={{
        display: "inline-block", padding: "3px 10px", borderRadius: 20,
        fontSize: 12, fontWeight: 600, background: c.bg, color: c.text,
      }}>
        {status}
      </span>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #E5E7EB",
    fontSize: 14,
    color: "#2B313D",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#2B313D" }}>문의 관리</h1>
        <p style={{ fontSize: 14, color: "#8A909C", marginTop: 4 }}>총 {inquiries.length}개의 문의</p>
      </div>

      {inquiries.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB",
          padding: 48, textAlign: "center",
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 12px", display: "block" }}>
            <path d="M8 12C8 9.79 9.79 8 12 8H36C38.21 8 40 9.79 40 12V28C40 30.21 38.21 32 36 32H20L12 38V32H12C9.79 32 8 30.21 8 28V12Z" stroke="#E5E7EB" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          <p style={{ color: "#8A909C", fontSize: 15 }}>접수된 문의가 없습니다.</p>
        </div>
      ) : (
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB",
          overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "100px 70px 90px 1fr 80px",
            padding: "12px 20px",
            background: "#F9FAFB",
            borderBottom: "1px solid #E5E7EB",
            fontSize: 13,
            fontWeight: 600,
            color: "#8A909C",
          }}>
            <span>날짜</span>
            <span>유형</span>
            <span>이름</span>
            <span>제목</span>
            <span style={{ textAlign: "center" }}>상태</span>
          </div>

          {/* Rows */}
          {inquiries.map((inquiry, idx) => (
            <div key={inquiry.id}>
              <div
                onClick={() => toggleExpand(inquiry.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 70px 90px 1fr 80px",
                  padding: "14px 20px",
                  borderBottom: "1px solid #F3F4F6",
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  background: expandedId === inquiry.id ? "#F9FAFB" : idx % 2 === 1 ? "#FAFBFC" : "#fff",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F5F7FA"}
                onMouseLeave={(e) =>
                  e.currentTarget.style.background =
                    expandedId === inquiry.id ? "#F9FAFB" : idx % 2 === 1 ? "#FAFBFC" : "#fff"
                }
              >
                <span style={{ color: "#8A909C", fontSize: 13 }}>{formatDate(inquiry.createdAt)}</span>
                <span style={{ color: "#2B313D", fontSize: 13 }}>{inquiry.category}</span>
                <span style={{ color: "#2B313D", fontWeight: 500, fontSize: 13 }}>{inquiry.name}</span>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: "#2B313D", fontWeight: 500,
                }}>
                  {inquiry.title}
                </span>
                <span style={{ textAlign: "center" }}>{statusBadge(inquiry.status)}</span>
              </div>

              {/* Expanded detail */}
              {expandedId === inquiry.id && (
                <div style={{
                  padding: "20px 24px",
                  background: "#F9FAFB",
                  borderBottom: "1px solid #E5E7EB",
                }}>
                  {/* Email */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 13, color: "#8A909C", marginBottom: 12,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="#8A909C" strokeWidth="1.2"/>
                      <path d="M1 4.5L7 8L13 4.5" stroke="#8A909C" strokeWidth="1.2"/>
                    </svg>
                    {inquiry.email}
                  </div>

                  {/* Content */}
                  <div style={{
                    background: "#fff",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    padding: 16,
                    marginBottom: 16,
                    fontSize: 14,
                    color: "#2B313D",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                  }}>
                    {inquiry.content}
                  </div>

                  {/* Existing reply */}
                  {inquiry.reply && (
                    <div style={{
                      background: "#EBF3FF",
                      borderRadius: 10,
                      padding: 16,
                      marginBottom: 16,
                      fontSize: 14,
                      color: "#1D4ED8",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.7,
                      borderLeft: "3px solid #3787FF",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#3787FF", marginBottom: 6 }}>관리자 답변</div>
                      {inquiry.reply}
                    </div>
                  )}

                  {/* Reply form */}
                  <div style={{
                    background: "#fff",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    padding: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#2B313D", marginBottom: 12 }}>답변 작성</div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8A909C", marginBottom: 4 }}>상태 변경</label>
                        <select
                          value={replyStatus}
                          onChange={(e) => setReplyStatus(e.target.value)}
                          style={{
                            ...inputStyle,
                            width: 130,
                            appearance: "auto" as const,
                          }}
                        >
                          <option value="접수">접수</option>
                          <option value="처리중">처리중</option>
                          <option value="완료">완료</option>
                        </select>
                      </div>
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
                      onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="press"
                        onClick={() => handleReply(inquiry.id)}
                        disabled={submitting}
                        style={{
                          padding: "9px 24px",
                          borderRadius: 8,
                          border: "none",
                          background: "#3787FF",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: submitting ? "not-allowed" : "pointer",
                          opacity: submitting ? 0.6 : 1,
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
    </div>
  );
}
