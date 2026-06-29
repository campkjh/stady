import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 공지사항/FAQ 공용 컨텐츠. kind 로 구분.
//  - notice: title=제목, body=내용, dateLabel=표시 날짜
//  - faq:    title=질문, body=답변
// 커뮤니티/배너와 동일하게 마이그레이션 없이 raw SQL로 관리.

export type ContentKind = "notice" | "faq";

export interface SiteContentItem {
  id: string;
  kind: ContentKind;
  title: string;
  body: string;
  dateLabel: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Row {
  id: string;
  kind: string;
  title: string;
  body: string;
  date_label: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

let tableReady = false;

export async function ensureSiteContentTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SiteContent" (
      "id" TEXT PRIMARY KEY,
      "kind" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL DEFAULT '',
      "date_label" TEXT,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SiteContent_kind_sort_idx" ON "SiteContent" ("kind", "sort_order")`
  );
  tableReady = true;
  await seedIfEmpty();
}

// 기존 하드코딩 공지/FAQ를 최초 1회 시드(테이블이 비어있을 때만) → 내용 보존 + 편집 가능.
async function seedIfEmpty(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*)::bigint AS c FROM "SiteContent"`);
  if (Number(rows[0]?.c ?? 0) > 0) return;

  const notices: [string, string, string][] = [
    ["서비스 업데이트 안내", "2026.04.01", "안녕하세요, 스타디입니다. 더 나은 학습 경험을 위해 서비스가 업데이트되었습니다. 새로운 UI와 개선된 문제 풀이 환경을 확인해 보세요."],
    ["시스템 점검 안내", "2026.03.25", "시스템 안정성 향상을 위한 점검이 예정되어 있습니다. 점검 시간: 4월 10일 오전 2시~6시. 해당 시간에는 서비스 이용이 제한될 수 있습니다."],
    ["새로운 문제집 추가", "2026.03.18", "수학, 영어, 과학 등 다양한 과목의 새로운 문제집이 추가되었습니다. 지금 바로 확인하고 학습을 시작해 보세요!"],
    ["이벤트 안내", "2026.03.10", "스타디 출석 이벤트가 진행 중입니다! 7일 연속 출석 시 특별 문제집을 무료로 제공합니다. 이벤트 기간: 3월 10일~4월 10일."],
    ["개인정보 처리방침 변경", "2026.03.01", "개인정보 처리방침이 일부 변경되었습니다. 변경된 내용은 마이페이지 > 개인정보 처리방침에서 확인하실 수 있습니다. 변경 시행일: 2026년 4월 1일."],
  ];
  const faqs: [string, string][] = [
    ["문제집은 어떻게 풀 수 있나요?", "홈 화면에서 원하는 문제집을 선택하면 바로 풀이를 시작할 수 있습니다. 카테고리별로 문제집을 찾아볼 수도 있습니다."],
    ["틀린 문제는 어디서 확인할 수 있나요?", "풀이 내역 탭에서 이전에 풀었던 문제와 결과를 확인할 수 있습니다. 틀린 문제만 모아서 다시 풀어볼 수도 있습니다."],
    ["결제는 어떻게 하나요?", "마이페이지 > 결제 관리에서 다양한 결제 수단을 이용하실 수 있습니다. 신용카드, 계좌이체 등을 지원합니다."],
    ["비밀번호를 잊어버렸어요", "로그인 화면에서 '비밀번호 찾기'를 통해 가입 시 등록한 이메일로 비밀번호 재설정 링크를 받으실 수 있습니다."],
    ["앱에서 알림을 받을 수 있나요?", "마이페이지 > 설정에서 알림을 켜시면 새로운 문제집 추가, 이벤트 등의 소식을 받아보실 수 있습니다."],
  ];

  for (let i = 0; i < notices.length; i++) {
    const [title, dateLabel, body] = notices[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteContent" ("id","kind","title","body","date_label","sort_order") VALUES ($1,'notice',$2,$3,$4,$5)`,
      randomUUID(), title, body, dateLabel, i
    );
  }
  for (let i = 0; i < faqs.length; i++) {
    const [title, body] = faqs[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteContent" ("id","kind","title","body","sort_order") VALUES ($1,'faq',$2,$3,$4)`,
      randomUUID(), title, body, i
    );
  }
}

function mapRow(r: Row): SiteContentItem {
  return {
    id: r.id,
    kind: r.kind as ContentKind,
    title: r.title,
    body: r.body,
    dateLabel: r.date_label,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listSiteContent(kind: ContentKind, activeOnly = false): Promise<SiteContentItem[]> {
  await ensureSiteContentTable();
  const rows = activeOnly
    ? await prisma.$queryRawUnsafe<Row[]>(
        `SELECT * FROM "SiteContent" WHERE "kind" = $1 AND "is_active" = true ORDER BY "sort_order" ASC, "created_at" DESC`,
        kind
      )
    : await prisma.$queryRawUnsafe<Row[]>(
        `SELECT * FROM "SiteContent" WHERE "kind" = $1 ORDER BY "sort_order" ASC, "created_at" DESC`,
        kind
      );
  return rows.map(mapRow);
}

export async function createSiteContent(input: {
  kind: ContentKind;
  title: string;
  body: string;
  dateLabel?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<void> {
  await ensureSiteContentTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SiteContent" ("id","kind","title","body","date_label","sort_order","is_active")
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    randomUUID(),
    input.kind,
    input.title,
    input.body,
    input.dateLabel ?? null,
    input.sortOrder ?? 0,
    input.isActive ?? true
  );
}

export async function updateSiteContent(
  id: string,
  fields: { title?: string; body?: string; dateLabel?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<void> {
  await ensureSiteContentTable();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.title !== undefined) { sets.push(`"title" = $${i++}`); vals.push(fields.title); }
  if (fields.body !== undefined) { sets.push(`"body" = $${i++}`); vals.push(fields.body); }
  if (fields.dateLabel !== undefined) { sets.push(`"date_label" = $${i++}`); vals.push(fields.dateLabel); }
  if (fields.sortOrder !== undefined) { sets.push(`"sort_order" = $${i++}`); vals.push(fields.sortOrder); }
  if (fields.isActive !== undefined) { sets.push(`"is_active" = $${i++}`); vals.push(fields.isActive); }
  if (sets.length === 0) return;
  sets.push(`"updated_at" = now()`);
  vals.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE "SiteContent" SET ${sets.join(", ")} WHERE "id" = $${i}`,
    ...vals
  );
}

export async function deleteSiteContent(id: string): Promise<void> {
  await ensureSiteContentTable();
  await prisma.$executeRawUnsafe(`DELETE FROM "SiteContent" WHERE "id" = $1`, id);
}
