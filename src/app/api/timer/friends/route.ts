import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

interface FriendRequestRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  createdAt: Date;
  requesterNickname?: string;
  requesterAvatar?: string | null;
  addresseeNickname?: string;
  addresseeAvatar?: string | null;
}

async function ensureFriendTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimerFriendRequest" (
      "id" TEXT PRIMARY KEY,
      "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "addresseeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TimerFriendRequest_pair_key"
    ON "TimerFriendRequest" (LEAST("requesterId", "addresseeId"), GREATEST("requesterId", "addresseeId"))
  `);
}

async function getTimerUsers(userIds: string[]) {
  if (userIds.length === 0) return [];
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nickname: true, avatar: true },
  });

  return Promise.all(
    users.map(async (user) => {
      const [done, active] = await Promise.all([
        prisma.studySession.findMany({
          where: { userId: user.id, startedAt: { gte: startOfDay }, endedAt: { not: null } },
          select: { totalSeconds: true },
        }),
        prisma.studySession.findFirst({
          where: { userId: user.id, endedAt: null },
          orderBy: { startedAt: "desc" },
        }),
      ]);
      const doneTotal = done.reduce((sum, session) => sum + session.totalSeconds, 0);
      const activeElapsedSeconds = active ? Math.floor((now - active.startedAt.getTime()) / 1000) : 0;

      return {
        userId: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        isActive: !!active,
        subject: active?.subject || null,
        activeStartedAt: active?.startedAt || null,
        activeElapsedSeconds,
        todayTotalSeconds: doneTotal + activeElapsedSeconds,
        isMe: false,
      };
    })
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    await ensureFriendTable();

    const incoming = await prisma.$queryRawUnsafe<FriendRequestRow[]>(
      `
        SELECT r."id", r."requesterId", r."addresseeId", r."status", r."createdAt",
               u."nickname" AS "requesterNickname", u."avatar" AS "requesterAvatar"
        FROM "TimerFriendRequest" r
        JOIN "User" u ON u."id" = r."requesterId"
        WHERE r."addresseeId" = $1 AND r."status" = 'pending'
        ORDER BY r."createdAt" DESC
      `,
      user.id
    );

    const outgoing = await prisma.$queryRawUnsafe<FriendRequestRow[]>(
      `
        SELECT r."id", r."requesterId", r."addresseeId", r."status", r."createdAt",
               u."nickname" AS "addresseeNickname", u."avatar" AS "addresseeAvatar"
        FROM "TimerFriendRequest" r
        JOIN "User" u ON u."id" = r."addresseeId"
        WHERE r."requesterId" = $1 AND r."status" = 'pending'
        ORDER BY r."createdAt" DESC
      `,
      user.id
    );

    const accepted = await prisma.$queryRawUnsafe<FriendRequestRow[]>(
      `
        SELECT "requesterId", "addresseeId"
        FROM "TimerFriendRequest"
        WHERE "status" = 'accepted' AND ("requesterId" = $1 OR "addresseeId" = $1)
      `,
      user.id
    );
    const friendIds = accepted.map((row) => row.requesterId === user.id ? row.addresseeId : row.requesterId);
    const friends = await getTimerUsers(friendIds);

    return NextResponse.json({
      incoming: incoming.map((row) => ({
        id: row.id,
        userId: row.requesterId,
        nickname: row.requesterNickname,
        avatar: row.requesterAvatar,
        createdAt: row.createdAt,
      })),
      outgoing: outgoing.map((row) => ({
        id: row.id,
        userId: row.addresseeId,
        nickname: row.addresseeNickname,
        avatar: row.addresseeAvatar,
        createdAt: row.createdAt,
      })),
      friends,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer friends GET error:", error);
    return NextResponse.json({ error: "친구 정보를 가져오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { userId } = await request.json();
    if (!userId || userId === user.id) {
      return NextResponse.json({ error: "친구 요청 대상이 올바르지 않습니다." }, { status: 400 });
    }

    await ensureFriendTable();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "TimerFriendRequest" ("id", "requesterId", "addresseeId", "status")
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT DO NOTHING
      `,
      randomUUID(),
      user.id,
      userId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer friends POST error:", error);
    return NextResponse.json({ error: "친구 요청을 보내지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const { requestId, action } = await request.json();
    if (!requestId || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "요청 정보가 올바르지 않습니다." }, { status: 400 });
    }

    await ensureFriendTable();
    if (action === "accept") {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "TimerFriendRequest"
          SET "status" = 'accepted', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1 AND "addresseeId" = $2 AND "status" = 'pending'
        `,
        requestId,
        user.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          DELETE FROM "TimerFriendRequest"
          WHERE "id" = $1 AND "addresseeId" = $2 AND "status" = 'pending'
        `,
        requestId,
        user.id
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer friends PATCH error:", error);
    return NextResponse.json({ error: "친구 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
