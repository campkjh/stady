"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FollowButton from "@/components/community/FollowButton";
import { TossHeartIcon, TossCommentIcon, TossRepostIcon, formatCount } from "@/components/community/TossIcons";
import { boardShortName, boardTone } from "@/lib/boardTone";
import { formatRelativeTime } from "@/lib/relativeTime";

// 글·댓글 작성자를 누르면 열리는 유저 프로필(토스 커뮤니티 프로필 화면 구성):
//   위: 뒤로가기 · 차단 / 가운데 사진·이름·팔로워·팔로잉 / 한 줄 팔로우 버튼
//   아래: 탭(최근 활동 · 배지) + 칩(전체 · 남긴 글 · 남긴 댓글) + 활동 카드

interface ProfileUser {
  id: string;
  nickname: string;
  avatar: string | null;
  tier: string;
  isAdmin: boolean;
  isAnswerKing: boolean;
  isPickKing: boolean;
  isMe: boolean;
}
interface ProfilePost {
  id: string;
  title: string;
  content: string;
  groupName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}
interface ProfileRepost {
  id: string;
  title: string;
  content: string;
  groupName: string;
  authorName: string;
  createdAt: string; // 리포스트한 시각
  likeCount: number;
  commentCount: number;
}
interface ProfileComment {
  id: string;
  postId: string;
  postTitle: string;
  content: string;
  createdAt: string;
  likeCount: number;
}
interface ProfileData {
  user: ProfileUser;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
  posts: ProfilePost[];
  reposts: ProfileRepost[];
  comments: ProfileComment[];
}

const TIER_LABELS: Record<string, string> = {
  iron: "아이언",
  silver: "실버",
  gold: "골드",
  emerald: "에메랄드",
  diamond: "다이아",
  master: "마스터",
  grandmaster: "그랜드마스터",
  gongsin: "공신",
};

type Activity =
  | { kind: "post"; at: string; post: ProfilePost }
  | { kind: "repost"; at: string; repost: ProfileRepost }
  | { kind: "comment"; at: string; comment: ProfileComment };

