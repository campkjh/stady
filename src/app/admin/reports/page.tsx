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

interface AdminBlock {
  blockerNickname: string;
  blockedId: string;
  blockedNickname: string;
  createdAt: string;
}
interface MostBlocked {
  userId: string;
  nickname: string;
  count: number;
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<"reports" | "blocks">("reports");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [blocks, setBlocks] = useState<AdminBlock[]>([]);
  const [mostBlocked, setMostBlocked] = useState<MostBlocked[]>([]);
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

  useEffect(() => {
    if (tab === "reports") load();
  }, [tab, load]);

  useEffect(() => {
    if (tab !== "blocks") return;
    setLoading(true);
    fetch("/api/admin/community-blocks", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "차단 현황을 불러오지 못했습니다.");
        setBlocks(data.blocks || []);
        setMostBlocked(data.mostBlocked || []);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "차단 현황을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [tab]);

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
    <section style={{ display: "grid", gap: 20 }}>
      <h1 style={{ margin: 0, color: JC.title, fontSize: 26, fontWeight: 700 }}>신고·차단 관리</h1>

      {/* 탭 — 구분선 대신 알약 트랙(#F2F3F5) 위에 흰 알약을 얹는다 */}
      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, background: JC.soft, width: "fit-content" }}>
        {([["reports", "신고 접수"], ["blocks", "차단 현황"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: tab === key ? 700 : 600,
              cursor: "pointer",
              color: tab === key ? JC.accent : JC.body,
              background: tab === key ? "var(--c-bg)" : "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: tab === "reports" ? "flex" : "none", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: filter === item ? 700 : 600,
              cursor: "pointer",
              background: filter === item ? JC.accentBg : JC.soft,
              color: filter === item ? JC.accent : JC.body,
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {message && <p style={{ margin: 0, color: "var(--c-danger-c)", fontSize: 14, fontWeight: 600 }}>{message}</p>}

      <div style={{ ...cardStyle, display: tab === "reports" ? "block" : "none", padding: 20 }}>
        {loading ? (
          <p style={{ margin: 0, color: JC.sub, fontSize: 14 }}>불러오는 중…</p>
        ) : reports.length === 0 ? (
          <p style={{ margin: 0, color: JC.sub, fontSize: 14 }}>
            {filter === "접수" ? "처리할 신고가 없습니다." : "신고 내역이 없습니다."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reports.map((report) => (
              <article
                key={report.id}
                style={{ border: `1px solid ${JC.soft}`, borderRadius: 13, padding: 16, display: "grid", gap: 8, boxShadow: "none" }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ ...chipBase, background: "var(--c-danger-soft-3)", color: "var(--c-danger-c)" }}>
                    {report.reason}
                  </span>
                  <span style={chipNeutral}>
                    {report.targetType === "comment" ? "댓글" : "게시글"}
                  </span>
                  <span style={report.status === "접수" ? { ...chipBase, background: "var(--c-warn-soft-2)", color: "var(--c-warn-c)" } : chipAccent}>
                    {report.status}
                  </span>
                  {report.contentActive === false && (
                    <span style={{ fontSize: 12, fontWeight: 400, color: JC.sub }}>· 이미 삭제된 콘텐츠</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 400, color: JC.sub }}>
                    {new Date(report.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 13.5, color: JC.body, fontWeight: 500 }}>
                  신고한 사람 <strong style={{ color: JC.title, fontWeight: 700 }}>{report.reporterNickname}</strong>
                  {" · "}대상 <strong style={{ color: JC.title, fontWeight: 700 }}>{report.targetNickname}</strong>
                </p>

                <p style={{ margin: 0, fontSize: 14, color: JC.title, fontWeight: 500, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {report.targetType === "comment"
                    ? report.commentContent || "(삭제된 댓글)"
                    : report.postTitle || "(삭제된 게시글)"}
                </p>
                {report.detail && (
                  <p style={{ margin: 0, fontSize: 13, color: JC.sub, fontWeight: 400 }}>신고 내용: {report.detail}</p>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {report.postId && (
                    <a
                      href={`/community/${report.postId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, fontWeight: 700, color: JC.accent, textDecoration: "none", padding: "6px 0" }}
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
                        style={actionStyle(JC.accent, "#fff", busyId === report.id)}
                      >
                        처리완료
                      </button>
                    )}
                    {report.status !== "반려" && (
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => updateStatus(report.id, "반려")}
                        style={actionStyle(JC.soft, JC.body, busyId === report.id)}
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
      {tab === "blocks" && (
        <div style={{ ...cardStyle, padding: 20, display: "grid", gap: 20 }}>
          {loading ? (
            <p style={{ margin: 0, color: JC.sub, fontSize: 14 }}>불러오는 중…</p>
          ) : (
            <>
              {mostBlocked.length > 0 && (
                <div>
                  <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: JC.title }}>
                    2명 이상에게 차단된 사용자
                  </h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {mostBlocked.map((item) => (
                      <span
                        key={item.userId}
                        style={{ ...chipBase, fontSize: 13, padding: "6px 14px", background: "var(--c-danger-soft-3)", color: "var(--c-danger-c)" }}
                      >
                        {item.nickname} · {item.count}명
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: JC.title }}>
                  최근 차단 ({blocks.length})
                </h2>
                {blocks.length === 0 ? (
                  <p style={{ margin: 0, color: JC.sub, fontSize: 14 }}>차단 기록이 없습니다.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                    {blocks.map((block, index) => (
                      <li
                        key={`${block.blockedId}-${index}`}
                        style={{ display: "flex", alignItems: "center", gap: 8, background: JC.soft, borderRadius: 13, padding: "12px 14px", fontSize: 13.5, fontWeight: 500, color: JC.body }}
                      >
                        <strong style={{ color: JC.title, fontWeight: 700 }}>{block.blockerNickname}</strong>
                        <span style={{ color: JC.sub }}>→</span>
                        <strong style={{ color: "var(--c-danger-c)", fontWeight: 700 }}>{block.blockedNickname}</strong>
                        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 400, color: JC.sub }}>
                          {new Date(block.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
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
  border: `1px solid ${JC.soft}`,
  borderRadius: 18,
  background: "var(--c-bg)",
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

function actionStyle(bg: string, color: string, disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 13,
    padding: "9px 18px",
    fontSize: 13,
    fontWeight: 600,
    background: bg,
    color,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}
