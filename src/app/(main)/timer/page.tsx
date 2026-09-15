"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TimerFlameBadge, { FlameChip } from "@/components/TimerFlameBadge";
import StudyRooms from "@/components/StudyRooms";
import IntroBanner from "@/components/IntroBanner";
import ObsidianIntroSplash from "@/components/ObsidianIntroSplash";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";
import { clientCache } from "@/lib/clientCache";

interface TimerUser {
  userId: string;
  nickname: string;
  avatar: string | null;
  statusMessage: string | null;
  isActive: boolean;
  subject: string | null;
  activeStartedAt: string | null;
  activeElapsedSeconds: number;
  todayTotalSeconds: number;
  isMe: boolean;
}

interface FriendRequest {
  id: string;
  userId: string;
  nickname: string;
  avatar: string | null;
  statusMessage?: string | null;
}

interface TimerStats {
  totalStudySeconds: number;
  activeDays: number;
  streakDays: number;
  completedSessionCount: number;
}

interface TimerAnalysisDay {
  date: string;
  totalSeconds: number;
  sessionCount: number;
  memo: string;
}

interface TimerAnalysis {
  days: TimerAnalysisDay[];
  summary: {
    totalSeconds: number;
    activeDays: number;
    averageSeconds: number;
    bestDay: TimerAnalysisDay | null;
    recent7TotalSeconds: number;
  };
}

// 타이머 화면은 앱의 파란 브랜드 대신 옅은 보라 톤을 쓴다(globals.css --c-timer-*).
const PRIMARY = "var(--c-timer)";
const PRIMARY_DARK = "var(--c-timer-deep)";
const PRIMARY_SOFT = "var(--c-timer-soft)";
const PRIMARY_SOFTER = "var(--c-timer-softer)";
const ACCENT_BG = "var(--c-timer-line)";
const TEXT_MUTED = "var(--c-text-4c)";

interface WeeklyRankRow { userId: string; nickname: string; avatar: string | null; seconds: number; totalSeconds: number; isMe: boolean }
interface WeeklyAward { weekStart: string; rank: number; days: number }

const TIMER_TABS = [
  { key: "rooms" as const, label: "스타디룸", icon: "/icons/toss/room-wizard.svg" },
  { key: "ranking" as const, label: "주간옵시디언", icon: "/icons/toss/obsidian.svg" },
];
const OFFLINE_FILL = "var(--c-border)";
const DEFAULT_STUDYING_AVATAR = "/timer/default-studying.png";
const DEFAULT_RESTING_AVATAR = "/timer/default-resting.png";
const START_MESSAGES = [
  "오늘도 화이팅!",
  "도전해봐!",
  "한 번 시작!",
  "지금 딱 좋아!",
  "가볍게 시작!",
  "집중 가자!",
];

// 진입 속도용 SWR 캐시 키(SPA 세션 동안 유지). cachedAt으로 진행중 세션 경과를 보정한다.
const SESS_CACHE_KEY = "timer:sessions";
const FRIENDS_CACHE_KEY = "timer:friends";

interface SessionsPayload {
  users: TimerUser[];
  activeCount: number;
  totalCount: number;
  mySession: TimerUser | null;
  myStats: TimerStats | null;
  cachedAt: number;
}
interface FriendsPayload {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  friends: TimerUser[];
}

