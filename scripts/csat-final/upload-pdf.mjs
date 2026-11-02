// 수능대비자료 카드 원본 PDF 올리기 → CsatPrepPdf(키 = elite·묶음 collection).
//   node --env-file=.env.local scripts/csat-final/upload-pdf.mjs [--dry]
// 파일은 ~/Downloads 에서 이름(NFC)으로 찾는다. 없는 파일은 건너뛴다(그 칸은 '없음').
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const token = readFileSync(new URL("../../.env", import.meta.url), "utf8")
  .match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const dry = process.argv.includes("--dry");
const DL = join(homedir(), "Downloads");
const files = readdirSync(DL).map((f) => [f.normalize("NFC"), f]);
const find = (name) => files.find(([n]) => n === name)?.[1] ?? null;

const PLAN = {
  elite: { problem: "생활과윤리_엘리트모의고사_  최종본 pdf.pdf", solution: null }, // 해설은 hwp 만 있음
  "csat-final": { problem: "생활과윤리_사상가별_선지모음(완완).pdf", solution: "생활과윤리_사상가별_선지해설(완완).pdf" },
  "csat-ethics-thought": { problem: "윤리와사상_사상가별_고난도선지_1_문제.pdf", solution: "윤리와사상_사상가별_고난도선지_2_해설.pdf" },
};

const prisma = new PrismaClient();
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "CsatPrepPdf" (
    "key" TEXT PRIMARY KEY, "problem_url" TEXT, "solution_url" TEXT, "updated_at" TIMESTAMP NOT NULL DEFAULT now()
  )`);
for (const [key, kinds] of Object.entries(PLAN)) {
  const urls = {};
  for (const [kind, name] of Object.entries(kinds)) {
    const f = name && find(name);
    if (!f) { console.log(key, kind, "— 파일 없음"); urls[kind] = null; continue; }
    if (dry) { console.log(key, kind, f); urls[kind] = "dry"; continue; }
    const blob = await put(`csat-prep/${key}/pdf/${kind}.pdf`, readFileSync(join(DL, f)), {
      access: "public", token, contentType: "application/pdf", addRandomSuffix: true,
    });
    urls[kind] = blob.url;
    console.log(key, kind, "↑", f);
  }
  if (dry) continue;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CsatPrepPdf" ("key","problem_url","solution_url","updated_at") VALUES ($1,$2,$3,now())
     ON CONFLICT ("key") DO UPDATE SET "problem_url" = COALESCE(EXCLUDED."problem_url", "CsatPrepPdf"."problem_url"),
       "solution_url" = COALESCE(EXCLUDED."solution_url", "CsatPrepPdf"."solution_url"), "updated_at" = now()`,
    key, urls.problem, urls.solution
  );
}
await prisma.$disconnect();
