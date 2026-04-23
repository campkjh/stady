"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LoginRequired from "@/components/LoginRequired";

interface TimerUser {
  userId: string;
  nickname: string;
  avatar: string | null;
  isActive: boolean;
  subject: string | null;
  activeStartedAt: string | null;
  activeElapsedSeconds: number;
  todayTotalSeconds: number;
  isMe: boolean;
}

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

export default function TimerPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [users, setUsers] = useState<TimerUser[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [myElapsed, setMyElapsed] = useState(0);
  const [subject, setSubject] = useState("공부중");
  const [editingSubject, setEditingSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
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
        setSubject(data.mySession.subject || "공부중");
      } else {
        setIsRunning(false);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn !== true) return;
    fetchData();
    pollRef.current = setInterval(fetchData, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn]);

  // Tick my timer
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setMyElapsed((p) => p + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Ping every 30s
  useEffect(() => {
    if (!isRunning) return;
    pingRef.current = setInterval(() => {
      fetch("/api/timer/ping", { method: "POST" }).catch(() => {});
    }, 30000);
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [isRunning]);

  const start = async () => {
    const res = await fetch("/api/timer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject || "공부중" }),
    });
    if (res.ok) {
      setIsRunning(true);
      setMyElapsed(0);
      fetchData();
    }
  };

  const stop = async () => {
    await fetch("/api/timer/stop", { method: "POST" });
    setIsRunning(false);
    setMyElapsed(0);
    fetchData();
  };

  const myUser = useMemo(() => users.find((u) => u.isMe), [users]);
  const myTodayTotal = (myUser?.todayTotalSeconds || 0) - (myUser?.activeElapsedSeconds || 0) + myElapsed;

  const activeUsers = useMemo(() => users.filter((u) => u.isActive), [users]);
  const todayRanking = useMemo(
    () => [...users].filter((u) => u.todayTotalSeconds > 0).sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds),
    [users]
  );

  if (isLoggedIn === null) return null;
  if (isLoggedIn === false) return <LoginRequired />;

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10, backgroundColor: "#fff",
        padding: "20px 20px 12px",
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>타이머</h1>
      </div>

      {/* My Timer Card */}
      <div style={{ padding: "4px 20px 24px" }}>
        <div style={{
          background: "linear-gradient(135deg, #FFF7EC 0%, #FFEBD6 100%)",
          border: "1px solid #FFE1C0",
          borderRadius: 24,
          padding: "22px 22px 20px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative dots */}
          <div style={{
            position: "absolute", top: -20, right: -20, width: 120, height: 120,
            borderRadius: "50%", background: "rgba(255,140,63,0.08)",
          }} />
          <div style={{
            position: "absolute", bottom: -30, right: 30, width: 80, height: 80,
            borderRadius: "50%", background: "rgba(255,140,63,0.06)",
          }} />

          <p style={{ fontSize: 13, color: "#B36A2B", fontWeight: 600, marginBottom: 6, position: "relative" }}>
            오늘 공부 시간
          </p>
          <p style={{ fontSize: 13, color: "#9A6430", marginBottom: 14, position: "relative" }}>
            누적 <span style={{ fontWeight: 700, color: "#6B3B0D" }}>{formatShort(myTodayTotal)}</span>
          </p>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 18, position: "relative" }}>
            <span style={{
              fontSize: 44, fontWeight: 800, color: "#111", letterSpacing: -1.5,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {formatTime(myElapsed)}
            </span>
          </div>

          {/* Subject + control */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", borderRadius: 14,
            background: "#fff", border: "1px solid #FFE1C0",
            position: "relative",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6, background: "#FF8C3F",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6l2 4H2z"/><path d="M12 3h10v18H2V11"/><path d="M2 11h20"/>
              </svg>
            </div>
            {editingSubject && !isRunning ? (
              <input
                type="text"
                autoFocus
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onBlur={() => setEditingSubject(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingSubject(false); }}
                maxLength={30}
                style={{
                  flex: 1, fontSize: 15, fontWeight: 600, color: "#111",
                  background: "none", border: "none", outline: "none",
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => { if (!isRunning) setEditingSubject(true); }}
                style={{
                  flex: 1, fontSize: 15, fontWeight: 600, color: "#111",
                  background: "none", border: "none", textAlign: "left",
                  padding: 0, cursor: isRunning ? "default" : "pointer",
                }}
              >
                {subject}
              </button>
            )}
            <button
              type="button"
              onClick={isRunning ? stop : start}
              className="press"
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: isRunning ? "#111" : "#FF8C3F",
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(255,140,63,0.3)",
              }}
            >
              {isRunning ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                  <rect x="6" y="5" width="4" height="14" rx="1"/>
                  <rect x="14" y="5" width="4" height="14" rx="1"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Users Section */}
      <div style={{ padding: "0 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111" }}>지금 공부중인 유저</h2>
          <span style={{ fontSize: 13, color: "#FF8C3F", fontWeight: 600 }}>
            {activeCount}명
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 24, height: 24, border: "2px solid #F3F4F6", borderTopColor: "#FF8C3F", borderRadius: "50%", animation: "timerSpin 0.8s linear infinite" }} />
            <style>{`@keyframes timerSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : activeUsers.length === 0 ? (
          <div style={{
            padding: "32px 20px", borderRadius: 16,
            background: "#F9FAFB", border: "1px solid #F3F4F6",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>
              지금 공부 중인 유저가 없어요
            </p>
            <p style={{ fontSize: 12, color: "#9CA3AF" }}>
              먼저 시작해볼까요?
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {activeUsers.map((u) => (
              <UserCard key={u.userId} user={u} />
            ))}
          </div>
        )}

        {/* Today's ranking for all users with time */}
        {todayRanking.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111" }}>오늘 공부 시간</h2>
              <span style={{ fontSize: 13, color: "#9CA3AF" }}>전체 {totalCount}명</span>
            </div>
            <div style={{
              borderRadius: 16, border: "1px solid #F3F4F6", overflow: "hidden",
              background: "#fff",
            }}>
              {todayRanking.map((u, i) => (
                <RankingRow key={u.userId} user={u} rank={i + 1} isLast={i === todayRanking.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({ user }: { user: TimerUser }) {
  const [elapsed, setElapsed] = useState(user.activeElapsedSeconds);

  useEffect(() => {
    setElapsed(user.activeElapsedSeconds);
    if (!user.isActive) return;
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [user.userId, user.activeElapsedSeconds, user.isActive]);

  const totalToday = user.todayTotalSeconds - user.activeElapsedSeconds + elapsed;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    }}>
      {/* Avatar bubble */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1/1",
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%",
          background: user.isActive ? "#FFF4E6" : "#F5F6F8",
          border: user.isMe ? "2.5px solid #FF8C3F" : user.isActive ? "2px solid #FFD4A8" : "2px solid #EEF0F3",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}>
          {user.avatar ? (
            <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : user.isActive ? (
            // Person studying icon
            <svg width="52%" height="52%" viewBox="0 0 60 60" fill="none">
              <circle cx="30" cy="22" r="9" fill="#FF8C3F" />
              <path d="M14 48 Q14 36 30 36 Q46 36 46 48 Z" fill="#FF8C3F" />
              <rect x="20" y="42" width="20" height="3" rx="1.5" fill="#FFE1C0" />
            </svg>
          ) : (
            // Empty desk icon
            <svg width="52%" height="52%" viewBox="0 0 60 60" fill="none" stroke="#BDC2CB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="16" r="3" />
              <path d="M18 19 V28 M14 28 H22" />
              <path d="M12 42 H48" />
              <path d="M14 42 V52 M46 42 V52" />
              <path d="M22 32 H44 V42" strokeLinejoin="miter" />
            </svg>
          )}
        </div>
        {user.isActive && (
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: 12, height: 12, borderRadius: "50%",
            background: "#22C55E", border: "2px solid #fff",
          }} />
        )}
      </div>

      {/* Name */}
      <p style={{
        fontSize: 13, fontWeight: 700,
        color: user.isActive ? "#111" : "#9CA3AF",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {user.nickname}
      </p>

      {/* Timer or today total */}
      <p style={{
        fontSize: 12, fontWeight: 700,
        color: user.isActive ? "#FF8C3F" : "#BDC2CB",
        fontVariantNumeric: "tabular-nums",
      }}>
        {user.isActive ? formatTime(elapsed) : totalToday > 0 ? formatShort(totalToday) : "오프라인"}
      </p>
    </div>
  );
}

function RankingRow({ user, rank, isLast }: { user: TimerUser; rank: number; isLast: boolean }) {
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
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: isLast ? "none" : "1px solid #F3F4F6",
      background: user.isMe ? "#FFF7EC" : "#fff",
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
        background: user.isActive ? "#FFF4E6" : "#F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        border: user.isActive ? "2px solid #FFD4A8" : "none",
        flexShrink: 0,
      }}>
        {user.avatar ? (
          <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={user.isActive ? "#FF8C3F" : "#9CA3AF"} strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: "#111",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {user.nickname}
          {user.isMe && <span style={{ marginLeft: 6, fontSize: 11, color: "#FF8C3F" }}>나</span>}
        </p>
        {user.isActive && user.subject && (
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{user.subject}</p>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700,
          color: user.isActive ? "#FF8C3F" : "#111",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatShort(totalToday)}
        </p>
        {user.isActive && (
          <p style={{
            fontSize: 10, color: "#22C55E", marginTop: 1, fontWeight: 600,
          }}>
            ● 공부 중
          </p>
        )}
      </div>
    </div>
  );
}
