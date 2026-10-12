import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { listSiteContent } from "@/lib/siteContent";

/*
 * 앱 알림 — 프리티풀 알림(토스 알림 어법)의 데이터 쪽.
 *  · 새 표 UserNotification 만 만든다(기존 표에 ALTER 금지 — Neon 의 SELECT * 캐시 플랜이 깨져 500 이 난 적이 있다).
 *  · 종류: comment(내 글에 댓글) · reply(내 댓글에 답글) · reaction(내 글 공감) · comment_like(내 댓글 좋아요) · notice(새 공지)
 *  · 같은 사람이 같은 대상에 다시 눌러도 알림이 쌓이지 않게 dedupe_key 로 막는다(사용자별 유일).
 *  · 알림 만들기는 절대 본 기능(댓글·공감)을 깨뜨리면 안 된다 → 호출부는 try/catch 로 감싼 notify() 만 쓴다.
 */

export type NotificationType = "comment" | "reply" | "reaction" | "comment_like" | "notice";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  actorName: string | null;
  groupKey: string | null;
  read: boolean;
  createdAt: string;
}

let ready = false;
async function ensureTable() {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserNotification" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL DEFAULT '',
      "link" TEXT,
      "actor_name" TEXT,
      "group_key" TEXT,
      "dedupe_key" TEXT,
      "read_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "UserNotification_user_created_idx" ON "UserNotification" ("user_id", "created_at" DESC)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserNotification_user_dedupe_idx" ON "UserNotification" ("user_id", "dedupe_key") WHERE "dedupe_key" IS NOT NULL`
  );
  ready = true;
}

interface NotifyInput {
  userId: string | null | undefined;
  /** 알림을 일으킨 사람(자기 자신이면 알림을 만들지 않는다) */
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | null;
  actorName?: string | null;
  groupKey?: string | null;
  dedupeKey?: string | null;
}

/** 알림 한 건 만들기. 실패해도 던지지 않는다. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (!input.userId) return;
    if (input.actorId && input.actorId === input.userId) return;
    await ensureTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "UserNotification" ("id","user_id","type","title","body","link","actor_name","group_key","dedupe_key")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      randomUUID(),
      input.userId,
      input.type,
      input.title,
      input.body ?? "",
      input.link ?? null,
      input.actorName ?? null,
      input.groupKey ?? null,
      input.dedupeKey ?? null
    );
  } catch (e) {
    console.error("notify failed:", e);
  }
}

interface Row {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  actor_name: string | null;
  group_key: string | null;
  read_at: Date | null;
  created_at: Date;
}

const NOTICE_WINDOW_DAYS = 14;

/** 새 공지를 이 사용자 알림으로 채워 넣는다(가입 이후·최근 14일 것만, 한 번만). */
async function syncNotices(userId: string, userCreatedAt: Date) {
  const notices = await listSiteContent("notice", true);
  const since = Math.max(userCreatedAt.getTime(), Date.now() - NOTICE_WINDOW_DAYS * 86400000);
  for (const n of notices) {
    const created = new Date(n.createdAt ?? 0).getTime();
    if (!created || created < since) continue;
    await notify({
      userId,
      type: "notice",
      title: n.title,
      body: (n.body || "").replace(/\s+/g, " ").trim().slice(0, 160),
      link: `/notice?focus=${encodeURIComponent(n.id)}`,
      groupKey: null,
      dedupeKey: `notice:${n.id}`,
    });
  }
}

export async function listNotifications(userId: string, userCreatedAt: Date): Promise<{ items: NotificationItem[]; unread: number }> {
  await ensureTable();
  try {
    await syncNotices(userId, userCreatedAt);
  } catch (e) {
    console.error("syncNotices failed:", e);
  }
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT "id","type","title","body","link","actor_name","group_key","read_at","created_at"
       FROM "UserNotification" WHERE "user_id" = $1 ORDER BY "created_at" DESC LIMIT 200`,
    userId
  );
  const items = rows.map<NotificationItem>((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    link: r.link,
    actorName: r.actor_name,
    groupKey: r.group_key,
    read: r.read_at != null,
    createdAt: new Date(r.created_at).toISOString(),
  }));
  return { items, unread: items.filter((i) => !i.read).length };
}

export async function countUnread(userId: string): Promise<number> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n FROM "UserNotification" WHERE "user_id" = $1 AND "read_at" IS NULL`,
    userId
  );
  return Number(rows[0]?.n ?? 0);
}

export async function markRead(userId: string, ids: string[] | "all") {
  await ensureTable();
  if (ids === "all") {
    await prisma.$executeRawUnsafe(`UPDATE "UserNotification" SET "read_at" = now() WHERE "user_id" = $1 AND "read_at" IS NULL`, userId);
    return;
  }
  if (ids.length === 0) return;
  const ph = ids.map((_, i) => `$${i + 2}`).join(", ");
  await prisma.$executeRawUnsafe(
    `UPDATE "UserNotification" SET "read_at" = now() WHERE "user_id" = $1 AND "id" IN (${ph}) AND "read_at" IS NULL`,
    userId,
    ...ids
  );
}

export async function deleteNotifications(userId: string, ids: string[] | "all") {
  await ensureTable();
  if (ids === "all") {
    await prisma.$executeRawUnsafe(`DELETE FROM "UserNotification" WHERE "user_id" = $1`, userId);
    return;
  }
  if (ids.length === 0) return;
  const ph = ids.map((_, i) => `$${i + 2}`).join(", ");
  await prisma.$executeRawUnsafe(`DELETE FROM "UserNotification" WHERE "user_id" = $1 AND "id" IN (${ph})`, userId, ...ids);
}
