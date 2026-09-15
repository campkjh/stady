import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCommunityKings } from "@/lib/community";

// 스타디룸 — 같이 공부하는 방. 커뮤니티 글쓰기처럼 만들고, 홈 화면 앱 서랍처럼 늘어놓는다.
// StudySession 은 손대지 않는다(방과 무관하게 타이머는 그대로 돈다).
// "지금 공부 중" = 그 방 멤버 중 진행 중인 세션이 있는 사람.

export const ROOM_ICONS = ["edu", "brain", "coffee", "clock", "tree", "sun", "moon", "fire", "star", "puzzle", "rainbow"] as const;
export const ROOM_COLORS = ["blue", "violet", "pink", "orange", "green", "teal", "red", "slate"] as const;
export type RoomIcon = (typeof ROOM_ICONS)[number];
export type RoomColor = (typeof ROOM_COLORS)[number];

let ready = false;
async function ensure() {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StudyRoom" (
      "id" TEXT PRIMARY KEY,
      "owner_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "icon" TEXT NOT NULL DEFAULT 'edu',
      "color" TEXT NOT NULL DEFAULT 'blue',
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "require_approval" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
    )
  `);
  // 이미 만들어진 테이블 보강(조회는 늘 컬럼을 명시하므로 Neon 캐시플랜 문제 없음).
  await prisma.$executeRawUnsafe(`ALTER TABLE "StudyRoom" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN NOT NULL DEFAULT false`);
  // 프리셋 아이콘 대신 직접 올린 이미지를 쓸 수 있다(있으면 아이콘보다 우선).
  await prisma.$executeRawUnsafe(`ALTER TABLE "StudyRoom" ADD COLUMN IF NOT EXISTS "image_url" TEXT`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StudyRoomMember" (
      "room_id" TEXT NOT NULL REFERENCES "StudyRoom"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "joined_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "status" TEXT NOT NULL DEFAULT 'joined',
      PRIMARY KEY ("room_id", "user_id")
    )
  `);
  // status: joined(입장 완료) | pending(승인 대기). 승인제 방에서만 pending 이 생긴다.
  await prisma.$executeRawUnsafe(`ALTER TABLE "StudyRoomMember" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'joined'`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StudyRoomMember_user_idx" ON "StudyRoomMember" ("user_id")`
  );
  ready = true;
}

export interface StudyRoomCard {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  ownerId: string;
  memberCount: number;
  studyingCount: number;
  joined: boolean;
  isOwner: boolean;
  /** 직접 올린 방 이미지(없으면 icon/color 프리셋을 쓴다) */
  imageUrl: string | null;
  requireApproval: boolean;
  /** 내가 승인 대기 중인가 */
  pending: boolean;
  /** 방장이 볼 대기 인원 수 */
  pendingCount: number;
}

export async function listStudyRooms(meId: string | null): Promise<StudyRoomCard[]> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{
    id: string; name: string; description: string | null; icon: string; color: string;
    owner_id: string; image_url: string | null; member_count: bigint; studying_count: bigint; pending_count: bigint;
    joined: boolean; pending: boolean; require_approval: boolean;
  }[]>(
    `SELECT r."id", r."name", r."description", r."icon", r."color", r."owner_id", r."image_url",
            r."require_approval",
            (SELECT COUNT(*) FROM "StudyRoomMember" m WHERE m."room_id" = r."id" AND m."status" = 'joined')::bigint AS member_count,
            (SELECT COUNT(*) FROM "StudyRoomMember" m
              JOIN "StudySession" s ON s."userId" = m."user_id" AND s."endedAt" IS NULL
              WHERE m."room_id" = r."id" AND m."status" = 'joined')::bigint AS studying_count,
            (SELECT COUNT(*) FROM "StudyRoomMember" m WHERE m."room_id" = r."id" AND m."status" = 'pending')::bigint AS pending_count,
            EXISTS (SELECT 1 FROM "StudyRoomMember" m WHERE m."room_id" = r."id" AND m."user_id" = $1 AND m."status" = 'joined') AS joined,
            EXISTS (SELECT 1 FROM "StudyRoomMember" m WHERE m."room_id" = r."id" AND m."user_id" = $1 AND m."status" = 'pending') AS pending
     FROM "StudyRoom" r
     WHERE r."is_active" = true
     ORDER BY studying_count DESC, member_count DESC, r."created_at" DESC`,
    meId ?? ""
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    color: r.color,
    ownerId: r.owner_id,
    memberCount: Number(r.member_count),
    studyingCount: Number(r.studying_count),
    joined: !!r.joined,
    isOwner: !!meId && r.owner_id === meId,
    imageUrl: r.image_url,
    requireApproval: !!r.require_approval,
    pending: !!r.pending,
    pendingCount: Number(r.pending_count),
  }));
}

