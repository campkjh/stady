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

interface FriendRequest {
  id: string;
  userId: string;
  nickname: string;
  avatar: string | null;
}

interface TimerStats {
  totalStudySeconds: number;
  activeDays: number;
  streakDays: number;
  completedSessionCount: number;
}

const PRIMARY = "#3787FF";
const PRIMARY_DARK = "#1F5EDC";
const PRIMARY_SOFT = "#E8F0FE";
const PRIMARY_SOFTER = "#F4F8FF";
const ACCENT_BG = "#D3E4FF";
const TEXT_MUTED = "#9CA3AF";
const OFFLINE_FILL = "#E5E7EB";
const LOCKED_BADGE_IMAGE = "/badges/locked.png";

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
  const [activeTab, setActiveTab] = useState<"status" | "ranking" | "friends" | "badges">("status");
  const [selectedUser, setSelectedUser] = useState<TimerUser | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<TimerUser[]>([]);
  const [myStats, setMyStats] = useState<TimerStats | null>(null);
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
        <div style={{ position: "relative", display: "flex", gap: 22, borderBottom: "1px solid #F3F4F6", overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            { key: "status", label: "공부 현황" },
            { key: "ranking", label: "오늘 공부 시간" },
            { key: "friends", label: `친구${incomingRequests.length > 0 ? ` ${incomingRequests.length}` : ""}` },
            { key: "badges", label: "뱃지" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "status" | "ranking" | "friends" | "badges")}
                data-tab={tab.key}
                style={{
                  position: "relative", padding: "10px 0",
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
                  <UserCard key={u.userId} user={u} onOpen={() => setSelectedUser(u)} />
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
          <div key="badges" className="timer-tab-panel">
            <BadgeCollection stats={myStats} todaySeconds={myTodayTotal} />
          </div>
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

function Avatar({ user, size }: { user: { nickname?: string; avatar: string | null }; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {user.avatar ? (
        <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: Math.max(14, Math.floor(size * 0.36)), fontWeight: 900, color: PRIMARY }}>{user.nickname?.charAt(0) || "?"}</span>
      )}
    </div>
  );
}

function UserCard({ user, onOpen }: { user: TimerUser; onOpen: () => void }) {
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
    <button type="button" onClick={onOpen} className="press" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, minWidth: 0 }}>
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
    </button>
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
