"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";

interface Session {
  id: string;
  userId: string;
  subject: string;
  startedAt: string;
  elapsedSeconds: number;
  user: { id: string; nickname: string; avatar: string | null };
  isMe: boolean;
}

const AVATAR_ICONS = ["🔥", "📚", "✏️", "💻", "🧠", "🎯", "💡", "🌟", "🚀", "📖", "✨", "⚡"];

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getUserEmoji(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AVATAR_ICONS[Math.abs(hash) % AVATAR_ICONS.length];
}

export default function TimerPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mySession, setMySession] = useState<Session | null>(null);
  const [myElapsed, setMyElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("공부중");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/timer/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
      setMySession(data.mySession || null);
      if (data.mySession) {
        setMyElapsed(data.mySession.elapsedSeconds);
        setSubject(data.mySession.subject);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn !== true) return;
    fetchSessions();
    pollRef.current = setInterval(fetchSessions, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn]);

  // Tick my timer every second
  useEffect(() => {
    if (!mySession) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setMyElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mySession?.id]);

  // Ping every 30s while active
  useEffect(() => {
    if (!mySession) return;
    pingRef.current = setInterval(() => {
      fetch("/api/timer/ping", { method: "POST" }).catch(() => {});
    }, 30000);
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [mySession?.id]);

  const start = async () => {
    const res = await fetch("/api/timer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject || "공부중" }),
    });
    if (res.ok) {
      const data = await res.json();
      setMySession({ ...data.session, elapsedSeconds: 0, user: { id: "", nickname: "", avatar: null }, isMe: true });
      setMyElapsed(0);
      fetchSessions();
    }
  };

  const stop = async () => {
    await fetch("/api/timer/stop", { method: "POST" });
    setMySession(null);
    setMyElapsed(0);
    fetchSessions();
  };

  if (isLoggedIn === null) return null;
  if (isLoggedIn === false) return <LoginRequired />;

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#fff", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 16px 12px", position: "sticky", top: 0, backgroundColor: "#111", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>타이머</h1>
        </div>
        <span style={{ fontSize: 13, color: "#9CA3AF" }}>{sessions.length}명 접속 중</span>
      </div>

      {/* My Timer Card */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{
          backgroundColor: "#1C1C1E", borderRadius: 20, padding: "20px 20px 24px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 6 }}>현재 집중 시간</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 40, fontWeight: 700, letterSpacing: -1,
                  color: mySession ? "#FF8C3F" : "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {formatTime(myElapsed)}
                </span>
                {mySession ? (
                  <button
                    type="button"
                    onClick={stop}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "#2C2C2E", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={start}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "#FF8C3F", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20" /></svg>
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 40, opacity: 0.85 }}>{mySession ? "🔥" : "🛋️"}</div>
          </div>

          {/* Subject input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", borderRadius: 12,
            background: "#0F0F10", border: "1px solid #2C2C2E",
          }}>
            <div style={{ width: 24, height: 24, borderRadius: 4, background: "#FF8C3F", flexShrink: 0 }} />
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!!mySession}
              placeholder="공부 주제"
              style={{
                flex: 1, fontSize: 14, fontWeight: 600, color: "#fff",
                background: "none", border: "none", outline: "none",
              }}
            />
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              {mySession ? `${Math.floor(myElapsed / 60)}분` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Dreamers Section */}
      <div style={{ padding: "8px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>꿈꾸는 사람들</h2>
            <p style={{ fontSize: 13, color: "#FF8C3F", marginTop: 2, fontWeight: 600 }}>
              {sessions.length}명 공부중
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 24, height: 24, border: "2px solid #2C2C2E", borderTopColor: "#FF8C3F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            지금 공부 중인 사람이 없어요.<br />첫 번째로 시작해보세요!
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {sessions.map((s) => (
              <TimerUserCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimerUserCard({ session }: { session: Session }) {
  const [sec, setSec] = useState(session.elapsedSeconds);

  useEffect(() => {
    setSec(session.elapsedSeconds);
    const t = setInterval(() => setSec((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [session.id, session.elapsedSeconds]);

  const emoji = getUserEmoji(session.userId);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: 8, borderRadius: 14,
      border: session.isMe ? "2px solid #FF8C3F" : "2px solid transparent",
      background: session.isMe ? "rgba(255,140,63,0.05)" : "transparent",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: "#1C1C1E",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28,
      }}>
        {session.user.avatar ? (
          <img src={session.user.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} />
        ) : (
          emoji
        )}
      </div>
      <p style={{
        fontSize: 12, fontWeight: 600, color: "#FF8C3F",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {session.user.nickname}
      </p>
      <p style={{
        fontSize: 12, fontWeight: 700, color: "#FF8C3F",
        fontVariantNumeric: "tabular-nums",
      }}>
        {formatTime(sec)}
      </p>
    </div>
  );
}