export async function createStudyRoom(input: {
  ownerId: string; name: string; description?: string | null; icon?: string; color?: string; requireApproval?: boolean; imageUrl?: string | null;
}): Promise<string> {
  await ensure();
  const id = randomUUID();
  const icon = (ROOM_ICONS as readonly string[]).includes(input.icon ?? "") ? input.icon! : "edu";
  const color = (ROOM_COLORS as readonly string[]).includes(input.color ?? "") ? input.color! : "blue";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudyRoom" ("id","owner_id","name","description","icon","color","require_approval","image_url") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    id, input.ownerId, input.name.slice(0, 20), (input.description ?? "").slice(0, 60) || null, icon, color,
    !!input.requireApproval, input.imageUrl ?? null
  );
  // 만든 사람은 자동으로 들어간다.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudyRoomMember" ("room_id","user_id") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    id, input.ownerId
  );
  return id;
}

/** 입장. 승인제 방이면 바로 들어가지 않고 승인 대기(pending)로 남는다. */
export async function joinStudyRoom(roomId: string, userId: string): Promise<"joined" | "pending"> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ require_approval: boolean; owner_id: string }[]>(
    `SELECT "require_approval","owner_id" FROM "StudyRoom" WHERE "id" = $1 LIMIT 1`,
    roomId
  );
  const room = rows[0];
  // 방장은 승인제라도 자기 방에 그냥 있는다.
  const status = room && room.require_approval && room.owner_id !== userId ? "pending" : "joined";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudyRoomMember" ("room_id","user_id","status") VALUES ($1,$2,$3)
     ON CONFLICT ("room_id","user_id") DO NOTHING`,
    roomId, userId, status
  );
  return status;
}

/** 방장이 대기자를 수락/거절한다. */
export async function decideMember(
  roomId: string, ownerId: string, targetUserId: string, accept: boolean
): Promise<boolean> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ owner_id: string }[]>(
    `SELECT "owner_id" FROM "StudyRoom" WHERE "id" = $1 LIMIT 1`, roomId
  );
  if (!rows[0] || rows[0].owner_id !== ownerId) return false;
  if (accept) {
    await prisma.$executeRawUnsafe(
      `UPDATE "StudyRoomMember" SET "status" = 'joined' WHERE "room_id" = $1 AND "user_id" = $2`,
      roomId, targetUserId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "StudyRoomMember" WHERE "room_id" = $1 AND "user_id" = $2 AND "status" = 'pending'`,
      roomId, targetUserId
    );
  }
  return true;
}

/**
 * 방 나가기. **방장은 못 나간다** — 나가면 멤버 0명인 채로 목록에 남아 유령 방이 된다.
 * 방장은 '방 닫기'(closeStudyRoom)로만 정리한다.
 */
export async function leaveStudyRoom(roomId: string, userId: string): Promise<void> {
  await ensure();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "StudyRoomMember" m
     USING "StudyRoom" r
     WHERE m."room_id" = $1 AND m."user_id" = $2
       AND r."id" = m."room_id" AND r."owner_id" <> $2`,
    roomId, userId
  );
}

/** 방장이 방을 내린다(기록은 남기고 목록에서만 감춘다). */
export async function closeStudyRoom(roomId: string, userId: string): Promise<boolean> {
  await ensure();
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "StudyRoom" SET "is_active" = false WHERE "id" = $1 AND "owner_id" = $2`,
    roomId, userId
  );
  return n > 0;
}