export default function CommunityUserProfileClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"activity" | "badge">("activity");
  const [chip, setChip] = useState<"all" | "post" | "comment" | "repost">("all");
  const [followBusy, setFollowBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/users/${encodeURIComponent(userId)}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "프로필을 불러오지 못했어요.");
      setData(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로필을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 1800);
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/community");
  }

  async function toggleFollow() {
    if (!data || followBusy) return;
    const was = data.isFollowing;
    const base = data.followerCount;
    setFollowBusy(true);
    setData({ ...data, isFollowing: !was, followerCount: Math.max(0, base + (was ? -1 : 1)) });
    try {
      const res = await fetch("/api/community/follows", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "팔로우하지 못했어요.");
      setData((cur) => (cur ? { ...cur, isFollowing: !!json.following, followerCount: typeof json.followerCount === "number" ? json.followerCount : base } : cur));
    } catch (e) {
      setData((cur) => (cur ? { ...cur, isFollowing: was, followerCount: base } : cur));
      showToast(e instanceof Error ? e.message : "팔로우하지 못했어요.");
    } finally {
      setFollowBusy(false);
    }
  }

  async function toggleBlock() {
    if (!data || blockBusy) return;
    setBlockBusy(true);
    try {
      const res = await fetch("/api/community/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "차단하지 못했어요.");
      showToast(json.blocked ? "차단했어요. 이 사용자의 글과 댓글이 보이지 않아요." : "차단을 풀었어요.");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "차단하지 못했어요.");
    } finally {
      setBlockBusy(false);
    }
  }

  const activities = useMemo<Activity[]>(() => {
    if (!data) return [];
    const items: Activity[] = [];
    if (chip === "all" || chip === "post") data.posts.forEach((post) => items.push({ kind: "post", at: post.createdAt, post }));
    if (chip === "all" || chip === "repost") (data.reposts || []).forEach((repost) => items.push({ kind: "repost", at: repost.createdAt, repost }));
    if (chip === "all" || chip === "comment") data.comments.forEach((comment) => items.push({ kind: "comment", at: comment.createdAt, comment }));
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [data, chip]);

  const user = data?.user;

  return (
    <main className="up-page">
      <div className="up-top">
        <div className="up-nav">
          <button type="button" className="up-back" onClick={goBack} aria-label="뒤로가기">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {user && !user.isMe && (
            <button type="button" className="up-block" onClick={toggleBlock} disabled={blockBusy}>
              {data?.isBlocked ? "차단 해제" : "차단"}
            </button>
          )}
        </div>
        {loading ? (
          <div className="up-head" aria-busy="true">
            <span className="up-sk" style={{ width: 74, height: 74, borderRadius: "50%" }} />
            <span className="up-sk" style={{ width: 160, height: 26, marginTop: 14 }} />
            <span className="up-sk" style={{ width: 120, height: 16, marginTop: 10 }} />
          </div>
        ) : user && data ? (
          <>
            <div className="up-head">
              <span className="up-ava" aria-hidden="true">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
                ) : (
                  user.nickname.slice(0, 1)
                )}
              </span>
              <h1 className="up-name">{user.nickname}</h1>
              <p className="up-counts">
                <span>팔로워 <b>{formatCount(data.followerCount)}</b></span>
                <span>팔로잉 <b>{formatCount(data.followingCount)}</b></span>
              </p>
            </div>
            {!user.isMe && (
              <div className="up-follow">
                <FollowButton block following={data.isFollowing} busy={followBusy} onToggle={toggleFollow} />
              </div>
            )}
          </>
        ) : (
          <div className="up-head">
            <p className="up-error">{error || "사용자를 찾을 수 없어요."}</p>
          </div>
        )}
      </div>

      {data && user && (
        <section className="up-body">
          <div className="up-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "activity"} className={`up-tab${tab === "activity" ? " on" : ""}`} onClick={() => setTab("activity")}>
              최근 활동
            </button>
            <button type="button" role="tab" aria-selected={tab === "badge"} className={`up-tab${tab === "badge" ? " on" : ""}`} onClick={() => setTab("badge")}>
              배지
            </button>
            <span className="up-tab-bar" style={{ transform: `translateX(${tab === "activity" ? 0 : 100}%)` }} aria-hidden="true" />
          </div>

          {tab === "activity" ? (
            <>
              <div className="up-chips">
                {([["all", "전체"], ["post", "남긴 글"], ["comment", "남긴 댓글"], ["repost", "리포스트"]] as const).map(([key, label]) => (
                  <button key={key} type="button" className={`up-chip${chip === key ? " on" : ""}`} onClick={() => setChip(key)}>
                    {label}
                  </button>
                ))}
              </div>
              {data.isBlocked ? (
                <p className="up-empty">차단한 사용자예요. 차단을 풀면 활동이 다시 보여요.</p>
              ) : activities.length === 0 ? (
                <p className="up-empty">아직 활동이 없어요.</p>
              ) : (
                <div className="up-list">
                  {activities.map((a) =>
                    a.kind === "post" ? (
                      <button key={`p-${a.post.id}`} type="button" className="up-item" onClick={() => router.push(`/community/${a.post.id}`)}>
                        <span className="up-item-head">
                          <span className="up-board" style={{ background: boardTone(a.post.groupName).bg, color: boardTone(a.post.groupName).color }}>
                            {boardShortName(a.post.groupName)}
                          </span>
                          <span className="up-item-who">
                            <span className="up-item-title">{boardShortName(a.post.groupName)}에 남긴 글</span>
                            <span className="up-item-time">{formatRelativeTime(a.at)}</span>
                          </span>
                        </span>
                        <span className="up-post-title">{a.post.title}</span>
                        {a.post.content && <span className="up-post-content">{a.post.content}</span>}
                        <span className="up-metrics">
                          <span><TossHeartIcon /> {a.post.likeCount}</span>
                          <span><TossCommentIcon /> {a.post.commentCount}</span>
                        </span>
                      </button>
                    ) : a.kind === "repost" ? (
                      <button key={`r-${a.repost.id}`} type="button" className="up-item" onClick={() => router.push(`/community/${a.repost.id}`)}>
                        <span className="up-item-head">
                          <span className="up-board is-repost" aria-hidden="true"><TossRepostIcon /></span>
                          <span className="up-item-who">
                            <span className="up-item-title">{a.repost.authorName}님의 글을 리포스트</span>
                            <span className="up-item-time">{boardShortName(a.repost.groupName)} · {formatRelativeTime(a.at)}</span>
                          </span>
                        </span>
                        <span className="up-post-title">{a.repost.title}</span>
                        {a.repost.content && <span className="up-post-content">{a.repost.content}</span>}
                        <span className="up-metrics">
                          <span><TossHeartIcon /> {a.repost.likeCount}</span>
                          <span><TossCommentIcon /> {a.repost.commentCount}</span>
                        </span>
                      </button>
                    ) : (
                      <button key={`c-${a.comment.id}`} type="button" className="up-item" onClick={() => router.push(`/community/${a.comment.postId}`)}>
                        <span className="up-item-head">
                          <span className="up-board is-comment" aria-hidden="true"><TossCommentIcon /></span>
                          <span className="up-item-who">
                            <span className="up-item-title">{a.comment.postTitle}</span>
                            <span className="up-item-time">댓글 · {formatRelativeTime(a.at)}</span>
                          </span>
                        </span>
                        <span className="up-post-content is-strong">{a.comment.content}</span>
                        <span className="up-metrics">
                          <span><TossHeartIcon /> {a.comment.likeCount}</span>
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="up-badges">
              <div className="up-badge-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/tier-${user.tier}.svg`} alt="" width={56} height={56} />
                <p className="up-badge-name">{TIER_LABELS[user.tier] ?? "아이언"}</p>
                <p className="up-badge-desc">현재 등급</p>
              </div>
              {user.isAnswerKing && (
                <div className="up-badge-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/toss/crown.svg" alt="" width={56} height={56} />
                  <p className="up-badge-name">답변왕</p>
                  <p className="up-badge-desc">최근 7일 댓글 10개 이상</p>
                </div>
              )}
              {user.isPickKing && (
                <div className="up-badge-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/toss/medal-check.svg" alt="" width={56} height={56} />
                  <p className="up-badge-name">채택왕</p>
                  <p className="up-badge-desc">최근 7일 채택된 댓글 5개 이상</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {toast && <div className="up-toast" role="status">{toast}</div>}

      <style>{`
        .up-page { min-height: 100vh; background: var(--c-bg); color: var(--c-text); padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px)); }
        .up-top { background: var(--c-bg-soft, #f7f8fa); padding: calc(8px + env(safe-area-inset-top, 0px)) 20px 20px; }
        .up-nav { display: flex; align-items: center; justify-content: space-between; height: 48px; margin: 0 -8px; }
        .up-back { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: none; background: none; color: var(--c-text); cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .up-block { padding: 8px; border: none; background: none; color: var(--c-text-3, #6b7684); font-size: 17px; font-weight: 600; letter-spacing: -0.3px; font-family: inherit; cursor: pointer; }
        .up-block:disabled { opacity: 0.5; }
        .up-head { display: flex; flex-direction: column; align-items: center; padding: 6px 0 18px; animation: mdlRise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
        .up-ava { width: 74px; height: 74px; border-radius: 50%; overflow: hidden; background: var(--c-bg-muted, #eceff3); color: #a3acb8; font-size: 30px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
        .up-ava img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .up-name { margin: 12px 0 0; font-size: 23px; font-weight: 700; letter-spacing: -0.5px; text-align: center; overflow-wrap: anywhere; }
        .up-counts { margin: 8px 0 0; display: flex; gap: 14px; color: var(--c-text-4c, #8b95a1); font-size: 16px; font-weight: 500; letter-spacing: -0.3px; }
        .up-counts b { color: var(--c-text-3, #6b7684); font-weight: 600; }
        .up-follow { animation: mdlRise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) 0.08s backwards; }
        .up-error { margin: 40px 0; color: var(--c-text-4); font-size: 15px; font-weight: 600; }
        .up-sk { display: block; border-radius: 8px; background: var(--c-bg-muted-6, rgba(0,0,0,0.06)); animation: cpdSkPulse 1.4s ease-in-out infinite; }
        .up-body { animation: mdlRise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) 0.12s backwards; }
        .up-tabs { position: relative; display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--c-bg-muted-6, #f2f4f6); }
        .up-tab { height: 56px; border: none; background: none; color: var(--c-text-4c, #8b95a1); font-size: 18px; font-weight: 600; letter-spacing: -0.3px; font-family: inherit; cursor: pointer; transition: color 0.2s ease; -webkit-tap-highlight-color: transparent; }
        .up-tab.on { color: var(--c-text); font-weight: 700; }
        .up-tab-bar { position: absolute; left: 0; bottom: -1px; width: 50%; height: 3px; background: var(--c-text); transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1); }
        .up-chips { display: flex; gap: 6px; padding: 16px 20px 8px; }
        .up-chip { height: 40px; padding: 0 16px; border: none; border-radius: 12px; background: transparent; color: var(--c-text-4c, #8b95a1); font-size: 17px; font-weight: 600; letter-spacing: -0.3px; font-family: inherit; cursor: pointer; transition: background 0.2s ease, color 0.2s ease; -webkit-tap-highlight-color: transparent; }
        .up-chip.on { background: var(--c-bg-muted-2, #f2f4f6); color: var(--c-text); font-weight: 700; }
        .up-empty { margin: 0; padding: 56px 20px; text-align: center; color: var(--c-text-4); font-size: 15px; font-weight: 500; }
        .up-list { display: grid; }
        .up-item { display: grid; gap: 10px; text-align: left; width: 100%; padding: 20px 20px 16px; border: none; border-bottom: 1px solid var(--c-bg-muted-6, #f2f4f6); background: none; color: inherit; font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .up-item-head { display: flex; align-items: center; gap: 12px; }
        .up-board { flex: none; width: 44px; height: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; letter-spacing: -0.2px; overflow: hidden; white-space: nowrap; }
        .up-board.is-repost { background: #e6f7ee; color: #03a94d; }
        .up-board.is-comment { background: var(--c-bg-muted-2, #f2f4f6); color: var(--c-text-4c, #8b95a1); }
        .up-item-who { min-width: 0; display: grid; gap: 2px; }
        .up-item-title { color: var(--c-text-3, #6b7684); font-size: 16px; font-weight: 700; letter-spacing: -0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .up-item-time { color: var(--c-text-4c, #8b95a1); font-size: 14.5px; font-weight: 500; }
        .up-post-title { color: var(--c-text); font-size: 18px; font-weight: 700; line-height: 1.5; letter-spacing: -0.3px; }
        .up-post-content { color: var(--c-text); font-size: 17px; line-height: 1.6; letter-spacing: -0.3px; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
        .up-post-content.is-strong { font-size: 17.5px; }
        .up-metrics { display: flex; gap: 20px; color: var(--c-text-3, #6b7684); font-size: 16px; font-weight: 500; padding-top: 2px; }
        .up-metrics > span { display: inline-flex; align-items: center; gap: 6px; }
        .up-badges { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 24px 20px; }
        .up-badge-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 22px 12px; border-radius: 20px; background: var(--c-bg-soft, #f7f8fa); text-align: center; }
        .up-badge-name { margin: 8px 0 0; font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
        .up-badge-desc { margin: 0; color: var(--c-text-4c, #8b95a1); font-size: 13.5px; font-weight: 500; }
        .up-toast { position: fixed; left: 50%; bottom: calc(40px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 300; padding: 12px 18px; border-radius: 12px; background: rgba(25, 31, 40, 0.92); color: #fff; font-size: 15px; font-weight: 600; max-width: calc(100% - 32px); text-align: center; pointer-events: none; }
        @keyframes cpdSkPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media (min-width: 720px) { .up-page { max-width: 640px; margin: 0 auto; } }
        @media (prefers-reduced-motion: reduce) { .up-head, .up-follow, .up-body { animation: none; } }
      `}</style>
    </main>
  );
}