export default function TimerPage() {
  const router = useRouter();
  const [startMessage] = useState(() => START_MESSAGES[Math.floor(Math.random() * START_MESSAGES.length)]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [users, setUsers] = useState<TimerUser[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(() => !clientCache.has(SESS_CACHE_KEY));
  const [activeTab, setActiveTab] = useState<"rooms" | "ranking">("rooms");
  const [selectedUser, setSelectedUser] = useState<TimerUser | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<TimerUser[]>([]);
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [friendAddMessage, setFriendAddMessage] = useState("");
  const [friendAddLoading, setFriendAddLoading] = useState(false);
  const [myStats, setMyStats] = useState<TimerStats | null>(null);
  // 주간 랭킹(월요일 시작, KST) — 1~3위는 다음 주 월요일에 프라임 7일을 받는다.
  const [rankScope, setRankScope] = useState<"today" | "week">("week");
  // 친구는 탭에서 빼고 헤더 아이콘으로 연다.
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [weekly, setWeekly] = useState<{ ranking: WeeklyRankRow[]; awards: WeeklyAward[]; awardRanks: number; awardDays: number } | null>(null);
  const [analysis, setAnalysis] = useState<TimerAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);
  // 내 세션 시작 시각(ms). 매초 +1이 아니라 벽시계로 경과를 계산해야
  // 앱을 백그라운드로 보냈다 와도(JS 타이머 정지) 시간이 그대로 이어진다.
  const myStartAtRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // 세션 응답을 상태에 반영. at = 응답이 생성된 시각(캐시 재생 시 cachedAt) —
  // 진행중 세션의 시작시각 앵커(at - elapsed)는 캐시가 오래돼도 정확하다.
  const applySessions = (data: Omit<SessionsPayload, "cachedAt">, at: number) => {
    setUsers(data.users || []);
    setActiveCount(data.activeCount || 0);
    setTotalCount(data.totalCount || 0);
    if (data.mySession) {
      setIsRunning(true);
      myStartAtRef.current = at - data.mySession.activeElapsedSeconds * 1000;
    } else {
      setIsRunning(false);
      myStartAtRef.current = null;
    }
    setMyStats(data.myStats || null);
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/timer/sessions");
      const data = await res.json();
      const at = Date.now();
      const payload: SessionsPayload = {
        users: data.users || [],
        activeCount: data.activeCount || 0,
        totalCount: data.totalCount || 0,
        mySession: data.mySession || null,
        myStats: data.myStats || null,
        cachedAt: at,
      };
      clientCache.set(SESS_CACHE_KEY, payload);
      applySessions(payload, at);
    } catch {}
    setLoading(false);
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/timer/friends");
      if (!res.ok) return;
      const data = await res.json();
      const payload: FriendsPayload = {
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
        friends: data.friends || [],
      };
      if (clientCache.set(FRIENDS_CACHE_KEY, payload)) {
        setIncomingRequests(payload.incoming);
        setOutgoingRequests(payload.outgoing);
        setFriends(payload.friends);
      }
    } catch {}
  };

  const fetchAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/timer/analysis");
      if (!res.ok) return;
      const data = await res.json();
      setAnalysis(data);
    } catch {
    } finally {
      setAnalysisLoading(false);
    }
  };

  // 진입 즉시: 캐시가 있으면 바로 그리고(재진입 0ms 페인트), 네트워크는 auth/me를
  // 기다리지 않고 병렬로 시작한다(예전엔 auth/me → sessions 직렬이라 진입이 느렸음).
  useEffect(() => {
    const sess = clientCache.get<SessionsPayload>(SESS_CACHE_KEY);
    if (sess) applySessions(sess, sess.cachedAt);
    const fr = clientCache.get<FriendsPayload>(FRIENDS_CACHE_KEY);
    if (fr) {
      setIncomingRequests(fr.incoming);
      setOutgoingRequests(fr.outgoing);
      setFriends(fr.friends);
    }
    fetchData();
    fetchFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폴링은 로그인 확인 후에만(비로그인 사용자에게 15초 폴링 낭비 방지).
  useEffect(() => {
    if (isLoggedIn !== true) return;
    pollRef.current = setInterval(() => {
      fetchData();
      fetchFriends();
    }, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const sendFriendRequest = async (userId: string) => {
    const res = await fetch("/api/timer/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setSelectedUser(null);
    fetchFriends();
    if (!res.ok) setFriendAddMessage("친구 요청을 보내지 못했어요.");
  };

  const sendFriendRequestByIdentifier = async () => {
    const identifier = friendIdentifier.trim();
    if (!identifier) {
      setFriendAddMessage("아이디를 입력해주세요.");
      return;
    }
    setFriendAddLoading(true);
    setFriendAddMessage("");
    try {
      const res = await fetch("/api/timer/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      if (res.ok) {
        setFriendIdentifier("");
        setFriendAddMessage("친구 요청을 보냈어요.");
        fetchFriends();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setFriendAddMessage(data.error || "친구 요청을 보내지 못했어요.");
    } finally {
      setFriendAddLoading(false);
    }
  };

  const respondFriendRequest = async (requestId: string, action: "accept" | "reject") => {
    await fetch("/api/timer/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    fetchFriends();
  };

  // 매초 경과 시계는 <LiveTodayTotal>가 자체 틱으로 그린다 — 여기서 페이지 전역
  // 상태를 매초 갱신하지 않으므로 타이머 화면 전체가 초당 리렌더되지 않는다(버벅임 해결).

  // 앱/탭 복귀 시 서버 상태를 즉시 재조회(백그라운드 동안의 경과·상태 반영).
  useEffect(() => {
    if (isLoggedIn !== true) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchData();
        fetchFriends();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isRunning) return;
    pingRef.current = setInterval(() => {
      fetch("/api/timer/ping", { method: "POST" }).catch(() => {});
    }, 30000);
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [isRunning]);

  const start = async () => {
    const res = await fetch("/api/timer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "공부중" }),
    });
    if (res.ok) {
      setIsRunning(true);
      myStartAtRef.current = Date.now();
      setUsers((prev) => prev.map((user) => user.isMe ? { ...user, isActive: true, subject: "공부중", activeElapsedSeconds: 0 } : user));
      setTimeout(() => fetchData(), 350);
    }
  };

  const stop = async () => {
    const res = await fetch("/api/timer/stop", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    // 서버 값이 없으면 시작 시각(벽시계)으로 경과를 계산.
    const localElapsed = myStartAtRef.current != null ? Math.max(0, Math.floor((Date.now() - myStartAtRef.current) / 1000)) : 0;
    const finishedSeconds = Number(data.session?.totalSeconds || localElapsed || 0);
    setIsRunning(false);
    myStartAtRef.current = null;
    setUsers((prev) => prev.map((user) => {
      if (!user.isMe) return user;
      const completedToday = user.todayTotalSeconds - user.activeElapsedSeconds + finishedSeconds;
      return {
        ...user,
        isActive: false,
        subject: null,
        activeStartedAt: null,
        activeElapsedSeconds: 0,
        todayTotalSeconds: Math.max(0, completedToday),
      };
    }));
    setTimeout(() => fetchData(), 350);
    if (analysis) fetchAnalysis();
  };

  const myUser = useMemo(() => users.find((u) => u.isMe), [users]);
  // 진행 중인 현재 세션을 제외한 "오늘 완료분" 기준값. 라이브 경과는 <LiveTodayTotal>가 더한다.
  const myTodayBase = Math.max(0, (myUser?.todayTotalSeconds || 0) - (myUser?.activeElapsedSeconds || 0));
  // 뱃지 진행도 등 초당 갱신이 필요 없는 곳용: 렌더 시점의 오늘 총합(폴링/탭전환 때 갱신).
  const myTodayTotalNow = myTodayBase + (isRunning && myStartAtRef.current != null ? Math.max(0, Math.floor((Date.now() - myStartAtRef.current) / 1000)) : 0);

  // 공부현황: 현재 공부중(active)인 유저만 노출. 나(me)는 공부중일 때 맨 앞.
  const sortedUsers = useMemo(() => {
    return [...users]
      .filter((u) => u.isActive)
      .sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        return b.activeElapsedSeconds - a.activeElapsedSeconds;
      });
  }, [users]);

  useEffect(() => {
    let alive = true;
    fetch("/api/timer/weekly", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setWeekly(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [activeTab, rankScope]);

  // 내 이번 주 공부시간(불꽃 등급 기준).
  const myWeeklySeconds = weekly?.ranking.find((r) => r.isMe)?.seconds ?? 0;

  const todayRanking = useMemo(
    () => [...users].filter((u) => u.todayTotalSeconds > 0).sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds),
    [users]
  );

  // 상단 칩도 현재 공부중(active)인 사람만 — 오프라인은 제외(나 포함).
  const topFriendChips = useMemo(
    () =>
      [...users]
        .filter((u) => !u.isMe && u.isActive)
        .sort((a, b) => b.activeElapsedSeconds - a.activeElapsedSeconds)
        .slice(0, 3),
    [users]
  );

  // auth/me 응답 전에도 화면을 그린다(캐시/스피너) — 빈 화면 대기 제거.
  if (isLoggedIn === false) return <LoginRequired />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-timer-bg)" }}>
      {/* 첫 진입: 어두워지며 크리스탈 영상이 뜨는 스플래시(기기당 1회) → 닫히면 아래 배너 */}
      <ObsidianIntroSplash />
      {/* 첫 진입 배너(X = 3일 동안 안 보기) */}
      <IntroBanner
        image="/banners/obsidian-rank.jpg"
        alt="옵시디언 랭킹 3위 이내 달성 시 스타디 프라임 일주일 무료"
        storageKey="obsidian_intro_hidden_until"
      />
      {/* Title */}
      <header style={{ padding: "calc(20px + env(safe-area-inset-top, 0px)) 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--c-text-c)" }}>옵시디언</h1>
        {/* 친구는 탭이 아니라 헤더 아이콘으로 — 탭 자리는 스타디룸·랭킹만 쓴다. */}
        <button
          type="button"
          onClick={() => setFriendsOpen(true)}
          aria-label="친구"
          className="press"
          style={{
            marginLeft: "auto", position: "relative", height: 38, borderRadius: 999,
            border: "none", background: "var(--c-timer-soft)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 5, padding: "0 13px 0 9px",
            color: "var(--c-timer-deep)", fontSize: 13.5, fontWeight: 800,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/toss/kid.svg" alt="" style={{ width: 22, height: 22, display: "block" }} />
          친구 +
          {incomingRequests.length > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 9, background: "var(--c-danger-b)", color: "#fff", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {incomingRequests.length}
            </span>
          )}
        </button>
      </header>

      {/* 태블릿: 왼쪽 절반은 타이머(세로 정가운데), 오른쪽 절반은 스타디룸·주간옵시디언.
          폰에서는 .tmr-split 이 그냥 블록이라 예전 그대로 위아래로 쌓인다. */}
      <div className="tmr-split">
      <div className="tmr-left">

      {/* Main timer row: clock on left, bubble + play on right */}
      <div className="tmr-clockrow" style={{
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 14,
      }}>
        <p className="tmr-clock" style={{
          fontSize: 40,
          fontWeight: 700,
          color: "var(--c-text-c)",
          letterSpacing: -1,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          margin: 0,
          whiteSpace: "nowrap",
        }}>
          <LiveTodayTotal baseSeconds={myTodayBase} startAt={isRunning ? myStartAtRef.current : null} />
        </p>
        <div className="tmr-playwrap" style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
          {!isRunning && (
            <div className="tmr-bubble" style={{
              position: "absolute",
              right: 56,
              top: -10,
              padding: "8px 14px",
              borderRadius: 999,
              background: "var(--c-bg)",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-c)",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
              pointerEvents: "none",
            }}>
              {startMessage}
            </div>
          )}
          <TimerControlButton isRunning={isRunning} onClick={isRunning ? stop : start} />
        </div>
      </div>

      {/* 내 불꽃 등급 — 이번 주 공부시간 기준이고 월요일에 초기화된다 */}
      <div className="tmr-flameline" style={{ padding: "0 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <FlameChip totalSeconds={myWeeklySeconds} size={15} />
        <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 600 }}>
          이번 주 {formatTime(myWeeklySeconds)} · 월요일에 초기화돼요
        </span>
      </div>

      {/* 투데이 랭킹 1~3위 — 타이머 바로 밑에 이름만 간단히 */}
      {todayRanking.length > 0 && (
        <div className="tmr-top3" style={{ padding: "0 20px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 18 }}>
          {todayRanking.slice(0, 3).map((u, i) => (
            <button
              key={timerUserRenderKey(u)}
              type="button"
              onClick={() => setSelectedUser(u)}
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                background: u.isMe ? PRIMARY_SOFTER : "var(--c-bg-muted)",
                color: "var(--c-text-2c)", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontWeight: 900, color: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : "#CD7F32" }}>{i + 1}위</span>
              {u.nickname}
              <span style={{ color: TEXT_MUTED, fontWeight: 700 }}>{formatTime(u.todayTotalSeconds)}</span>
            </button>
          ))}
        </div>
      )}

      </div>

      <div className="tmr-right">
      <div className="tmr-divider" style={{ height: 1, background: "var(--c-bg-muted)" }} />

      {/* 탭 바 — 아이콘 + 라벨, 선택된 쪽에 밑줄 */}
      <div style={{ display: "flex", padding: "0 20px", gap: 22, borderBottom: "1px solid var(--c-bg-muted)" }}>
        {TIMER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                position: "relative", display: "inline-flex", alignItems: "center", gap: 6,
                padding: "13px 2px", background: "none", border: "none", cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tab.icon}
                alt=""
                style={{ width: 20, height: 20, objectFit: "contain", display: "block", opacity: isActive ? 1 : 0.45 }}
              />
              <span style={{
                fontSize: 15,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? "var(--c-text-c)" : "var(--c-text-4c)",
                whiteSpace: "nowrap",
              }}>
                {tab.label}
              </span>
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2,
                background: isActive ? PRIMARY : "transparent",
              }} />
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: "20px 20px 40px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 24, height: 24, border: "2px solid var(--c-bg-muted)", borderTopColor: PRIMARY, borderRadius: "50%", animation: "timerSpin 0.8s linear infinite" }} />
            <style>{`@keyframes timerSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : activeTab === "rooms" ? (
          <div key="rooms" className="timer-tab-panel">
            <StudyRooms canWrite={isLoggedIn === true} />
          </div>
        ) : activeTab === "ranking" ? (
          <div key="ranking" className="timer-tab-panel">
            {/* 지금 내 불꽃 등급 — 이번 주 공부시간 기준 */}
            <TimerFlameBadge totalSeconds={myWeeklySeconds} />
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--c-bg-muted)", marginBottom: 12 }}>
              {([["today", "오늘"], ["week", "이번 주"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRankScope(key)}
                  style={{
                    flex: 1, height: 34, border: "none", borderRadius: 9, cursor: "pointer",
                    fontSize: 13.5, fontWeight: 700,
                    background: rankScope === key ? "var(--c-bg)" : "transparent",
                    color: rankScope === key ? "var(--c-text)" : "var(--c-text-4)",
                    boxShadow: rankScope === key ? "0 1px 4px rgba(15,23,42,0.08)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {rankScope === "week" ? (
              <WeeklyRanking data={weekly} />
            ) : (
            <>
            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 16 }}>
              누적 기록 <span style={{ color: PRIMARY, fontWeight: 700 }}>{todayRanking.length}명</span>
            </p>
            {todayRanking.length === 0 ? (
              <div style={{
                padding: "32px 20px", borderRadius: 16,
                background: "var(--c-bg-soft)", border: "1px solid var(--c-bg-muted)",
                textAlign: "center",
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-3)", marginBottom: 4 }}>
                  아직 오늘 공부한 기록이 없어요
                </p>
                <p style={{ fontSize: 12, color: "var(--c-text-4c)" }}>첫 번째 기록을 남겨보세요!</p>
              </div>
            ) : (
              <div style={{
                borderRadius: 16, border: "1px solid var(--c-bg-muted)", overflow: "hidden",
                background: "var(--c-bg)",
              }}>
                {todayRanking.map((u, i) => (
                  <RankingRow key={timerUserRenderKey(u)} user={u} rank={i + 1} isLast={i === todayRanking.length - 1} onOpen={() => setSelectedUser(u)} />
                ))}
              </div>
            )}
            </>
            )}
          </div>
        ) : null}
      </div>
      </div>
      </div>

      {selectedUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => setSelectedUser(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 360, background: "var(--c-bg)", borderRadius: 22, padding: 22, textAlign: "center", boxShadow: "0 16px 48px rgba(15,23,42,0.18)" }}>
            <div style={{ width: 86, height: 86, margin: "0 auto 12px" }}>
              <Avatar user={selectedUser} size={86} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text-c)", marginBottom: 4 }}>{selectedUser.nickname}</h2>
            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 18 }}>
              오늘 {formatTime(selectedUser.todayTotalSeconds)}
              {selectedUser.isActive ? ` · ${selectedUser.subject || "공부중"}` : ""}
            </p>
            {selectedUser.isMe ? (
              <button type="button" onClick={() => setSelectedUser(null)} style={modalSecondaryButtonStyle}>닫기</button>
            ) : friends.some((friend) => friend.userId === selectedUser.userId) ? (
              <button type="button" onClick={() => { setFriendsOpen(true); setSelectedUser(null); }} style={modalPrimaryButtonStyle}>친구 타이머 보기</button>
            ) : incomingRequests.some((request) => request.userId === selectedUser.userId) ? (
              <button type="button" onClick={() => { setFriendsOpen(true); setSelectedUser(null); }} style={modalPrimaryButtonStyle}>받은 요청 확인하기</button>
            ) : outgoingRequests.some((request) => request.userId === selectedUser.userId) ? (
              <button type="button" onClick={() => setSelectedUser(null)} style={modalSecondaryButtonStyle}>요청 대기중</button>
            ) : (
              <button type="button" onClick={() => sendFriendRequest(selectedUser.userId)} style={modalPrimaryButtonStyle}>친구 요청 보내기</button>
            )}
          </div>
        </div>
      )}

      {/* 친구 — 헤더 아이콘으로 여는 전체 시트(예전 탭 내용 그대로) */}
      {friendsOpen && (
        <div
          onClick={() => setFriendsOpen(false)}
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2300,
            background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 560, background: "var(--c-bg-elevated, var(--c-bg))",
              borderTopLeftRadius: 20, borderTopRightRadius: 20, boxSizing: "border-box",
              padding: "18px 18px calc(16px + env(safe-area-inset-bottom, 0px))",
              maxHeight: "88%", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "var(--c-text-b)" }}>친구</span>
              <button type="button" onClick={() => setFriendsOpen(false)} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 13, color: "var(--c-text-4)", cursor: "pointer", fontWeight: 700 }}>
                닫기
              </button>
            </div>
            <div style={{ marginBottom: 18, padding: 14, borderRadius: 16, background: PRIMARY_SOFTER, border: `1px solid ${ACCENT_BG}` }}>
              <p style={{ fontSize: 13, color: PRIMARY_DARK, fontWeight: 800, marginBottom: 10 }}>아이디로 친구 추가</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={friendIdentifier}
                  onChange={(e) => {
                    setFriendIdentifier(e.target.value);
                    setFriendAddMessage("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendFriendRequestByIdentifier();
                  }}
                  placeholder="아이디, 이메일 또는 닉네임"
                  autoCapitalize="none"
                  style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 12, border: "1px solid var(--c-timer-line)", background: "var(--c-bg)", padding: "0 12px", color: "var(--c-text)", fontSize: 14, fontWeight: 700, outline: "none" }}
                />
                <button
                  type="button"
                  onClick={sendFriendRequestByIdentifier}
                  disabled={friendAddLoading}
                  style={{ width: 74, height: 42, borderRadius: 12, border: "none", background: PRIMARY, color: "#fff", fontSize: 13, fontWeight: 800, flexShrink: 0, opacity: friendAddLoading ? 0.65 : 1 }}
                >
                  추가
                </button>
              </div>
              {friendAddMessage && (
                <p style={{ marginTop: 8, fontSize: 12, color: friendAddMessage.includes("보냈") ? PRIMARY_DARK : "var(--c-danger)", fontWeight: 700 }}>
                  {friendAddMessage}
                </p>
              )}
            </div>

            {incomingRequests.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 10 }}>들어온 친구 요청</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {incomingRequests.map((request) => (
                    <FriendRequestRow
                      key={request.id}
                      request={request}
                      onAccept={() => respondFriendRequest(request.id, "accept")}
                      onReject={() => respondFriendRequest(request.id, "reject")}
                    />
                  ))}
                </div>
              </div>
            )}

            {outgoingRequests.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 10 }}>보낸 요청</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {outgoingRequests.map((request) => (
                    <div key={request.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, background: "var(--c-bg-soft)", border: "1px solid var(--c-bg-muted)" }}>
                      <Avatar user={request} size={36} />
                      <b style={{ flex: 1, fontSize: 14, color: "var(--c-text-c)" }}>{request.nickname}</b>
                      <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 700 }}>대기중</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 10 }}>친구 타이머</p>
            {friends.length === 0 ? (
              <div style={{ padding: "32px 20px", borderRadius: 16, background: "var(--c-bg-soft)", border: "1px solid var(--c-bg-muted)", textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-3)", marginBottom: 4 }}>아직 친구가 없어요</p>
                <p style={{ fontSize: 12, color: TEXT_MUTED }}>공부 현황에서 프로필을 눌러 친구 요청을 보내보세요.</p>
              </div>
            ) : (
              <div style={{ borderRadius: 16, border: "1px solid var(--c-bg-muted)", overflow: "hidden", background: "var(--c-bg)" }}>
                {friends
                  .sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds)
                  .map((friend, index) => (
                    <RankingRow key={timerUserRenderKey(friend)} user={friend} rank={index + 1} isLast={index === friends.length - 1} />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes litPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--c-timer-glow); }
          50% { box-shadow: 0 0 0 10px transparent; }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
        @keyframes tabPanelIn {
          from { opacity: 0; transform: translateX(16px) translateY(6px) scale(0.985); }
          to { opacity: 1; transform: translateX(0) translateY(0) scale(1); }
        }
        .timer-tab-panel {
          animation: tabPanelIn 0.36s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: top center;
        }

        /* 태블릿 2단 — 왼쪽 절반은 아이폰 타이머처럼 시간과 재생 버튼이 세로로 쌓여
           칸 정가운데에 놓이고, 오른쪽 절반이 스타디룸·주간옵시디언 UI 를 가진다. */
        @media (min-width: 744px) {
          .tmr-split {
            display: flex;
            align-items: stretch;
            min-height: calc(100vh - 150px);
          }
          .tmr-left {
            width: 50%;
            flex: 0 0 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 26px;
            padding: 24px 12px 40px;
            border-right: 1px solid var(--c-bg-muted);
            box-sizing: border-box;
          }
          .tmr-right {
            width: 50%;
            flex: 1 1 50%;
            min-width: 0;
          }
          .tmr-clockrow {
            flex-direction: column;
            justify-content: center !important;
            gap: 46px !important;
            margin-bottom: 0 !important;
            width: 100%;
          }
          .tmr-clock {
            font-size: 62px !important;
            letter-spacing: -2px !important;
          }
          .tmr-playwrap {
            justify-content: center !important;
            padding-right: 0 !important;
          }
          /* 말풍선은 버튼 오른쪽이 아니라 위쪽 가운데로 */
          .tmr-bubble {
            right: auto !important;
            left: 50% !important;
            top: -42px !important;
            transform: translateX(-50%);
          }
          .tmr-flameline,
          .tmr-top3 {
            margin-bottom: 0 !important;
            justify-content: center;
            width: 100%;
          }
          .tmr-top3 {
            flex-wrap: wrap;
            overflow-x: visible !important;
          }
          .tmr-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerUserRenderKey(user: TimerUser) {
  return `${user.userId}-${user.activeStartedAt || "idle"}-${user.activeElapsedSeconds}`;
}

// 오늘 총 공부시간(진행 중이면 라이브로 1초씩 증가) 표시. 자체 틱으로 이 부분만
// 리렌더되므로 타이머 페이지 전체가 초당 리렌더되지 않는다.
function LiveTodayTotal({ baseSeconds, startAt }: { baseSeconds: number; startAt: number | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (startAt == null) return;
    const calc = () => setElapsed(Math.max(0, Math.floor((Date.now() - startAt) / 1000)));
    // 동기 setState 금지(React Compiler) → 0ms 타임아웃으로 즉시 1회 + 매초 갱신.
    const t0 = setTimeout(calc, 0);
    const t = setInterval(calc, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [startAt]);
  // 정지 상태에선 경과분을 더하지 않는다(재시작 전 stale elapsed 무시).
  return <>{formatTime(baseSeconds + (startAt != null ? elapsed : 0))}</>;
}

function formatHours(sec: number): string {
  if (sec <= 0) return "0시간";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function TimerControlButton({ isRunning, onClick, compact = false }: { isRunning: boolean; onClick: () => void; compact?: boolean }) {
  const size = compact ? 32 : 62;
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        // 단색 원판이 밋밋해서 그라데이션 + 색 그림자 + 위쪽 유리 하이라이트(inset)를 겹쳤다.
        background: isRunning ? "var(--c-inverse)" : "var(--c-timer-grad)",
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: isRunning
          ? (compact ? "0 8px 16px rgba(17,24,39,0.16)" : "0 14px 30px rgba(17,24,39,0.18)")
          : compact
            ? "0 6px 14px var(--c-timer-glow-soft), inset 0 1px 0 rgba(255,255,255,0.3)"
            : [
                "0 10px 22px var(--c-timer-glow)",
                "0 2px 6px var(--c-timer-glow-soft)",
                "0 0 0 6px var(--c-timer-ring)", // 은은한 바깥 링
                "inset 0 1.5px 0 rgba(255,255,255,0.34)",
                "inset 0 -3px 8px rgba(0,0,0,0.12)",
              ].join(", "),
        transition: "box-shadow 0.2s ease, background 0.2s ease",
      }}
    >
      {isRunning ? (
        <svg width={compact ? 12 : 19} height={compact ? 12 : 19} viewBox="0 0 24 24" fill="#fff">
          <rect x="6" y="5" width="4" height="14" rx="2"/>
          <rect x="14" y="5" width="4" height="14" rx="2"/>
        </svg>
      ) : (
        // 꼭짓점을 둥글린 삼각형(획을 같은 색으로 덧대 모서리를 굴린다)
        <svg width={compact ? 13 : 21} height={compact ? 13 : 21} viewBox="0 0 24 24" fill="#fff"
          stroke="#fff" strokeWidth={compact ? 2.5 : 3.2} strokeLinejoin="round"
          style={{ marginLeft: compact ? 2 : 3 }}>
          <polygon points="8.5,6 18.5,12 8.5,18" />
        </svg>
      )}
    </button>
  );
}

function Avatar({ user, size }: { user: { avatar: string | null; isActive?: boolean }; size: number }) {
  const fallbackImage = user.isActive ? DEFAULT_STUDYING_AVATAR : DEFAULT_RESTING_AVATAR;

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "var(--c-bg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {user.avatar ? (
        <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <img src={fallbackImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </div>
  );
}

function UserCard({ user, onOpen, onStatusClick }: { user: TimerUser; onOpen: () => void; onStatusClick?: () => void }) {
  const [elapsed, setElapsed] = useState(user.activeElapsedSeconds);

  useEffect(() => {
    if (!user.isActive) return;
    // 벽시계 기준 기점(서버 경과값 역산) — 백그라운드에서 틱이 멈췄다 재개돼도 정확.
    const base = Date.now() - user.activeElapsedSeconds * 1000;
    const t = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000))), 1000);
    return () => clearInterval(t);
  }, [user.isActive, user.activeElapsedSeconds]);

  const totalToday = user.todayTotalSeconds - user.activeElapsedSeconds + elapsed;
  const lit = user.isActive;
  const statusText = user.statusMessage?.trim() || "상태메세지..";
  const hasStatus = !!user.statusMessage?.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="press"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, minWidth: 0, cursor: "pointer" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onStatusClick) onStatusClick();
        }}
        disabled={!onStatusClick}
        style={{
          position: "relative",
          height: 26,
          maxWidth: "100%",
          padding: "0 9px",
          borderRadius: 999,
          border: "1px solid var(--c-border)",
          background: "var(--c-bg)",
          color: hasStatus ? "var(--c-text)" : "var(--c-text-4h)",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          boxShadow: "0 5px 12px rgba(17,24,39,0.06)",
          cursor: onStatusClick ? "pointer" : "default",
        }}
      >
        {statusText}
        <span
          style={{
            position: "absolute",
            left: "50%",
            bottom: -5,
            width: 9,
            height: 9,
            background: "var(--c-bg)",
            borderRight: "1px solid var(--c-border)",
            borderBottom: "1px solid var(--c-border)",
            transform: "translateX(-50%) rotate(45deg)",
          }}
        />
      </button>
      {/* Avatar bubble - 점등식 */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
        {/* 원형 버블. 이미지는 absolute 로 띄운다 — flex 아이템으로 두면 업로드 사진의 고유 높이가
            부모(aspectRatio 1/1)를 세로로 밀어 올려 타원이 된다(실사용자 아바타에서 발생). */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: lit
            ? "linear-gradient(135deg, var(--c-timer-line) 0%, var(--c-timer-soft) 100%)"
            : "var(--c-bg-muted)",
          border: user.isMe
            ? `2.5px solid ${PRIMARY}`
            : lit
              ? `2px solid ${PRIMARY}`
              : "2px solid var(--c-border)",
          overflow: "hidden",
          transition: "all 0.3s ease",
          animation: lit ? "litPulse 2.4s ease-in-out infinite" : "none",
          filter: lit ? "none" : "grayscale(0.5) brightness(1.04)",
        }}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                opacity: lit ? 1 : 0.45,
                filter: lit ? "none" : "grayscale(1)",
              }}
            />
          ) : (
            <img src={lit ? DEFAULT_STUDYING_AVATAR : DEFAULT_RESTING_AVATAR} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: lit ? 1 : 0.62 }} />
          )}
        </div>
        {/* Status dot */}
        <div style={{
          position: "absolute", top: 2, right: 2,
          width: 14, height: 14, borderRadius: "50%",
          background: lit ? PRIMARY : OFFLINE_FILL,
          border: "2.5px solid var(--c-bg)",
          animation: lit ? "dotPulse 1.8s ease-in-out infinite" : "none",
          boxShadow: lit ? `0 0 8px ${PRIMARY}` : "none",
        }} />
      </div>

      <p style={{
        fontSize: 13, fontWeight: 700,
        color: lit ? "var(--c-text-c)" : "var(--c-text-4c)",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      }}>
        {user.isMe && (
          <span style={{
            padding: "2px 5px",
            borderRadius: 999,
            background: PRIMARY,
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
          }}>
            MY
          </span>
        )}
        {user.nickname}
      </p>

      <p style={{
        fontSize: 12, fontWeight: 700,
        color: lit ? PRIMARY : "var(--c-text-4g)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {lit || totalToday > 0 ? formatTime(totalToday) : "오프라인"}
      </p>
    </div>
  );
}

function FriendRequestRow({ request, onAccept, onReject }: { request: FriendRequest; onAccept: () => void; onReject: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
      <Avatar user={request} size={38} />
      <b style={{ flex: 1, fontSize: 14, color: "var(--c-text-c)" }}>{request.nickname}</b>
      <button type="button" onClick={onReject} style={{ height: 32, padding: "0 10px", borderRadius: 10, border: "none", background: "var(--c-bg-muted)", color: "var(--c-text-3)", fontSize: 12, fontWeight: 700 }}>거절</button>
      <button type="button" onClick={onAccept} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "none", background: PRIMARY, color: "#fff", fontSize: 12, fontWeight: 700 }}>수락</button>
    </div>
  );
}

const modalPrimaryButtonStyle = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "none",
  background: PRIMARY,
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
};

const modalSecondaryButtonStyle = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "none",
  background: "var(--c-bg-muted)",
  color: "var(--c-text-3)",
  fontSize: 15,
  fontWeight: 700,
};

// 주간 랭킹. 1~3위는 다음 주 월요일 새벽 크론이 프라임 7일을 자동 지급한다.
function WeeklyRanking({ data }: { data: { ranking: WeeklyRankRow[]; awards: WeeklyAward[]; awardRanks: number; awardDays: number } | null }) {
  if (!data) return <p style={{ fontSize: 13, color: TEXT_MUTED, padding: "24px 0", textAlign: "center" }}>불러오는 중이에요.</p>;
  const { ranking, awardRanks, awardDays } = data;
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };
  return (
    <>
      <div style={{ padding: "11px 14px", borderRadius: 14, background: PRIMARY_SOFTER, border: `1px solid ${ACCENT_BG}`, marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, fontWeight: 800, color: PRIMARY_DARK, lineHeight: 1.6 }}>
          이번 주 {awardRanks}위 안에 들면 다음 주에 스타디 프라임 {awardDays}일을 드려요
        </p>
        <p style={{ fontSize: 11.5, color: TEXT_MUTED, marginTop: 3 }}>월요일 0시에 새로 시작해요 · 이미 구독 중이면 구독이 끝난 뒤로 이어져요</p>
      </div>
      {data.awards.length > 0 && (
        <p style={{ fontSize: 12, color: PRIMARY, fontWeight: 700, marginBottom: 10 }}>
          받은 보상 {data.awards.length}회 · 최근 {data.awards[0].weekStart} 주 {data.awards[0].rank}위
        </p>
      )}
      {ranking.length === 0 ? (
        <div style={{ padding: "32px 20px", borderRadius: 16, background: "var(--c-bg-soft)", border: "1px solid var(--c-bg-muted)", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-3)" }}>이번 주 기록이 아직 없어요</p>
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: "1px solid var(--c-bg-muted)", overflow: "hidden", background: "var(--c-bg)" }}>
          {ranking.map((u, i) => {
            const rank = i + 1;
            const rankColor = rank === 1 ? "#F59E0B" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7F32" : "#D1D5DB";
            return (
              <div key={u.userId} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: i === ranking.length - 1 ? "none" : "1px solid var(--c-bg-muted)",
                background: u.isMe ? PRIMARY_SOFTER : "var(--c-bg)",
              }}>
                <span style={{ width: 26, textAlign: "center", fontSize: 15, fontWeight: 900, color: rankColor }}>{rank}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.nickname}
                  </span>
                  <FlameChip totalSeconds={u.seconds} size={12} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: rank <= awardRanks ? PRIMARY : "var(--c-text-3)", whiteSpace: "nowrap" }}>
                  {fmt(u.seconds)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function RankingRow({ user, rank, isLast, onOpen }: { user: TimerUser; rank: number; isLast: boolean; onOpen?: () => void }) {
  const [elapsed, setElapsed] = useState(user.activeElapsedSeconds);

  useEffect(() => {
    if (!user.isActive) return;
    const base = Date.now() - user.activeElapsedSeconds * 1000;
    const t = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000))), 1000);
    return () => clearInterval(t);
  }, [user.isActive, user.activeElapsedSeconds]);

  const totalToday = user.todayTotalSeconds - user.activeElapsedSeconds + elapsed;
  const rankColor = rank === 1 ? "#F59E0B" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7F32" : "#D1D5DB";

  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: isLast ? "none" : "1px solid var(--c-bg-muted)",
      background: user.isMe ? PRIMARY_SOFTER : "var(--c-bg)",
      cursor: onOpen ? "pointer" : "default",
    }}>
      <span style={{
        fontSize: 13, fontWeight: 700, color: rankColor,
        width: 20, textAlign: "center", flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}>
        {rank}
      </span>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: user.isActive ? PRIMARY_SOFT : "var(--c-bg-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        border: user.isActive ? `2px solid ${ACCENT_BG}` : "none",
        flexShrink: 0,
      }}>
        {user.avatar ? (
          <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <img src={user.isActive ? DEFAULT_STUDYING_AVATAR : DEFAULT_RESTING_AVATAR} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: user.isActive ? 1 : 0.72 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: "var(--c-text-c)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {user.nickname}
          {user.isMe && <span style={{ marginLeft: 6, fontSize: 11, color: PRIMARY }}>나</span>}
        </p>
        {user.isActive && user.subject && (
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 }}>{user.subject}</p>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700,
          color: user.isActive ? PRIMARY : "var(--c-text-c)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatTime(totalToday)}
        </p>
        {user.isActive && (
          <p style={{ fontSize: 10, color: PRIMARY, marginTop: 1, fontWeight: 600 }}>
            ● 공부 중
          </p>
        )}
      </div>
    </div>
  );
}