export interface StudyRoomMemberView {
  userId: string;
  nickname: string;
  /** 프로필 사진 — base64 원본 대신 짧은 URL 로 내린다(목록 payload 가 수 MB 가 되는 걸 막는다) */
  avatar: string | null;
  studying: boolean;
  elapsedSeconds: number;
  todaySeconds: number;
  /** 이번 주(월요일 KST 기준) 누적 — 불꽃 등급 뱃지용 */
  weekSeconds: number;
  answerKing: boolean;
  pickKing: boolean;
}

export interface StudyRoomDetail extends StudyRoomCard {
  members: StudyRoomMemberView[];
  /** 승인 대기자(방장에게만 의미가 있다) */
  pendingMembers: { userId: string; nickname: string; avatar: string | null }[];
}

// User.avatar 는 카톡 가입자의 경우 base64 data URI 라 그대로 실어 보내면 응답이 수 MB 가 된다.
// 커뮤니티와 같은 방식으로 짧은 URL 만 내려보낸다.
function avatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  return avatar.startsWith("data:") ? `/api/community/avatar/${userId}` : avatar;
}

export async function getStudyRoom(roomId: string, meId: string | null): Promise<StudyRoomDetail | null> {
  await ensure();
  const list = await listStudyRooms(meId);
  const card = list.find((r) => r.id === roomId);
  if (!card) return null;
  const members = await prisma.$queryRawUnsafe<{
    user_id: string; nickname: string; avatar: string | null; started_at: Date | null; today_seconds: bigint; week_seconds: bigint; status: string;
  }[]>(
    `SELECT m."user_id", u."nickname", u."avatar", m."status",
            (SELECT s."startedAt" FROM "StudySession" s
              WHERE s."userId" = m."user_id" AND s."endedAt" IS NULL ORDER BY s."startedAt" DESC LIMIT 1) AS started_at,
            (SELECT COALESCE(SUM(CASE WHEN s."endedAt" IS NOT NULL THEN s."totalSeconds"
                                      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - s."startedAt")))) END), 0)
             FROM "StudySession" s
             WHERE s."userId" = m."user_id"
               AND s."startedAt" >= date_trunc('day', (now() + interval '9 hours')) - interval '9 hours')::bigint AS today_seconds,
            (SELECT COALESCE(SUM(CASE WHEN s."endedAt" IS NOT NULL THEN s."totalSeconds"
                                      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - s."startedAt")))) END), 0)
             FROM "StudySession" s
             WHERE s."userId" = m."user_id"
               -- 불꽃 등급은 이번 주(월요일 0시 KST)부터의 누적
               AND s."startedAt" >= date_trunc('week', (now() + interval '9 hours')) - interval '9 hours')::bigint AS week_seconds
     FROM "StudyRoomMember" m JOIN "User" u ON u."id" = m."user_id"
     WHERE m."room_id" = $1
     ORDER BY started_at DESC NULLS LAST, m."joined_at" ASC
     LIMIT 100`,
    roomId
  );
  const joined = members.filter((m) => m.status === "joined");
  // 커뮤니티 왕 뱃지(답변왕·채택왕)는 최근 7일 라이브 판정 — 방 인원만 물어본다.
  const kings = await getCommunityKings(joined.map((m) => m.user_id)).catch(() => ({ answer: new Set<string>(), pick: new Set<string>() }));
  return {
    ...card,
    pendingMembers: members
      .filter((m) => m.status === "pending")
      .map((m) => ({ userId: m.user_id, nickname: m.nickname, avatar: avatarUrl(m.user_id, m.avatar) })),
    members: joined.map((m) => ({
      userId: m.user_id,
      nickname: m.nickname,
      avatar: avatarUrl(m.user_id, m.avatar),
      studying: !!m.started_at,
      elapsedSeconds: m.started_at ? Math.max(0, Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000)) : 0,
      todaySeconds: Number(m.today_seconds),
      weekSeconds: Number(m.week_seconds),
      answerKing: kings.answer.has(m.user_id),
      pickKing: kings.pick.has(m.user_id),
    })),
  };
}
