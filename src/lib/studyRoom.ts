import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

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
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StudyRoomMember" (
      "room_id" TEXT NOT NULL REFERENCES "StudyRoom"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "joined_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
      PRIMARY KEY ("room_id", "user_id")
    )
  `);
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
}

export async function listStudyRooms(meId: string | null): Promise<StudyRoomCard[]> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{
    id: string; name: string; description: string | null; icon: string; color: string;
    owner_id: string; member_count: bigint; studying_count: bigint; joined: boolean;
  }[]>(
    `SELECT r."id", r."name", r."description", r."icon", r."color", r."owner_id",
            (SELECT COUNT(*) FROM "StudyRoomMember" m WHERE m."room_id" = r."id")::bigint AS member_count,
            (SELECT COUNT(*) FROM "StudyRoomMember" m
              JOIN "StudySession" s ON s."userId" = m."user_id" AND s."endedAt" IS NULL
              WHERE m."room_id" = r."id")::bigint AS studying_count,
            EXISTS (SELECT 1 FROM "StudyRoomMember" m WHERE m."room_id" = r."id" AND m."user_id" = $1) AS joined
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
  }));
}

export async function createStudyRoom(input: {
  ownerId: string; name: string; description?: string | null; icon?: string; color?: string;
}): Promise<string> {
  await ensure();
  const id = randomUUID();
  const icon = (ROOM_ICONS as readonly string[]).includes(input.icon ?? "") ? input.icon! : "edu";
  const color = (ROOM_COLORS as readonly string[]).includes(input.color ?? "") ? input.color! : "blue";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudyRoom" ("id","owner_id","name","description","icon","color") VALUES ($1,$2,$3,$4,$5,$6)`,
    id, input.ownerId, input.name.slice(0, 20), (input.description ?? "").slice(0, 60) || null, icon, color
  );
  // 만든 사람은 자동으로 들어간다.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudyRoomMember" ("room_id","user_id") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    id, input.ownerId
  );
  return id;
}

export async function joinStudyRoom(roomId: string, userId: string): Promise<void> {
  await ensure();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StudyRoomMember" ("room_id","user_id") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    roomId, userId
  );
}

export async function leaveStudyRoom(roomId: string, userId: string): Promise<void> {
  await ensure();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "StudyRoomMember" WHERE "room_id" = $1 AND "user_id" = $2`,
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

export interface StudyRoomDetail extends StudyRoomCard {
  members: { userId: string; nickname: string; avatar: string | null; studying: boolean; elapsedSeconds: number; todaySeconds: number }[];
}

export async function getStudyRoom(roomId: string, meId: string | null): Promise<StudyRoomDetail | null> {
  await ensure();
  const list = await listStudyRooms(meId);
  const card = list.find((r) => r.id === roomId);
  if (!card) return null;
  const members = await prisma.$queryRawUnsafe<{
    user_id: string; nickname: string; avatar: string | null; started_at: Date | null; today_seconds: bigint;
  }[]>(
    `SELECT m."user_id", u."nickname", u."avatar",
            (SELECT s."startedAt" FROM "StudySession" s
              WHERE s."userId" = m."user_id" AND s."endedAt" IS NULL ORDER BY s."startedAt" DESC LIMIT 1) AS started_at,
            (SELECT COALESCE(SUM(CASE WHEN s."endedAt" IS NOT NULL THEN s."totalSeconds"
                                      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - s."startedAt")))) END), 0)
             FROM "StudySession" s
             WHERE s."userId" = m."user_id"
               AND s."startedAt" >= date_trunc('day', (now() + interval '9 hours')) - interval '9 hours')::bigint AS today_seconds
     FROM "StudyRoomMember" m JOIN "User" u ON u."id" = m."user_id"
     WHERE m."room_id" = $1
     ORDER BY started_at DESC NULLS LAST, m."joined_at" ASC
     LIMIT 100`,
    roomId
  );
  return {
    ...card,
    members: members.map((m) => ({
      userId: m.user_id,
      nickname: m.nickname,
      avatar: m.avatar,
      studying: !!m.started_at,
      elapsedSeconds: m.started_at ? Math.max(0, Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000)) : 0,
      todaySeconds: Number(m.today_seconds),
    })),
  };
}
