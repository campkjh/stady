import { prisma } from "@/lib/prisma";

// 닉네임 유일성 규칙. 대소문자·좌우/연속 공백을 무시한 "정규화 키"로 비교한다.
// DB에 unique 제약을 걸지 못한다(기존 중복 다수 — 특히 기본값 "사용자" 수천 건). 그래서
// 앱 계층에서 검증하고, 기존 중복자는 NicknameGate 로 접속 시 강제 변경시킨다.

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

/** 표시용 정규화: 연속 공백을 하나로, 앞뒤 공백 제거. */
export function normalizeNickname(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

/** 비교용 키: 정규화 + 소문자. */
export function nicknameKey(raw: unknown): string {
  return normalizeNickname(raw).toLowerCase();
}

// DB 컬럼에서 같은 방식으로 정규화 키를 뽑는 SQL 식(앱의 nicknameKey 와 일치시킨다).
const NORM_SQL = `lower(btrim(regexp_replace("nickname", '\\s+', ' ', 'g')))`;

// 중복/유일성 조회가 접속마다 돌기 때문에, 정규화 식에 함수 인덱스를 건다(모두 IMMUTABLE).
let indexReady = false;
async function ensureNicknameIndex() {
  if (indexReady) return;
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "User_nickname_norm_idx" ON "User" (${NORM_SQL})`
    );
  } catch (e) {
    console.error("ensureNicknameIndex skipped:", e);
  }
  indexReady = true;
}

export function validateNickname(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizeNickname(raw);
  if (value.length < NICKNAME_MIN) return { ok: false, error: `닉네임은 최소 ${NICKNAME_MIN}자 이상이어야 해요.` };
  if (value.length > NICKNAME_MAX) return { ok: false, error: `닉네임은 최대 ${NICKNAME_MAX}자까지 가능해요.` };
  return { ok: true, value };
}

/** 다른 사용자가 이미 쓰고 있는 닉네임인지(본인 제외). */
export async function isNicknameTaken(nickname: string, exceptUserId: string): Promise<boolean> {
  await ensureNicknameIndex();
  const rows = await prisma.$queryRawUnsafe<{ one: number }[]>(
    `SELECT 1 AS one FROM "User" WHERE ${NORM_SQL} = $1 AND "id" <> $2 LIMIT 1`,
    nicknameKey(nickname),
    exceptUserId
  );
  return rows.length > 0;
}

/** 현재 사용자의 닉네임을 다른 사용자도 똑같이 쓰고 있는지(=강제 변경 대상). */
export async function isNicknameDuplicate(userId: string): Promise<boolean> {
  await ensureNicknameIndex();
  const rows = await prisma.$queryRawUnsafe<{ one: number }[]>(
    `SELECT 1 AS one
       FROM "User" a
       JOIN "User" b ON ${NORM_SQL.replace(/"nickname"/g, 'a."nickname"')} = ${NORM_SQL.replace(/"nickname"/g, 'b."nickname"')}
                    AND a."id" <> b."id"
      WHERE a."id" = $1
      LIMIT 1`,
    userId
  );
  return rows.length > 0;
}

/** 가입 시 기본 닉네임이 이미 쓰이면 숫자 접미사를 붙여 유일하게 만든다. */
export async function makeUniqueNickname(base: string): Promise<string> {
  const clean = normalizeNickname(base) || "사용자";
  const taken = async (n: string) => {
    const rows = await prisma.$queryRawUnsafe<{ one: number }[]>(
      `SELECT 1 AS one FROM "User" WHERE ${NORM_SQL} = $1 LIMIT 1`,
      nicknameKey(n)
    );
    return rows.length > 0;
  };
  if (!(await taken(clean))) return clean;
  for (let i = 0; i < 50; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const cand = `${clean.slice(0, NICKNAME_MAX)}${suffix}`;
    if (!(await taken(cand))) return cand;
  }
  return `${clean.slice(0, NICKNAME_MAX)}${Date.now().toString().slice(-6)}`;
}
