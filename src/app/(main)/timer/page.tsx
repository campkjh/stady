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

const PRIMARY = "#3787FF";
const PRIMARY_DARK = "#1F5EDC";
const PRIMARY_SOFT = "#E8F0FE";
const PRIMARY_SOFTER = "#F4F8FF";
const ACCENT_BG = "#D3E4FF";
const TEXT_MUTED = "#9CA3AF";
const OFFLINE_FILL = "#E5E7EB";

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
  const [activeTab, setActiveTab] = useState<"status" | "ranking">("status");
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

  // Sort: active (by elapsed desc) → inactive (by today total desc) → never studied
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
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

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10, backgroundColor: "#fff",
        padding: "20px 20px 0",
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111", marginBottom: 14 }}>타이머</h1>

        {/* Tabs */}
        <div style={{ position: "relative", display: "flex", gap: 24, borderBottom: "1px solid #F3F4F6" }}>
          {[
            { key: "status", label: "공부 현황" },
            { key: "ranking", label: "오늘 공부 시간" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "status" | "ranking")}
                data-tab={tab.key}
                style={{
                  position: "relative", padding: "10px 0",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 15, fontWeight: 700,
                  color: isActive ? PRIMARY : TEXT_MUTED,
                  transition: "color 0.25s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
          {/* Sliding indicator */}
          <span
            style={{
              position: "absolute", bottom: -1, height: 2.5,
              background: PRIMARY, borderRadius: 2,
              left: activeTab === "status" ? 0 : "calc(5ch + 24px)",
              width: activeTab === "status" ? "5ch" : "8ch",
              transition: "left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      </div>

      {/* My Timer Card */}
      <div style={{ padding: "4px 20px 24px" }}>
        <div style={{
          background: `linear-gradient(135deg, ${PRIMARY_SOFTER} 0%, ${PRIMARY_SOFT} 100%)`,
          border: `1px solid ${ACCENT_BG}`,
          borderRadius: 24,
          padding: "22px 22px 20px",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -20, right: -20, width: 120, height: 120,
            borderRadius: "50%", background: "rgba(55,135,255,0.08)",
          }} />
          <div style={{
            position: "absolute", bottom: -30, right: 30, width: 80, height: 80,
            borderRadius: "50%", background: "rgba(55,135,255,0.06)",
          }} />

          <p style={{ fontSize: 13, color: PRIMARY_DARK, fontWeight: 600, marginBottom: 6, position: "relative" }}>
            오늘 공부 시간
          </p>
          <p style={{ fontSize: 13, color: "#4A6BB0", marginBottom: 14, position: "relative" }}>
            누적 <span style={{ fontWeight: 700, color: "#0F3A8E" }}>{formatShort(myTodayTotal)}</span>
          </p>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 18, position: "relative" }}>
            <span style={{
              fontSize: 44, fontWeight: 800, color: "#111", letterSpacing: -1.5,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {formatTime(myElapsed)}
            </span>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", borderRadius: 14,
            background: "#fff", border: `1px solid ${ACCENT_BG}`,
            position: "relative",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6, background: PRIMARY,
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
                background: isRunning ? "#111" : PRIMARY,
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 4px 12px rgba(55,135,255,0.3)`,
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
                  <UserCard key={u.userId} user={u} />
                ))}
              </div>
            )}
          </div>
        ) : (
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
                  <RankingRow key={u.userId} user={u} rank={i + 1} isLast={i === todayRanking.length - 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .timer-tab-panel {
          animation: tabPanelIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
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
  const lit = user.isActive;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
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
            <svg width="54%" height="54%" viewBox="0 0 60 60" fill="none">
              <circle cx="30" cy="22" r="9" fill={lit ? PRIMARY : "#C8CDD5"} />
              <path d="M14 48 Q14 36 30 36 Q46 36 46 48 Z" fill={lit ? PRIMARY : "#C8CDD5"} />
              <rect x="20" y="42" width="20" height="3" rx="1.5" fill={lit ? "#B7D0FF" : "#E5E7EB"} />
            </svg>
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
      }}>
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
      background: user.isMe ? PRIMARY_SOFTER : "#fff",
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={user.isActive ? PRIMARY : "#9CA3AF"} strokeWidth="2">
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
