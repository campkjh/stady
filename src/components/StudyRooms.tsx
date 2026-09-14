"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 스타디룸 — 애플 홈 화면(앱 서랍)처럼 늘어놓는 공부방.
// 모바일 3열, 태블릿(744px+) 5열. 만들기는 커뮤니티 글쓰기처럼 모달에서 한다.

const ICONS = ["edu", "brain", "coffee", "clock", "tree", "sun", "moon", "fire", "star", "puzzle", "rainbow"] as const;
const COLORS: Record<string, string> = {
  blue: "#E3EDFF", violet: "#EDE7FF", pink: "#FFE6F2", orange: "#FFEEDD",
  green: "#E3F6E7", teal: "#DFF3F4", red: "#FFE6E6", slate: "#EAEDF2",
};
const COLOR_KEYS = Object.keys(COLORS);

export interface RoomCard {
  id: string; name: string; description: string | null; icon: string; color: string;
  ownerId: string; memberCount: number; studyingCount: number; joined: boolean; isOwner: boolean;
  requireApproval: boolean; pending: boolean; pendingCount: number;
}
interface RoomMember {
  userId: string; nickname: string; avatar: string | null;
  studying: boolean; elapsedSeconds: number; todaySeconds: number;
}

const fmt = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

export default function StudyRooms({ canWrite }: { canWrite: boolean }) {
  const [rooms, setRooms] = useState<RoomCard[] | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/study-rooms", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((d) => setRooms(d.rooms || []))
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: "var(--c-text-4c)", fontWeight: 600 }}>
          스타디룸 <span style={{ color: "var(--c-brand)", fontWeight: 800 }}>{rooms?.length ?? 0}</span>개
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="press"
            style={{
              border: "none", borderRadius: 999, padding: "8px 14px", cursor: "pointer",
              background: "var(--c-brand)", color: "#fff", fontSize: 13, fontWeight: 800,
            }}
          >
            스타디룸 생성
          </button>
        )}
      </div>

      {rooms === null ? (
        <p style={{ fontSize: 13, color: "var(--c-text-4c)", textAlign: "center", padding: "28px 0" }}>불러오는 중이에요.</p>
      ) : rooms.length === 0 ? (
        <div style={{ padding: "38px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 15.5, fontWeight: 800, color: "var(--c-text-2)", marginBottom: 5 }}>스타디룸이 텅텅</p>
          <p style={{ fontSize: 12.5, color: "var(--c-text-4c)", fontWeight: 600 }}>첫 번째 방을 만들어보세요</p>
        </div>
      ) : (
        <div className="sr-grid">
          {rooms.map((r) => (
            <button key={r.id} type="button" className="sr-cell press" onClick={() => setOpenRoomId(r.id)}>
              <span className="sr-tile" style={{ background: COLORS[r.color] ?? COLORS.blue }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/room/${ICONS.includes(r.icon as never) ? r.icon : "edu"}.svg`} alt="" />
                {r.studyingCount > 0 && <span className="sr-live">{r.studyingCount}</span>}
                {r.isOwner && r.pendingCount > 0 && <span className="sr-wait">{r.pendingCount}</span>}
              </span>
              <span className="sr-name">
                {r.requireApproval && <span className="sr-lock" aria-hidden="true">🔒</span>}
                {r.name}
              </span>
              <span className="sr-sub">{r.pending ? "승인 대기" : r.memberCount + "명"}</span>
            </button>
          ))}
        </div>
      )}

      {composeOpen && <RoomCompose onClose={() => setComposeOpen(false)} onCreated={() => { setComposeOpen(false); load(); }} />}
      {openRoomId && <RoomSheet roomId={openRoomId} onClose={() => setOpenRoomId(null)} onChanged={load} />}

      <style>{`
        /* 앱 서랍: 모바일 3열, 태블릿 5열 */
        .sr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px 10px; }
        @media (min-width: 744px) { .sr-grid { grid-template-columns: repeat(5, 1fr); gap: 22px 14px; } }
        .sr-cell {
          border: none; background: none; padding: 0; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 7px;
          -webkit-tap-highlight-color: transparent; min-width: 0;
        }
        .sr-tile {
          position: relative; width: 100%; aspect-ratio: 1/1; max-width: 76px;
          border-radius: 23%; display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(15,23,42,0.08);
        }
        .sr-tile img { width: 54%; height: 54%; object-fit: contain; display: block; }
        .sr-live {
          position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px;
          border-radius: 999px; background: #22C55E; color: #fff; font-size: 11px; font-weight: 800;
          display: inline-flex; align-items: center; justify-content: center;
          border: 2px solid var(--c-bg);
        }
        .sr-name {
          font-size: 12.5px; font-weight: 700; color: var(--c-text-2); max-width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sr-sub { font-size: 11px; color: var(--c-text-4c); font-weight: 600; margin-top: -4px; }
        /* 승인 대기 인원(방장에게만) — 공부 중 배지와 구분되게 왼쪽 위에 주황으로 */
        .sr-wait {
          position: absolute; top: -4px; left: -4px; min-width: 20px; height: 20px; padding: 0 5px;
          border-radius: 999px; background: #F59E0B; color: #fff; font-size: 11px; font-weight: 800;
          display: inline-flex; align-items: center; justify-content: center; border: 2px solid var(--c-bg);
        }
        .sr-lock { font-size: 10px; margin-right: 2px; }
      `}</style>
    </section>
  );
}

/** 방 만들기 — 커뮤니티 글쓰기와 같은 감각(제목·소개·아이콘·색). */
function RoomCompose({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState<string>("edu");
  const [color, setColor] = useState<string>("blue");
  const [approval, setApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/study-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: n, description: desc.trim(), icon, color, requireApproval: approval }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "만들지 못했습니다.");
      onCreated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "만들지 못했습니다.");
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2400,
        background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, background: "var(--c-bg-elevated, var(--c-bg))",
          borderTopLeftRadius: 20, borderTopRightRadius: 20, boxSizing: "border-box",
          padding: "18px 18px calc(16px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "92%", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: "var(--c-text-b)" }}>스타디룸 생성</span>
          <button type="button" onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 13, color: "var(--c-text-4)", cursor: "pointer", fontWeight: 700 }}>
            닫기
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ width: 64, height: 64, borderRadius: 16, background: COLORS[color], display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/icons/room/${icon}.svg`} alt="" width={34} height={34} style={{ display: "block" }} />
          </span>
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="방 이름 (예: 새벽 기상반)"
            style={{
              flex: 1, minWidth: 0, height: 48, borderRadius: 12, border: "1px solid var(--c-border)",
              background: "var(--c-bg-muted)", padding: "0 14px", fontSize: 16, color: "var(--c-text)", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <textarea
          value={desc}
          maxLength={60}
          rows={2}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="한 줄 소개 (선택)"
          style={{
            width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1px solid var(--c-border)",
            background: "var(--c-bg-muted)", padding: "11px 14px", fontSize: 16, lineHeight: 1.5,
            color: "var(--c-text)", outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 14,
          }}
        />

        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--c-text-3)", marginBottom: 7 }}>아이콘</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 14 }}>
          {ICONS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setIcon(k)}
              style={{
                aspectRatio: "1/1", borderRadius: 13, cursor: "pointer",
                border: icon === k ? "2px solid var(--c-brand)" : "1px solid var(--c-border)",
                background: "var(--c-bg)", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/icons/room/${k}.svg`} alt="" width={24} height={24} style={{ display: "block" }} />
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--c-text-3)", marginBottom: 7 }}>색</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setColor(k)}
              aria-label={`색 ${k}`}
              style={{
                width: 34, height: 34, borderRadius: 999, cursor: "pointer", background: COLORS[k],
                border: color === k ? "2.5px solid var(--c-brand)" : "1px solid var(--c-border)",
              }}
            />
          ))}
        </div>

        {/* 승인제: 켜면 방장이 수락해야 들어올 수 있다 */}
        <button
          type="button"
          onClick={() => setApproval((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
            padding: "12px 14px", borderRadius: 13, cursor: "pointer", textAlign: "left",
            border: approval ? "1.5px solid var(--c-brand)" : "1px solid var(--c-border)",
            background: approval ? "var(--c-brand-soft-3)" : "var(--c-bg)",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "var(--c-text-b)" }}>승인 스타디룸</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-4b)", marginTop: 2 }}>
              방장이 수락해야 들어올 수 있어요
            </span>
          </span>
          <span style={{
            width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: "relative",
            background: approval ? "var(--c-brand)" : "var(--c-bg-muted-3)", transition: "background 0.15s",
          }}>
            <span style={{
              position: "absolute", top: 3, left: approval ? 21 : 3, width: 20, height: 20, borderRadius: 999,
              background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </span>
        </button>

        {msg && <p style={{ fontSize: 12.5, color: "#E5484D", fontWeight: 700, marginBottom: 8 }}>{msg}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim()}
          style={{
            width: "100%", height: 50, border: "none", borderRadius: 13, background: "var(--c-brand)",
            color: "#fff", fontSize: 15.5, fontWeight: 900,
            cursor: busy || !name.trim() ? "default" : "pointer", opacity: busy || !name.trim() ? 0.55 : 1,
          }}
        >
          {busy ? "만드는 중…" : "스타디룸 만들기"}
        </button>
      </div>
    </div>,
    document.body
  );
}

/** 방 상세 — 멤버와 지금 공부 중인 사람. */
function RoomSheet({ roomId, onClose, onChanged }: { roomId: string; onClose: () => void; onChanged: () => void }) {
  const [room, setRoom] = useState<(RoomCard & { members: RoomMember[]; pendingMembers: { userId: string; nickname: string; avatar: string | null }[] }) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/study-rooms/${roomId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setRoom(d.room ?? null); })
      .catch(() => {});
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  async function act(action: "join" | "leave" | "close" | "accept" | "reject", userId?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/study-rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, userId }),
      });
      onChanged();
      if (action === "close") onClose();
      else load();
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2400,
        background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, background: "var(--c-bg-elevated, var(--c-bg))",
          borderTopLeftRadius: 20, borderTopRightRadius: 20, boxSizing: "border-box",
          padding: "18px 18px calc(16px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "80%", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
        }}
      >
        {!room ? (
          <p style={{ fontSize: 13, color: "var(--c-text-4c)", textAlign: "center", padding: "24px 0" }}>불러오는 중이에요.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: COLORS[room.color] ?? COLORS.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/room/${room.icon}.svg`} alt="" width={28} height={28} style={{ display: "block" }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 16.5, fontWeight: 900, color: "var(--c-text-b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.name}</p>
                <p style={{ fontSize: 12.5, color: "var(--c-text-4b)", fontWeight: 600, marginTop: 2 }}>
                  {room.memberCount}명 · 지금 {room.studyingCount}명 공부 중{room.requireApproval ? " · 승인제" : ""}
                </p>
              </div>
            </div>
            {room.description && (
              <p style={{ fontSize: 13.5, color: "var(--c-text-2d)", lineHeight: 1.6, marginBottom: 14 }}>{room.description}</p>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => act(room.joined || room.pending ? "leave" : "join")}
                disabled={busy}
                style={{
                  flex: 1, height: 46, borderRadius: 12, cursor: busy ? "default" : "pointer", fontSize: 14.5, fontWeight: 800,
                  border: room.joined ? "1px solid var(--c-border)" : "none",
                  background: room.joined ? "var(--c-bg)" : "var(--c-brand)",
                  color: room.joined ? "var(--c-text-3)" : "#fff",
                }}
              >
                {room.joined ? "나가기" : room.pending ? "승인 대기 중 · 취소" : room.requireApproval ? "입장 신청하기" : "입장하기"}
              </button>
              {room.isOwner && (
                <button
                  type="button"
                  onClick={() => act("close")}
                  disabled={busy}
                  style={{
                    height: 46, padding: "0 16px", borderRadius: 12, border: "1px solid #F1B4B4",
                    background: "#FDECEC", color: "#D63A3A", fontSize: 14, fontWeight: 800, cursor: busy ? "default" : "pointer",
                  }}
                >
                  방 닫기
                </button>
              )}
            </div>

            {/* 방장에게만 보이는 승인 대기 목록 */}
            {room.isOwner && room.pendingMembers.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: "var(--c-text-3)", marginBottom: 7 }}>
                  승인 대기 {room.pendingMembers.length}명
                </p>
                <div style={{ borderRadius: 14, border: "1px solid var(--c-bg-muted)", overflow: "hidden" }}>
                  {room.pendingMembers.map((p, i) => (
                    <div key={p.userId} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                      borderBottom: i === room.pendingMembers.length - 1 ? "none" : "1px solid var(--c-bg-muted)",
                    }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.nickname}
                      </span>
                      <button type="button" disabled={busy} onClick={() => act("accept", p.userId)}
                        style={{ border: "none", borderRadius: 9, padding: "6px 12px", cursor: "pointer", background: "var(--c-brand)", color: "#fff", fontSize: 12.5, fontWeight: 800 }}>
                        수락
                      </button>
                      <button type="button" disabled={busy} onClick={() => act("reject", p.userId)}
                        style={{ border: "1px solid var(--c-border)", borderRadius: 9, padding: "6px 12px", cursor: "pointer", background: "var(--c-bg)", color: "var(--c-text-4)", fontSize: 12.5, fontWeight: 700 }}>
                        거절
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderRadius: 14, border: "1px solid var(--c-bg-muted)", overflow: "hidden" }}>
              {room.members.map((m, i) => (
                <div key={m.userId} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                  borderBottom: i === room.members.length - 1 ? "none" : "1px solid var(--c-bg-muted)",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                    background: m.studying ? "#22C55E" : "var(--c-bg-muted-3)",
                  }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.nickname}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: m.studying ? "var(--c-brand)" : "var(--c-text-4c)", whiteSpace: "nowrap" }}>
                    {m.studying ? `공부 중 ${fmt(m.elapsedSeconds)}` : `오늘 ${fmt(m.todaySeconds)}`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
