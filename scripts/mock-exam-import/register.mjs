// 업로드된 페이지 URL 로 MockExam / MockExamImage / MockExamMeta 를 등록한다.
// --dry 면 계획만 출력. 재실행 시 같은 제목의 시험은 건너뛴다(중복 생성 방지).
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const dry = process.argv.includes("--dry");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const uploaded = JSON.parse(readFileSync("uploaded.json", "utf8"));
const prisma = new PrismaClient();

const YEAR = 2026, MONTH = 7;
const TITLE = "2026학년도 7월 학력평가";
// 기존 3건이 sort_order 0~2 를 쓰고 있으므로 그 뒤에 과목 순서대로 붙인다.
const SORT_BASE = 3;

const existing = await prisma.$queryRawUnsafe(
  `SELECT e."id", e."title", e."subtitle", m."subject"
   FROM "MockExam" e LEFT JOIN "MockExamMeta" m ON m."exam_id"=e."id"
   WHERE e."title" = $1`, TITLE);
const already = new Set(existing.map((r) => r.subject));
if (already.size) console.log(`이미 등록됨(건너뜀): ${already.size}과목`);

let created = 0, images = 0;
for (const exam of manifest) {
  if (already.has(exam.subject)) continue;
  const probs = uploaded[exam.subject]?.problem ?? [];
  const sols = uploaded[exam.subject]?.solution ?? [];
  if (!probs.length || probs.some((u) => !u)) {
    console.error(`!! ${exam.label}: 문제 이미지 누락 (${probs.filter(Boolean).length}/${probs.length}) — 건너뜀`);
    continue;
  }
  if (sols.some((u) => !u)) { console.error(`!! ${exam.label}: 해설 이미지 일부 누락 — 건너뜀`); continue; }

  const id = randomUUID();
  const sortOrder = SORT_BASE + exam.sortOrder;
  console.log(`${dry ? "[계획]" : "[등록]"} ${TITLE} / ${exam.label} — 문제 ${probs.length}p 해설 ${sols.length}p (sort ${sortOrder}, ${exam.subject})`);
  if (dry) { created++; images += probs.length + sols.length; continue; }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "MockExam" ("id","title","subtitle","sort_order","is_active") VALUES ($1,$2,$3,$4,true)`,
    id, TITLE, exam.label, sortOrder
  );
  for (const [section, urls] of [["problem", probs], ["solution", sols]]) {
    for (let i = 0; i < urls.length; i++) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MockExamImage" ("id","exam_id","image_url","sort_order","section") VALUES ($1,$2,$3,$4,$5)`,
        randomUUID(), id, urls[i], i, section
      );
      images++;
    }
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MockExamMeta" ("exam_id","year","month","subject") VALUES ($1,$2,$3,$4)
     ON CONFLICT ("exam_id") DO UPDATE SET "year"=EXCLUDED."year","month"=EXCLUDED."month","subject"=EXCLUDED."subject"`,
    id, YEAR, MONTH, exam.subject
  );
  created++;
}
console.log(`\n${dry ? "계획" : "완료"}: 시험 ${created}개 / 이미지 ${images}장`);
await prisma.$disconnect();
