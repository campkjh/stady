"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const PRIMARY = "var(--c-brand)";
const PRIMARY_DARK = "var(--c-brand-deep)";
const PRIMARY_SOFT = "var(--c-brand-soft)";
const PRIMARY_SOFTER = "var(--c-brand-soft-8)";
const ACCENT_BG = "var(--c-brand-line-4)";
const TEXT_MUTED = "var(--c-text-4c)";

const TIMER_TABS = [
  { key: "status" as const, label: "공부현황", icon: "/icons/timer-status.png" },
  { key: "ranking" as const, label: "투데이랭킹", icon: "/icons/timer-ranking.png" },
  { key: "friends" as const, label: "친구", icon: "/icons/timer-friends.png" },
  { key: "badges" as const, label: "뱃지", icon: "/icons/timer-badge.png" },
  { key: "analysis" as const, label: "분석", icon: "/icons/timer-analysis.png" },
];
const OFFLINE_FILL = "var(--c-border)";
const LOCKED_BADGE_IMAGE = "/badges/locked.png";
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

const BADGES = [
  { id: "baking", title: "첫 반죽", image: "/badges/baking.png", condition: "누적 공부 10분 달성", type: "total", target: 10 * 60 },
  { id: "garden", title: "새싹 물주기", image: "/badges/garden.png", condition: "누적 공부 30분 달성", type: "total", target: 30 * 60 },
  { id: "cozy", title: "따뜻한 몰입", image: "/badges/cozy.png", condition: "누적 공부 1시간 달성", type: "total", target: 60 * 60 },
  { id: "learning-rainbow", title: "탐구 스타터", image: "/badges/learning-rainbow.png", condition: "누적 공부 2시간 달성", type: "total", target: 2 * 60 * 60 },
  { id: "focus-clock", title: "오늘의 집중", image: "/badges/focus-clock.png", condition: "오늘 공부 30분 달성", type: "today", target: 30 * 60 },
  { id: "book-stack-purple", title: "책 위 휴식", image: "/badges/book-stack-purple.png", condition: "누적 공부 5시간 달성", type: "total", target: 5 * 60 * 60 },
  { id: "reading-bolt", title: "번개 독서", image: "/badges/reading-bolt.png", condition: "누적 공부 10시간 달성", type: "total", target: 10 * 60 * 60 },
  { id: "night-reading", title: "밤의 독서가", image: "/badges/night-reading.png", condition: "누적 공부 15시간 달성", type: "total", target: 15 * 60 * 60 },
  { id: "seed-book", title: "성장의 씨앗", image: "/badges/seed-book.png", condition: "공부한 날 2일 달성", type: "activeDays", target: 2 },
  { id: "book-stack-brown", title: "책탑 쌓기", image: "/badges/book-stack-brown.png", condition: "공부한 날 3일 달성", type: "activeDays", target: 3 },
  { id: "hundred", title: "100분 트로피", image: "/badges/hundred.png", condition: "누적 공부 100분 달성", type: "total", target: 100 * 60 },
  { id: "seven-day", title: "7일 행운", image: "/badges/seven-day.png", condition: "연속 공부 7일 달성", type: "streak", target: 7 },
  { id: "crown-book", title: "왕관 독서", image: "/badges/crown-book.png", condition: "누적 공부 20시간 달성", type: "total", target: 20 * 60 * 60 },
  { id: "check-note", title: "꼼꼼 체크", image: "/badges/check-note.png", condition: "완료한 타이머 10회 달성", type: "sessions", target: 10 },
  { id: "thirty-day", title: "30일 인증", image: "/badges/thirty-day.png", condition: "연속 공부 30일 달성", type: "streak", target: 30 },
] as const;

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
  const [activeTab, setActiveTab] = useState<"status" | "ranking" | "friends" | "badges" | "analysis">("status");
  const [selectedUser, setSelectedUser] = useState<TimerUser | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<TimerUser[]>([]);
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [friendAddMessage, setFriendAddMessage] = useState("");
  const [friendAddLoading, setFriendAddLoading] = useState(false);
  const [myStats, setMyStats] = useState<TimerStats | null>(null);
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

  useEffect(() => {
    if (isLoggedIn === true && activeTab === "analysis" && !analysis) {
      fetchAnalysis();
    }
  }, [isLoggedIn, activeTab, analysis]);

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
    <div style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      {/* Title */}
      <header style={{ padding: "20px 20px 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--c-text-c)" }}>타이머</h1>
      </header>

      {/* Main timer row: clock on left, bubble + play on right */}
      <div style={{
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 14,
      }}>
        <p style={{
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
        <div style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
          {!isRunning && (
            <div style={{
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

      {/* Friend chips */}
      {topFriendChips.length > 0 && (
        <div style={{
          padding: "0 20px",
          display: "flex",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
          marginBottom: 18,
        }}>
          {topFriendChips.map((u) => (
            <button
              key={u.userId}
              type="button"
              onClick={() => setSelectedUser(u)}
              style={{
                flexShrink: 0,
                padding: "7px 12px",
                borderRadius: 999,
                background: "var(--c-bg-muted)",
                color: "var(--c-text-2c)",
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                border: "none",
                cursor: "pointer",
              }}
            >
              {u.nickname} {formatTime(u.todayTotalSeconds)}
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: "var(--c-bg-muted)" }} />

      {/* Icon Tabs */}
      <div style={{
        padding: "16px 12px 12px",
        display: "flex",
        gap: 4,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        {TIMER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const requestBadge = tab.key === "friends" && incomingRequests.length > 0 ? incomingRequests.length : 0;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                minWidth: 64,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div style={{ position: "relative", width: 60, height: 60 }}>
                <img
                  src={tab.icon}
                  alt=""
                  style={{ width: 60, height: 60, objectFit: "contain", display: "block" }}
                />
                {requestBadge > 0 && (
                  <span style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 9,
                    background: "var(--c-danger-b)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {requestBadge}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? "var(--c-text-c)" : "var(--c-text-4c)",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: "var(--c-bg-muted)" }} />

      {/* Tab content */}
      <div style={{ padding: "20px 20px 40px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 24, height: 24, border: "2px solid var(--c-bg-muted)", borderTopColor: PRIMARY, borderRadius: "50%", animation: "timerSpin 0.8s linear infinite" }} />
            <style>{`@keyframes timerSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : activeTab === "status" ? (
          <div key="status" className="timer-tab-panel">
            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 16 }}>
              <span style={{ color: PRIMARY, fontWeight: 700 }}>{activeCount}</span> / {totalCount}명 공부 중
            </p>
            {sortedUsers.length === 0 ? (
              <div style={{
                padding: "32px 20px", borderRadius: 16,
                background: "var(--c-bg-soft)", border: "1px solid var(--c-bg-muted)",
                textAlign: "center",
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-3)" }}>
                  아직 등록된 유저가 없습니다
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {sortedUsers.map((u) => (
                  <UserCard
                    key={timerUserRenderKey(u)}
                    user={u}
                    onOpen={() => setSelectedUser(u)}
                    onStatusClick={u.isMe ? () => router.push("/mypage/profile") : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "ranking" ? (
          <div key="ranking" className="timer-tab-panel">
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
          </div>
        ) : activeTab === "friends" ? (
          <div key="friends" className="timer-tab-panel">
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
                  style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 12, border: "1px solid var(--c-brand-line-3)", background: "var(--c-bg)", padding: "0 12px", color: "var(--c-text)", fontSize: 14, fontWeight: 700, outline: "none" }}
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
        ) : (
          activeTab === "badges" ? (
          <div key="badges" className="timer-tab-panel">
            <BadgeCollection stats={myStats} todaySeconds={myTodayTotalNow} />
          </div>
          ) : (
            <div key="analysis" className="timer-tab-panel">
              <StudyAnalysis analysis={analysis} loading={analysisLoading} onRefresh={fetchAnalysis} />
            </div>
          )
        )}
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
              <button type="button" onClick={() => { setActiveTab("friends"); setSelectedUser(null); }} style={modalPrimaryButtonStyle}>친구 타이머 보기</button>
            ) : incomingRequests.some((request) => request.userId === selectedUser.userId) ? (
              <button type="button" onClick={() => { setActiveTab("friends"); setSelectedUser(null); }} style={modalPrimaryButtonStyle}>받은 요청 확인하기</button>
            ) : outgoingRequests.some((request) => request.userId === selectedUser.userId) ? (
              <button type="button" onClick={() => setSelectedUser(null)} style={modalSecondaryButtonStyle}>요청 대기중</button>
            ) : (
              <button type="button" onClick={() => sendFriendRequest(selectedUser.userId)} style={modalPrimaryButtonStyle}>친구 요청 보내기</button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes litPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(55,135,255,0.45); }
          50% { box-shadow: 0 0 0 10px rgba(55,135,255,0); }
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
      `}</style>
    </div>
  );
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
        background: isRunning ? "var(--c-inverse)" : PRIMARY,
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: compact
          ? isRunning ? "0 8px 16px rgba(17,24,39,0.16)" : "0 8px 16px rgba(55,135,255,0.25)"
          : isRunning ? "0 16px 34px rgba(17,24,39,0.18)" : "0 16px 34px rgba(55,135,255,0.32)",
      }}
    >
      {isRunning ? (
        <svg width={compact ? 12 : 19} height={compact ? 12 : 19} viewBox="0 0 24 24" fill="#fff">
          <rect x="6" y="5" width="4" height="14" rx="1"/>
          <rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
      ) : (
        <svg width={compact ? 13 : 20} height={compact ? 13 : 20} viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: compact ? 2 : 3 }}>
          <polygon points="7,4 20,12 7,20" />
        </svg>
      )}
    </button>
  );
}

function BadgeCollection({ stats, todaySeconds }: { stats: TimerStats | null; todaySeconds: number }) {
  const unlockedCount = BADGES.filter((badge) => isBadgeUnlocked(badge, stats, todaySeconds)).length;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text-c)" }}>내 뱃지</h2>
          <p style={{ marginTop: 3, fontSize: 12, color: TEXT_MUTED, fontWeight: 700 }}>
            {unlockedCount}/{BADGES.length} 해금
          </p>
        </div>
        <span style={{ padding: "7px 10px", borderRadius: 999, background: "var(--c-brand-soft-3)", color: PRIMARY, fontSize: 12, fontWeight: 700 }}>
          연속 {stats?.streakDays || 0}일
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {BADGES.map((badge) => {
          const unlocked = isBadgeUnlocked(badge, stats, todaySeconds);
          return (
            <div
              key={badge.id}
              style={{
                minHeight: 154,
                borderRadius: 16,
                border: "1px solid var(--c-bg-muted-9)",
                background: unlocked ? "var(--c-bg)" : "var(--c-bg-soft)",
                padding: 9,
                textAlign: "center",
                overflow: "hidden",
                boxShadow: unlocked ? "0 8px 18px rgba(15,23,42,0.05)" : "none",
              }}
            >
              <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", marginBottom: 6 }}>
                <img
                  src={unlocked ? badge.image : LOCKED_BADGE_IMAGE}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: unlocked ? 1 : 0.42,
                    filter: unlocked ? "none" : "grayscale(0.15)",
                  }}
                />
                {!unlocked && (
                  <span style={{ position: "absolute", left: "50%", bottom: 5, transform: "translateX(-50%)", padding: "4px 8px", borderRadius: 999, background: "rgba(17,24,39,0.76)", color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    미해금
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: unlocked ? "var(--c-text)" : "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {badge.title}
              </p>
              <p style={{ marginTop: 3, fontSize: 10.5, lineHeight: 1.25, color: TEXT_MUTED, fontWeight: 700 }}>
                {badge.condition}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StudyAnalysis({ analysis, loading, onRefresh }: { analysis: TimerAnalysis | null; loading: boolean; onRefresh: () => void }) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!analysis?.days.length) return;
    const latest = analysis.days[analysis.days.length - 1];
    setSelectedDate((prev) => prev || latest.date);
  }, [analysis]);

  const days = analysis?.days || [];
  const selectedDay = days.find((day) => day.date === selectedDate) || days[days.length - 1] || null;

  useEffect(() => {
    setMemo(selectedDay?.memo || "");
  }, [selectedDay?.date, selectedDay?.memo]);

  const saveMemo = async () => {
    if (!selectedDay) return;
    setSaving(true);
    try {
      const res = await fetch("/api/timer/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDay.date, memo }),
      });
      if (res.ok) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading && !analysis) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--c-bg-muted)", borderTopColor: PRIMARY, borderRadius: "50%", animation: "timerSpin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ padding: 28, borderRadius: 18, background: "var(--c-bg-soft)", border: "1px solid var(--c-bg-muted)", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--c-text-3)", fontWeight: 700 }}>분석 정보를 불러오지 못했어요.</p>
        <button type="button" onClick={onRefresh} style={{ marginTop: 12, height: 38, padding: "0 14px", border: "none", borderRadius: 12, background: PRIMARY, color: "#fff", fontSize: 13, fontWeight: 700 }}>다시 불러오기</button>
      </div>
    );
  }

  const maxSeconds = Math.max(...analysis.days.map((day) => day.totalSeconds), 1);
  const recent7 = analysis.days.slice(-7);
  const topDays = [...analysis.days].sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 5);
  const firstDate = new Date(`${analysis.days[0]?.date || ""}T00:00:00`);
  const leadingBlankCount = Number.isNaN(firstDate.getTime()) ? 0 : (firstDate.getDay() + 6) % 7;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <AnalysisStat label="최근 35일" value={formatHours(analysis.summary.totalSeconds)} />
        <AnalysisStat label="공부한 날" value={`${analysis.summary.activeDays}일`} />
        <AnalysisStat label="평균" value={formatHours(analysis.summary.averageSeconds)} />
      </div>

      <div style={{ borderRadius: 18, border: "1px solid var(--c-bg-muted-9)", background: "var(--c-bg)", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text-c)" }}>공부 달력</h2>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 700 }}>최근 5주</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
            <span key={day} style={{ textAlign: "center", fontSize: 11, color: TEXT_MUTED, fontWeight: 700 }}>{day}</span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {Array.from({ length: leadingBlankCount }).map((_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {analysis.days.map((day) => {
            const active = day.date === selectedDay?.date;
            const intensity = day.totalSeconds / maxSeconds;
            const bg = day.totalSeconds > 0 ? `rgba(55,135,255,${0.16 + intensity * 0.72})` : "var(--c-bg-muted)";
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                style={{
                  aspectRatio: "1/1",
                  borderRadius: 10,
                  border: active ? `2px solid ${PRIMARY}` : "1px solid transparent",
                  background: bg,
                  color: day.totalSeconds > maxSeconds * 0.55 ? "#fff" : "var(--c-text)",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: 0,
                }}
              >
                {Number(day.date.slice(-2))}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div style={{ borderRadius: 18, border: "1px solid var(--c-bg-muted-9)", background: "var(--c-bg)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 13, color: TEXT_MUTED, fontWeight: 700 }}>{selectedDay.date}</p>
              <h3 style={{ marginTop: 2, fontSize: 18, color: "var(--c-text-c)", fontWeight: 700 }}>{formatHours(selectedDay.totalSeconds)}</h3>
            </div>
            <span style={{ padding: "7px 10px", borderRadius: 999, background: PRIMARY_SOFTER, color: PRIMARY, fontSize: 12, fontWeight: 700 }}>
              {selectedDay.sessionCount}회
            </span>
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="오늘 공부 메모를 남겨보세요."
            maxLength={500}
            style={{ width: "100%", minHeight: 92, resize: "vertical", borderRadius: 14, border: "1px solid var(--c-border)", background: "var(--c-bg-soft)", padding: 12, color: "var(--c-text-c)", fontSize: 14, lineHeight: 1.5, outline: "none" }}
          />
          <button type="button" onClick={saveMemo} disabled={saving} style={{ marginTop: 8, width: "100%", height: 42, border: "none", borderRadius: 12, background: PRIMARY, color: "#fff", fontSize: 14, fontWeight: 700 }}>
            {saving ? "저장 중" : "메모 저장"}
          </button>
        </div>
      )}

      <div style={{ borderRadius: 18, border: "1px solid var(--c-bg-muted-9)", background: "var(--c-bg)", padding: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text-c)", marginBottom: 12 }}>최근 7일 그래프</h2>
        <div style={{ height: 150, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", alignItems: "end", gap: 8 }}>
          {recent7.map((day) => {
            const height = Math.max(8, Math.round((day.totalSeconds / maxSeconds) * 132));
            return (
              <div key={day.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div title={formatHours(day.totalSeconds)} style={{ width: "100%", height, borderRadius: "10px 10px 4px 4px", background: day.totalSeconds > 0 ? PRIMARY : "var(--c-border)" }} />
                <span style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>{Number(day.date.slice(-2))}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderRadius: 18, border: "1px solid var(--c-bg-muted-9)", background: "var(--c-bg)", overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--c-bg-muted)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text-c)" }}>공부 분석 표</h2>
        </div>
        {[
          { label: "가장 많이 공부한 날", value: analysis.summary.bestDay ? `${analysis.summary.bestDay.date} · ${formatHours(analysis.summary.bestDay.totalSeconds)}` : "-" },
          { label: "최근 7일 합계", value: formatHours(analysis.summary.recent7TotalSeconds) },
          { label: "공부한 날 평균", value: formatHours(analysis.summary.averageSeconds) },
          { label: "상위 기록", value: topDays.filter((day) => day.totalSeconds > 0).map((day) => `${day.date.slice(5)} ${formatHours(day.totalSeconds)}`).join(" / ") || "-" },
        ].map((row, index) => (
          <div key={row.label} style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: 10, padding: "12px 14px", borderBottom: index === 3 ? "none" : "1px solid var(--c-bg-muted)" }}>
            <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 700 }}>{row.label}</span>
            <span style={{ fontSize: 13, color: "var(--c-text)", fontWeight: 700, lineHeight: 1.45 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalysisStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minHeight: 72, borderRadius: 16, background: PRIMARY_SOFTER, border: `1px solid ${ACCENT_BG}`, padding: 12 }}>
      <p style={{ fontSize: 11, color: "var(--c-brand-deep-6)", fontWeight: 700 }}>{label}</p>
      <p style={{ marginTop: 7, fontSize: 15, color: "var(--c-text)", fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

function isBadgeUnlocked(
  badge: (typeof BADGES)[number],
  stats: TimerStats | null,
  todaySeconds: number
) {
  if (!stats) return false;
  if (badge.type === "today") return todaySeconds >= badge.target;
  if (badge.type === "total") return stats.totalStudySeconds >= badge.target;
  if (badge.type === "activeDays") return stats.activeDays >= badge.target;
  if (badge.type === "streak") return stats.streakDays >= badge.target;
  return stats.completedSessionCount >= badge.target;
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
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%",
          background: lit
            ? "linear-gradient(135deg, var(--c-brand-line-4) 0%, var(--c-brand-soft) 100%)"
            : "var(--c-bg-muted)",
          border: user.isMe
            ? `2.5px solid ${PRIMARY}`
            : lit
              ? `2px solid ${PRIMARY}`
              : "2px solid var(--c-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
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
                width: "100%", height: "100%", objectFit: "cover",
                opacity: lit ? 1 : 0.45,
                filter: lit ? "none" : "grayscale(1)",
              }}
            />
          ) : (
            <img src={lit ? DEFAULT_STUDYING_AVATAR : DEFAULT_RESTING_AVATAR} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: lit ? 1 : 0.62 }} />
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
