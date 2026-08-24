"use client";

import { useCallback, useEffect, useState } from "react";

// 커뮤니티 신고 처리 화면. 사용자가 ReportBlockMenu 로 넣은 신고가 여기에 쌓인다.
// (App Store 가이드라인 1.2 — 신고에 "적시에 대응"하는 창구)

interface AdminReport {
  id: string;
  targetType: "post" | "comment" | string;
  postId: string | null;
  commentId: string | null;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reporterNickname: string;
  targetNickname: string;
  postTitle: string | null;
  commentContent: string | null;
  contentActive: boolean | null;
}

const FILTERS = ["접수", "전체", "처리완료", "반려"] as const;

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("접수");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const query = filter === "전체" ? "" : `?status=${encodeURIComponent(filter)}`;
    fetch(`/api/admin/community-reports${query}`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "신고를 불러오지 못했습니다.");
        setReports(data.reports || []);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "신고를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(load, [load]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const response = await fetch("/api/admin/community-reports", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "처리하지 못했습니다.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "var(--c-text)", fontSize: 26, fontWeight: 900 }}>신고 관리</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            style={{
              border: "1px solid var(--c-border)",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: filter === item ? "var(--c-brand-b)" : "var(--c-bg)",
              color: filter === item ? "#fff" : "var(--c-text-3)",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {message && <p style={{ margin: 0, color: "var(--c-danger-c)", fontSize: 14 }}>{message}</p>}

      <div style={{ border: "1px solid var(--c-border)", borderRadius: 8, background: "var(--c-bg)", padding: 20 }}>
        {loading ? (
          <p style={{ margin: 0, color: "var(--c-text-3)", fontSize: 14 }}>불러오는 중…</p>
        ) : reports.length === 0 ? (
          <p style={{ margin: 0, color: "var(--c-text-3)", fontSize: 14 }}>
            {filter === "접수" ? "처리할 신고가 없습니다." : "신고 내역이 없습니다."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reports.map((report) => (
              <article
                key={report.id}
                style={{ border: "1px solid var(--c-border)", borderRadius: 10, padding: 14, display: "grid", gap: 8 }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: "var(--c-danger-soft-3)", color: "var(--c-danger-c)" }}>
                    {report.reason}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--c-bg-muted-2)", color: "var(--c-text-3)" }}>
                    {report.targetType === "comment" ? "댓글" : "게시글"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: report.status === "접수" ? "var(--c-warn-soft-2)" : "var(--c-bg-muted-2)", color: report.status === "접수" ? "var(--c-warn-c)" : "var(--c-text-3)" }}>
                    {report.status}
                  </span>
                  {report.contentActive === false && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-4)" }}>· 이미 삭제된 콘텐츠</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-text-4)" }}>
                    {new Date(report.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 13.5, color: "var(--c-text-3)" }}>
                  신고한 사람 <strong style={{ color: "var(--c-text-2c)" }}>{report.reporterNickname}</strong>
                  {" · "}대상 <strong style={{ color: "var(--c-text-2c)" }}>{report.targetNickname}</strong>
                </p>

                <p style={{ margin: 0, fontSize: 14, color: "var(--c-text-2c)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {report.targetType === "comment"
                    ? report.commentContent || "(삭제된 댓글)"
                    : report.postTitle || "(삭제된 게시글)"}
                </p>
                {report.detail && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-4)" }}>신고 내용: {report.detail}</p>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {report.postId && (
                    <a
                      href={`/community/${report.postId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, fontWeight: 700, color: "var(--c-brand-b)", textDecoration: "none", padding: "6px 0" }}
                    >
                      원문 보기 ↗
                    </a>
                  )}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {report.status !== "처리완료" && (
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => updateStatus(report.id, "처리완료")}
                        style={actionStyle("var(--c-brand-b)", "#fff", busyId === report.id)}
                      >
                        처리완료
                      </button>
                    )}
                    {report.status !== "반려" && (
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => updateStatus(report.id, "반려")}
                        style={actionStyle("var(--c-bg-muted-2)", "var(--c-text-3b)", busyId === report.id)}
                      >
                        반려
                      </button>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function actionStyle(bg: string, color: string, disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 700,
    background: bg,
    color,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}
