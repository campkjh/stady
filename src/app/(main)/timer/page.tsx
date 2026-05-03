"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";

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

const PRIMARY = "#3787FF";
const PRIMARY_DARK = "#1F5EDC";
const PRIMARY_SOFT = "#E8F0FE";
const PRIMARY_SOFTER = "#F4F8FF";
const ACCENT_BG = "#D3E4FF";
const TEXT_MUTED = "#9CA3AF";
const OFFLINE_FILL = "#E5E7EB";
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

function formatShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function formatHours(sec: number): string {
  if (sec <= 0) return "0시간";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

export default function TimerPage() {
  const router = useRouter();
  const [startMessage] = useState(() => START_MESSAGES[Math.floor(Math.random() * START_MESSAGES.length)]);
  const [compactProgress, setCompactProgress] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [users, setUsers] = useState<TimerUser[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [myElapsed, setMyElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"status" | "ranking" | "friends" | "badges" | "analysis">("status");
  const [selectedUser, setSelectedUser] = useState<TimerUser | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<TimerUser[]>([]);
  const [myStats, setMyStats] = useState<TimerStats | null>(null);
  const [analysis, setAnalysis] = useState<TimerAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const next = Math.min(1, Math.max(0, window.scrollY / 130));
      setCompactProgress(next);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/timer/sessions");
      const data = await res.json();
      setUsers(data.users || []);
      setActiveCount(data.activeCount || 0);
      setTotalCount(data.totalCount || 0);
      if (data.mySession) {
        setIsRunning(true);
        setMyElapsed(data.mySession.activeElapsedSeconds);
      } else {
        setIsRunning(false);
      }
      setMyStats(data.myStats || null);
    } catch {}
    setLoading(false);
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/timer/friends");
      if (!res.ok) return;
      const data = await res.json();
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
      setFriends(data.friends || []);
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

  useEffect(() => {
    if (isLoggedIn !== true) return;
    fetchData();
    fetchFriends();
    pollRef.current = setInterval(() => {
      fetchData();
      fetchFriends();
    }, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn === true && activeTab === "analysis" && !analysis) {
      fetchAnalysis();
    }
  }, [isLoggedIn, activeTab, analysis]);

  const sendFriendRequest = async (userId: string) => {
    await fetch("/api/timer/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setSelectedUser(null);
    fetchFriends();
  };

  const respondFriendRequest = async (requestId: string, action: "accept" | "reject") => {
    await fetch("/api/timer/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    fetchFriends();
  };

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => setMyElapsed((p) => p + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

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
      setMyElapsed(0);
      setUsers((prev) => prev.map((user) => user.isMe ? { ...user, isActive: true, subject: "공부중", activeElapsedSeconds: 0 } : user));
      setTimeout(() => fetchData(), 350);
    }
  };

  const stop = async () => {
    const res = await fetch("/api/timer/stop", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    const finishedSeconds = Number(data.session?.totalSeconds || myElapsed || 0);
    setIsRunning(false);
    setMyElapsed(0);
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
  const myTodayTotal = (myUser?.todayTotalSeconds || 0) - (myUser?.activeElapsedSeconds || 0) + myElapsed;

  // Sort: active (by elapsed desc) → inactive (by today total desc) → never studied
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isActive && b.isActive) return b.activeElapsedSeconds - a.activeElapsedSeconds;
      return b.todayTotalSeconds - a.todayTotalSeconds;
    });
  }, [users]);

  const todayRanking = useMemo(
    () => [...users].filter((u) => u.todayTotalSeconds > 0).sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds),
    [users]
  );

  if (isLoggedIn === null) return null;
  if (isLoggedIn === false) return <LoginRequired />;

  const compactOpacity = compactProgress > 0.14 ? compactProgress : 0;
  const expandedOpacity = 1 - compactProgress;
  const heroHeight = 264 - compactProgress * 196;
  const fixedHeroHeight = heroHeight + compactProgress * 20;

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Timer Hero */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        height: fixedHeroHeight,
        boxSizing: "border-box",
        overflow: "visible",
        background: `linear-gradient(180deg, ${PRIMARY_SOFTER} 0%, rgba(255,255,255,0.98) 100%)`,
        padding: `${20 - compactProgress * 8}px 20px ${40 - compactProgress * 28}px`,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 82% 8%, rgba(55,135,255,0.16), transparent 40%)", opacity: expandedOpacity }} />
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: fixedHeroHeight,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.9) 56%, rgba(255,255,255,0) 100%)",
          opacity: compactProgress,
          pointerEvents: "none",
        }} />
        <header style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          marginBottom: 28 * (1 - compactProgress),
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>타이머</h1>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: compactOpacity,
            transform: `translateX(${18 - compactProgress * 18}px) scale(${0.94 + compactProgress * 0.06})`,
            pointerEvents: compactProgress > 0.55 ? "auto" : "none",
            transition: "opacity 0.12s linear",
          }}>
            <span style={{
              fontSize: 19,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: 0,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
              {formatTime(myElapsed)}
            </span>
            <div style={{ position: "relative" }}>
              <TimerControlButton isRunning={isRunning} onClick={isRunning ? stop : start} compact />
            </div>
          </div>
        </header>

        <div style={{
          position: "relative",
          textAlign: "center",
          maxHeight: 176 * (1 - compactProgress),
          opacity: expandedOpacity,
          transform: `translateY(${-12 * compactProgress}px) scale(${1 - compactProgress * 0.12})`,
          overflow: "hidden",
          pointerEvents: compactProgress < 0.82 ? "auto" : "none",
        }}>
          <p style={{ fontSize: 13, color: "#4A6BB0", fontWeight: 800, marginBottom: 10 }}>
            오늘 {formatShort(myTodayTotal)}
          </p>
          <p style={{
            fontSize: 58,
            fontWeight: 700,
            color: "#111827",
            letterSpacing: 0,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            marginBottom: 18,
          }}>
            {formatTime(myElapsed)}
          </p>

          <div style={{ position: "relative", display: "inline-flex", justifyContent: "center" }}>
            {!isRunning && <TimerStartBubble message={startMessage} />}
            <TimerControlButton isRunning={isRunning} onClick={isRunning ? stop : start} />
          </div>
        </div>
      </div>

      <div style={{ height: heroHeight }} />

      {/* Tabs */}
      <div style={{ position: "sticky", top: heroHeight, zIndex: 20, backgroundColor: "#fff", padding: "0 20px" }}>
        <div style={{ position: "relative", display: "flex", gap: 22, borderBottom: "1px solid #F3F4F6", overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            { key: "status", label: "공부 현황" },
            { key: "ranking", label: "오늘 공부 시간" },
            { key: "friends", label: `친구${incomingRequests.length > 0 ? ` ${incomingRequests.length}` : ""}` },
            { key: "badges", label: "뱃지" },
            { key: "analysis", label: "분석" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "status" | "ranking" | "friends" | "badges" | "analysis")}
                data-tab={tab.key}
                style={{
                  position: "relative", padding: "12px 0 10px",
                  background: "none", border: "none", borderBottom: isActive ? `2.5px solid ${PRIMARY}` : "2.5px solid transparent", cursor: "pointer",
                  fontSize: 15, fontWeight: 700,
                  color: isActive ? PRIMARY : TEXT_MUTED,
                  transition: "color 0.25s ease, border-color 0.25s ease",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: "20px 20px 40px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 24, height: 24, border: "2px solid #F3F4F6", borderTopColor: PRIMARY, borderRadius: "50%", animation: "timerSpin 0.8s linear infinite" }} />
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
                background: "#F9FAFB", border: "1px solid #F3F4F6",
                textAlign: "center",
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>
                  아직 등록된 유저가 없습니다
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {sortedUsers.map((u) => (
                  <UserCard
                    key={u.userId}
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
                background: "#F9FAFB", border: "1px solid #F3F4F6",
                textAlign: "center",
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>
                  아직 오늘 공부한 기록이 없어요
                </p>
                <p style={{ fontSize: 12, color: "#9CA3AF" }}>첫 번째 기록을 남겨보세요!</p>
              </div>
            ) : (
              <div style={{
                borderRadius: 16, border: "1px solid #F3F4F6", overflow: "hidden",
                background: "#fff",
              }}>
                {todayRanking.map((u, i) => (
                  <RankingRow key={u.userId} user={u} rank={i + 1} isLast={i === todayRanking.length - 1} onOpen={() => setSelectedUser(u)} />
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "friends" ? (
          <div key="friends" className="timer-tab-panel">
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
                    <div key={request.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                      <Avatar user={request} size={36} />
                      <b style={{ flex: 1, fontSize: 14, color: "#111" }}>{request.nickname}</b>
                      <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 700 }}>대기중</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 10 }}>친구 타이머</p>
            {friends.length === 0 ? (
              <div style={{ padding: "32px 20px", borderRadius: 16, background: "#F9FAFB", border: "1px solid #F3F4F6", textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>아직 친구가 없어요</p>
                <p style={{ fontSize: 12, color: TEXT_MUTED }}>공부 현황에서 프로필을 눌러 친구 요청을 보내보세요.</p>
              </div>
            ) : (
              <div style={{ borderRadius: 16, border: "1px solid #F3F4F6", overflow: "hidden", background: "#fff" }}>
                {friends
                  .sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds)
                  .map((friend, index) => (
                    <RankingRow key={friend.userId} user={friend} rank={index + 1} isLast={index === friends.length - 1} />
                  ))}
              </div>
            )}
          </div>
        ) : (
          activeTab === "badges" ? (
          <div key="badges" className="timer-tab-panel">
            <BadgeCollection stats={myStats} todaySeconds={myTodayTotal} />
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
          <div style={{ position: "relative", width: "100%", maxWidth: 360, background: "#fff", borderRadius: 22, padding: 22, textAlign: "center", boxShadow: "0 16px 48px rgba(15,23,42,0.18)" }}>
            <div style={{ width: 86, height: 86, margin: "0 auto 12px" }}>
              <Avatar user={selectedUser} size={86} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111", marginBottom: 4 }}>{selectedUser.nickname}</h2>
            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 18 }}>
              오늘 {formatShort(selectedUser.todayTotalSeconds)}
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

function TimerStartBubble({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div style={{
      position: "absolute",
      left: "50%",
      bottom: compact ? 36 : 72,
      transform: "translateX(-50%)",
      minWidth: compact ? 92 : 112,
      padding: compact ? "7px 9px" : "8px 12px",
      borderRadius: 999,
      background: "#fff",
      border: "1px solid #DCE8FF",
      color: PRIMARY_DARK,
      fontSize: compact ? 11 : 12,
      fontWeight: 900,
      lineHeight: 1,
      whiteSpace: "nowrap",
      boxShadow: "0 10px 22px rgba(55,135,255,0.14)",
      pointerEvents: "none",
      zIndex: 2,
    }}>
      {message}
      <span style={{
        position: "absolute",
        left: "50%",
        bottom: -5,
        width: 9,
        height: 9,
        background: "#fff",
        borderRight: "1px solid #DCE8FF",
        borderBottom: "1px solid #DCE8FF",
        transform: "translateX(-50%) rotate(45deg)",
      }} />
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
        background: isRunning ? "#111827" : PRIMARY,
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
          <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111" }}>내 뱃지</h2>
          <p style={{ marginTop: 3, fontSize: 12, color: TEXT_MUTED, fontWeight: 700 }}>
            {unlockedCount}/{BADGES.length} 해금
          </p>
        </div>
        <span style={{ padding: "7px 10px", borderRadius: 999, background: "#EEF5FF", color: PRIMARY, fontSize: 12, fontWeight: 900 }}>
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
                border: "1px solid #EEF2F7",
                background: unlocked ? "#fff" : "#F9FAFB",
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
                  <span style={{ position: "absolute", left: "50%", bottom: 5, transform: "translateX(-50%)", padding: "4px 8px", borderRadius: 999, background: "rgba(17,24,39,0.76)", color: "#fff", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
                    미해금
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, fontWeight: 900, color: unlocked ? "#111827" : "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        <div style={{ width: 24, height: 24, border: "2px solid #F3F4F6", borderTopColor: PRIMARY, borderRadius: "50%", animation: "timerSpin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ padding: 28, borderRadius: 18, background: "#F9FAFB", border: "1px solid #F3F4F6", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#6B7280", fontWeight: 800 }}>분석 정보를 불러오지 못했어요.</p>
        <button type="button" onClick={onRefresh} style={{ marginTop: 12, height: 38, padding: "0 14px", border: "none", borderRadius: 12, background: PRIMARY, color: "#fff", fontSize: 13, fontWeight: 900 }}>다시 불러오기</button>
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

      <div style={{ borderRadius: 18, border: "1px solid #EEF2F7", background: "#fff", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111" }}>공부 달력</h2>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 800 }}>최근 5주</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
            <span key={day} style={{ textAlign: "center", fontSize: 11, color: TEXT_MUTED, fontWeight: 900 }}>{day}</span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {Array.from({ length: leadingBlankCount }).map((_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {analysis.days.map((day) => {
            const active = day.date === selectedDay?.date;
            const intensity = day.totalSeconds / maxSeconds;
            const bg = day.totalSeconds > 0 ? `rgba(55,135,255,${0.16 + intensity * 0.72})` : "#F3F4F6";
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
                  color: day.totalSeconds > maxSeconds * 0.55 ? "#fff" : "#111827",
                  fontSize: 10,
                  fontWeight: 900,
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
        <div style={{ borderRadius: 18, border: "1px solid #EEF2F7", background: "#fff", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 13, color: TEXT_MUTED, fontWeight: 800 }}>{selectedDay.date}</p>
              <h3 style={{ marginTop: 2, fontSize: 18, color: "#111", fontWeight: 900 }}>{formatHours(selectedDay.totalSeconds)}</h3>
            </div>
            <span style={{ padding: "7px 10px", borderRadius: 999, background: PRIMARY_SOFTER, color: PRIMARY, fontSize: 12, fontWeight: 900 }}>
              {selectedDay.sessionCount}회
            </span>
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="오늘 공부 메모를 남겨보세요."
            maxLength={500}
            style={{ width: "100%", minHeight: 92, resize: "vertical", borderRadius: 14, border: "1px solid #E5E7EB", background: "#F9FAFB", padding: 12, color: "#111", fontSize: 14, lineHeight: 1.5, outline: "none" }}
          />
          <button type="button" onClick={saveMemo} disabled={saving} style={{ marginTop: 8, width: "100%", height: 42, border: "none", borderRadius: 12, background: PRIMARY, color: "#fff", fontSize: 14, fontWeight: 900 }}>
            {saving ? "저장 중" : "메모 저장"}
          </button>
        </div>
      )}

      <div style={{ borderRadius: 18, border: "1px solid #EEF2F7", background: "#fff", padding: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111", marginBottom: 12 }}>최근 7일 그래프</h2>
        <div style={{ height: 150, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", alignItems: "end", gap: 8 }}>
          {recent7.map((day) => {
            const height = Math.max(8, Math.round((day.totalSeconds / maxSeconds) * 132));
            return (
              <div key={day.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div title={formatHours(day.totalSeconds)} style={{ width: "100%", height, borderRadius: "10px 10px 4px 4px", background: day.totalSeconds > 0 ? PRIMARY : "#E5E7EB" }} />
                <span style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 800 }}>{Number(day.date.slice(-2))}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderRadius: 18, border: "1px solid #EEF2F7", background: "#fff", overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111" }}>공부 분석 표</h2>
        </div>
        {[
          { label: "가장 많이 공부한 날", value: analysis.summary.bestDay ? `${analysis.summary.bestDay.date} · ${formatHours(analysis.summary.bestDay.totalSeconds)}` : "-" },
          { label: "최근 7일 합계", value: formatHours(analysis.summary.recent7TotalSeconds) },
          { label: "공부한 날 평균", value: formatHours(analysis.summary.averageSeconds) },
          { label: "상위 기록", value: topDays.filter((day) => day.totalSeconds > 0).map((day) => `${day.date.slice(5)} ${formatHours(day.totalSeconds)}`).join(" / ") || "-" },
        ].map((row, index) => (
          <div key={row.label} style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: 10, padding: "12px 14px", borderBottom: index === 3 ? "none" : "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 900 }}>{row.label}</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 800, lineHeight: 1.45 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalysisStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minHeight: 72, borderRadius: 16, background: PRIMARY_SOFTER, border: `1px solid ${ACCENT_BG}`, padding: 12 }}>
      <p style={{ fontSize: 11, color: "#4A6BB0", fontWeight: 900 }}>{label}</p>
      <p style={{ marginTop: 7, fontSize: 15, color: "#111827", fontWeight: 900, lineHeight: 1.2 }}>{value}</p>
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
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
    setElapsed(user.activeElapsedSeconds);
    if (!user.isActive) return;
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [user.userId, user.activeElapsedSeconds, user.isActive]);

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
          border: "1px solid #E5E7EB",
          background: "#fff",
          color: hasStatus ? "#111827" : "#C7CCD5",
          fontSize: 11,
          fontWeight: 900,
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
            background: "#fff",
            borderRight: "1px solid #E5E7EB",
            borderBottom: "1px solid #E5E7EB",
            transform: "translateX(-50%) rotate(45deg)",
          }}
        />
      </button>
      {/* Avatar bubble - 점등식 */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%",
          background: lit
            ? "linear-gradient(135deg, #D3E4FF 0%, #E8F0FE 100%)"
            : "#F3F4F6",
          border: user.isMe
            ? `2.5px solid ${PRIMARY}`
            : lit
              ? `2px solid ${PRIMARY}`
              : "2px solid #E5E7EB",
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
          border: "2.5px solid #fff",
          animation: lit ? "dotPulse 1.8s ease-in-out infinite" : "none",
          boxShadow: lit ? `0 0 8px ${PRIMARY}` : "none",
        }} />
      </div>

      <p style={{
        fontSize: 13, fontWeight: 700,
        color: lit ? "#111" : "#9CA3AF",
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
            fontWeight: 900,
            lineHeight: 1,
          }}>
            MY
          </span>
        )}
        {user.nickname}
      </p>

      <p style={{
        fontSize: 12, fontWeight: 700,
        color: lit ? PRIMARY : "#BDC2CB",
        fontVariantNumeric: "tabular-nums",
      }}>
        {lit ? formatTime(elapsed) : totalToday > 0 ? formatShort(totalToday) : "오프라인"}
      </p>
    </div>
  );
}

function FriendRequestRow({ request, onAccept, onReject }: { request: FriendRequest; onAccept: () => void; onReject: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, background: "#fff", border: "1px solid #E5E7EB" }}>
      <Avatar user={request} size={38} />
      <b style={{ flex: 1, fontSize: 14, color: "#111" }}>{request.nickname}</b>
      <button type="button" onClick={onReject} style={{ height: 32, padding: "0 10px", borderRadius: 10, border: "none", background: "#F3F4F6", color: "#6B7280", fontSize: 12, fontWeight: 800 }}>거절</button>
      <button type="button" onClick={onAccept} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "none", background: PRIMARY, color: "#fff", fontSize: 12, fontWeight: 800 }}>수락</button>
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
  fontWeight: 800,
};

const modalSecondaryButtonStyle = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "none",
  background: "#F3F4F6",
  color: "#6B7280",
  fontSize: 15,
  fontWeight: 800,
};

function RankingRow({ user, rank, isLast, onOpen }: { user: TimerUser; rank: number; isLast: boolean; onOpen?: () => void }) {
  const [elapsed, setElapsed] = useState(user.activeElapsedSeconds);

  useEffect(() => {
    setElapsed(user.activeElapsedSeconds);
    if (!user.isActive) return;
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [user.userId, user.activeElapsedSeconds, user.isActive]);

  const totalToday = user.todayTotalSeconds - user.activeElapsedSeconds + elapsed;
  const rankColor = rank === 1 ? "#F59E0B" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7F32" : "#D1D5DB";

  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: isLast ? "none" : "1px solid #F3F4F6",
      background: user.isMe ? PRIMARY_SOFTER : "#fff",
      cursor: onOpen ? "pointer" : "default",
    }}>
      <span style={{
        fontSize: 13, fontWeight: 800, color: rankColor,
        width: 20, textAlign: "center", flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}>
        {rank}
      </span>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: user.isActive ? PRIMARY_SOFT : "#F3F4F6",
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
          fontSize: 14, fontWeight: 700, color: "#111",
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
          color: user.isActive ? PRIMARY : "#111",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatShort(totalToday)}
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
