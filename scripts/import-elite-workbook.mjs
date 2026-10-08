// 엘리트 모의고사(생활과 윤리) → 문제집(Workbook) 등록.
//   node --env-file=.env.local scripts/import-elite-workbook.mjs <크롭디렉터리> <해설json> <표지jpg> [--apply]
//
// 크롭은 scripts/mock-exam-import/qextract3 가 만든 qNN.jpg(발문+제시문+선택지 통짜)를 쓴다.
// 문제집 풀이 화면은 "문제 이미지 + ①~⑤ 버튼"을 지원하므로 선택지는 빈 문자열로 두고
// 번호 버튼만 띄운다(시험지 조판을 그대로 보여 주는 게 목적).
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const [dir, haesolPath, coverPath] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
const TITLE = "엘리트 모의고사";
const CATEGORY = "생활과윤리";
const BLOB_PREFIX = "workbooks/elite-life-ethics";

const token = readFileSync(new URL("../.env", import.meta.url), "utf8")
  .match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const prisma = new PrismaClient();

const upload = async (path, name) => {
  const blob = await put(`${BLOB_PREFIX}/${name}`, readFileSync(path), {
    access: "public", contentType: "image/jpeg", token,
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 365 * 24 * 60 * 60,
  });
  return blob.url;
};

async function main() {
  const haesol = JSON.parse(readFileSync(haesolPath, "utf8"));
  const { answers, items } = haesol;
  if (answers.length !== 20 || items.length !== 20) throw new Error("정답/해설이 20개가 아닙니다.");

  const files = [];
  for (let n = 1; n <= 20; n++) {
    const f = `${dir}/q${String(n).padStart(2, "0")}.jpg`;
    if (!existsSync(f)) throw new Error(`크롭 없음: ${f}`);
    files.push(f);
  }
  const category = await prisma.category.findFirst({ where: { name: CATEGORY } });
  if (!category) throw new Error(`${CATEGORY} 카테고리를 찾지 못했습니다.`);
  const dup = await prisma.workbook.findFirst({ where: { title: TITLE, categoryId: category.id } });
  console.log(`문항 ${files.length}개 / 정답 ${answers.join(",")}`);
  console.log(`카테고리 ${category.name} / 기존 동명 문제집 ${dup ? "있음(" + dup.id + ")" : "없음"}`);
  if (!APPLY) { console.log("\n미리보기입니다. --apply 로 실제 등록."); return; }
  if (dup) throw new Error("같은 제목의 문제집이 이미 있습니다. 먼저 지우고 다시 실행하세요.");

  const thumbnail = await upload(coverPath, "cover.jpg");
  const urls = [];
  for (let n = 1; n <= 20; n++) {
    urls.push(await upload(files[n - 1], `q${String(n).padStart(2, "0")}.jpg`));
    process.stdout.write(`\r업로드 ${n}/20`);
  }
  console.log("");

  const workbookId = randomUUID();
  await prisma.$transaction([
    prisma.workbook.create({
      data: { id: workbookId, title: TITLE, thumbnail, categoryId: category.id,
              totalQuestions: 20, questionPerPage: 1 },
    }),
    ...urls.map((url, i) =>
      prisma.problem.create({
        data: {
          workbookId, order: i + 1, questionImage: url,
          // 선택지는 시험지 이미지 안에 있다 → 번호 버튼만 띄우기 위해 공백 한 칸.
          choice1: " ", choice2: " ", choice3: " ", choice4: " ", choice5: " ",
          answer: answers[i],
          explanation: items[i].explanation || null,
        },
      })
    ),
  ]);
  // 유료 회원 전용 지정.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WorkbookPremium" (
      "workbook_id" TEXT PRIMARY KEY REFERENCES "Workbook"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkbookPremium" ("workbook_id") VALUES ($1) ON CONFLICT DO NOTHING`, workbookId);
  console.log(`완료 — 문제집 ${workbookId} (프리미엄 전용)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
