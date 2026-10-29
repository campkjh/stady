// 모의고사 원본 PDF(시험지·해설)를 Blob 에 올리고 "MockExamPdf" 에 연결한다(인쇄·한 번에 보기용).
//   node upload-pdf.mjs --dry   → 계획만 출력
//   node upload-pdf.mjs         → 업로드 + 연결(이미 올린 파일은 pdf-uploaded.json 으로 건너뜀)
// 짝 맞추기: manifest-YYYY-MM.json 의 (회차, 과목) = MockExamMeta 의 (year, month, subject).
// 같은 회차·과목 시험이 둘이면(옛 항목) 둘 다 연결한다. PDF 는 ~/Downloads 아래에서 파일명으로 찾는다.
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dry = process.argv.includes("--dry");
const token = readFileSync(new URL("../../.env", import.meta.url), "utf8")
  .match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const ROOT = process.env.DL_ROOT || "/Users/jeonghunjeonghun-a.../Downloads";
const OUT = "pdf-uploaded.json";
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

// 파일명(NFC) → 전체 경로
const index = new Map();
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (name !== "node_modules") walk(p); }
    else if (name.toLowerCase().endsWith(".pdf")) {
      const k = name.normalize("NFC");
      if (!index.has(k)) index.set(k, p);
    }
  }
})(ROOT);

const prisma = new PrismaClient();
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "MockExamPdf" (
    "exam_id" TEXT PRIMARY KEY,
    "problem_url" TEXT,
    "solution_url" TEXT,
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
  )
`);
const exams = await prisma.$queryRawUnsafe(
  `SELECT e."id", e."title", e."subtitle", m."year", m."month", m."subject"
   FROM "MockExam" e JOIN "MockExamMeta" m ON m."exam_id" = e."id"`
);

const manifests = readdirSync(".").filter((f) => /^manifest-\d{4}-\d{2}\.json$/.test(f)).sort();
let planned = 0, linked = 0, missing = [];
for (const mf of manifests) {
  const round = mf.match(/(\d{4}-\d{2})/)[1];
  const [year, month] = round.split("-").map(Number);
  const list = JSON.parse(readFileSync(mf, "utf8"));
  for (const entry of list) {
    const targets = exams.filter((e) => e.year === year && e.month === month && e.subject === entry.subject);
    if (targets.length === 0) { missing.push(`${round} ${entry.subject}: 시험 없음`); continue; }
    const urls = {};
    for (const kind of ["problem", "solution"]) {
      const fname = entry[kind];
      if (!fname) continue;
      const path = index.get(fname.normalize("NFC"));
      if (!path) { missing.push(`${round} ${entry.subject} ${kind}: 파일 없음 (${fname})`); continue; }
      const key = `${round}/${entry.subject}/${kind}`;
      planned++;
      if (dry) { urls[kind] = "(dry)"; continue; }
      if (!done[key]) {
        const body = readFileSync(path);
        const blob = await put(`mock-exams/${round}/${entry.subject}/pdf/${kind}.pdf`, body, {
          access: "public", token, contentType: "application/pdf", addRandomSuffix: true,
        });
        done[key] = blob.url;
        writeFileSync(OUT, JSON.stringify(done, null, 1));
        console.log(`  올림 ${key} (${(body.length / 1e6).toFixed(1)}MB)`);
      }
      urls[kind] = done[key];
    }
    for (const t of targets) {
      console.log(`${dry ? "[계획]" : "[연결]"} ${t.title} / ${t.subtitle ?? ""} — 시험지 ${urls.problem ? "O" : "X"} · 해설 ${urls.solution ? "O" : "X"}`);
      if (dry) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MockExamPdf" ("exam_id","problem_url","solution_url","updated_at") VALUES ($1,$2,$3,now())
         ON CONFLICT ("exam_id") DO UPDATE SET "problem_url"=EXCLUDED."problem_url","solution_url"=EXCLUDED."solution_url","updated_at"=now()`,
        t.id, urls.problem ?? null, urls.solution ?? null
      );
      linked++;
    }
  }
}
console.log(`\n파일 ${planned}개 ${dry ? "(계획)" : "처리"} · 시험 ${linked}개 연결`);
if (missing.length) console.log("빠진 것:\n " + missing.join("\n "));
await prisma.$disconnect();
