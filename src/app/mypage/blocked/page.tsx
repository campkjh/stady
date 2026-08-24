"use client";

import { useCallback, useEffect, useState } from "react";
import LoginRequired from "@/components/LoginRequired";
import BackHeader from "@/components/BackHeader";

// 차단한 사용자 목록 / 해제 화면.
// 커뮤니티에서 "이 사용자 차단하기"로 숨긴 사람을 여기서 되돌린다.

interface BlockedUser {
  userId: string;
  nickname: string;
  createdAt: string;
  postCount: number;
  commentCount: number;
}

interface HiddenPost {
  id: string;
  title: string;
  createdAt: string;
}
interface HiddenComment {
  id: string;
  postId: string;
  postTitle: string | null;
  content: string;
  createdAt: string;
}

export default function BlockedUsersPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // 펼친 사용자의 숨겨진 글·댓글(차단 해제 판단용). userId → 내용.
  const [openId, setOpenId] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, { posts: HiddenPost[]; comments: HiddenComment[] }>>({});
  const [contentBusy, setContentBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/community/blocks", { credentials: "include" });
      if (response.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "불러오지 못했어요.");
      setAuthed(true);
      setBlocks(data.blocks || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 숨겨진 글·댓글은 펼칠 때 한 번만 불러온다.
  async function toggleContent(userId: string) {
    if (openId === userId) {
      setOpenId(null);
      return;
    }
    setOpenId(userId);
    if (content[userId]) return;
    setContentBusy(true);
    try {
      const response = await fetch(`/api/community/blocks?userId=${encodeURIComponent(userId)}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "불러오지 못했어요.");
      setContent((prev) => ({ ...prev, [userId]: { posts: data.posts || [], comments: data.comments || [] } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "불러오지 못했어요.");
    } finally {
      setContentBusy(false);
    }
  }

  async function unblock(userId: string) {
    setBusyId(userId);
    try {
      // 같은 토글 API — 이미 차단된 상대라 호출하면 해제된다.
      const response = await fetch("/api/community/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "해제하지 못했어요.");
      setBlocks((prev) => prev.filter((item) => item.userId !== userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "해제하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  if (authed === false) return <LoginRequired />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <BackHeader title="차단한 사용자" />
      <div style={{ padding: "8px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
        <p style={{ margin: "10px 0 18px", fontSize: 13.5, color: "var(--c-text-4b)", lineHeight: 1.6 }}>
          차단한 사용자의 글과 댓글은 커뮤니티에서 보이지 않아요. 차단 사실은 상대에게 알려지지 않습니다.
        </p>

        {message && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--c-danger-h)" }}>{message}</p>
        )}

        {loading ? (
          <p style={{ fontSize: 14, color: "var(--c-text-4b)" }}>불러오는 중…</p>
        ) : blocks.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--c-text-4b)" }}>차단한 사용자가 없어요.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {blocks.map((item) => (
              <li
                key={item.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid var(--c-border)",
                  borderRadius: 14,
                  padding: "12px 14px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.nickname}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--c-text-4b)", marginTop: 2 }}>
                    {new Date(item.createdAt).toLocaleDateString("ko-KR")} 차단 · 숨긴 글 {item.postCount} · 댓글 {item.commentCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleContent(item.userId)}
                    style={{ border: "none", background: "none", padding: "6px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--c-brand-b)", cursor: "pointer" }}
                  >
                    {openId === item.userId ? "숨긴 글·댓글 접기" : "숨긴 글·댓글 보기"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => unblock(item.userId)}
                  disabled={busyId === item.userId}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: "var(--c-bg-muted-2)",
                    color: "var(--c-text-3b)",
                    cursor: busyId === item.userId ? "default" : "pointer",
                    opacity: busyId === item.userId ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {busyId === item.userId ? "처리 중…" : "차단 해제"}
                </button>
                {openId === item.userId && (
                  <div style={{ flexBasis: "100%", borderTop: "1px solid var(--c-border)", marginTop: 4, paddingTop: 10 }}>
                    {contentBusy && !content[item.userId] ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-4b)" }}>불러오는 중…</p>
                    ) : (
                      <>
                        <HiddenList
                          title="숨긴 글"
                          empty="숨겨진 글이 없어요."
                          items={(content[item.userId]?.posts || []).map((post) => ({
                            key: post.id,
                            href: `/community/${post.id}`,
                            text: post.title,
                            date: post.createdAt,
                          }))}
                        />
                        <HiddenList
                          title="숨긴 댓글"
                          empty="숨겨진 댓글이 없어요."
                          items={(content[item.userId]?.comments || []).map((comment) => ({
                            key: comment.id,
                            href: `/community/${comment.postId}`,
                            text: comment.content,
                            date: comment.createdAt,
                          }))}
                        />
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// 차단으로 숨겨진 글/댓글 목록. 눌러서 원문으로 갈 수 있다(차단 상태에서도 상세는 열린다).
function HiddenList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { key: string; href: string; text: string; date: string }[];
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--c-text-4b)", marginBottom: 6 }}>
        {title} {items.length > 0 && `(${items.length})`}
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-text-4b)" }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {items.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                style={{
                  display: "block",
                  textDecoration: "none",
                  background: "var(--c-bg-soft)",
                  borderRadius: 10,
                  padding: "8px 10px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: "var(--c-text-2b)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.text}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-4b)", marginTop: 2 }}>
                  {new Date(item.date).toLocaleDateString("ko-KR")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
