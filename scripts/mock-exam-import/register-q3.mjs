// v3 산출물(전체/발문/선택지/지문/제목) + 정답 → MockExamQuestion 재등록.
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const uploaded = JSON.parse(readFileSync("uploaded-q6.json","utf8"));
const answers = JSON.parse(readFileSync("answers.json","utf8"));
const prisma = new PrismaClient();
const TITLE = "2026학년도 7월 학력평가";
const SHORT = [16,17,18,19,20,21,22,29,30];

for (const col of ["passage_urls","stem_url","choice_urls","title","stem_is_title"]) {
  await prisma.$executeRawUnsafe(`ALTER TABLE "MockExamQuestion" ADD COLUMN IF NOT EXISTS "${col}" TEXT`);
}
const exams = await prisma.$queryRawUnsafe(
  `SELECT e.id, m.subject FROM "MockExam" e JOIN "MockExamMeta" m ON m.exam_id=e.id WHERE e.title=$1`, TITLE);
const bySubject = new Map(exams.map((e)=>[e.subject,e.id]));

let total=0, split=0, withPassage=0, withTitle=0;
for (const a of answers) {
  const examId = bySubject.get(a.subject);
  if (!examId) { console.error(`!! ${a.label}: 시험지 없음`); continue; }
  const urls = uploaded[a.subject] ?? {};
  const qmeta = JSON.parse(readFileSync(`questions6/${a.subject}/_questions.json`,"utf8"));
  const passages = existsSync(`questions6/${a.subject}/_passages.json`)
    ? JSON.parse(readFileSync(`questions6/${a.subject}/_passages.json`,"utf8")) : [];
  if (qmeta.length !== a.expected) { console.error(`!! ${a.label}: 문항 ${qmeta.length} ≠ ${a.expected}`); continue; }

  const passageOf = {};
  for (const p of passages) {
    const u = urls[p.file];
    if (!u) continue;
    for (let q=p.from; q<=p.to; q++) (passageOf[q] ??= []).push(u);
  }

  // 수학은 Vision 이 수식을 깨뜨려 제목이 엉킨다("f(z)=23+22") — 제목 저장 안 함.
  const useTitle = !a.subject.startsWith("math");

  const rows = [];
  for (const q of qmeta) {
    const n = q.number, ans = a.answers[n];
    if (ans===undefined || !urls[q.file]) { console.error(`!! ${a.label} ${n}번: 데이터 누락`); continue; }
    const choiceCount = a.subject.startsWith("math") && SHORT.includes(n) ? 0 : 5;
    const stem = q.stem ? urls[q.stem] : null;
    const choices = q.choices ? q.choices.map(f=>urls[f]).filter(Boolean) : null;
    rows.push({ n, url: urls[q.file], ans, choiceCount,
      title: useTitle && q.title ? String(q.title).slice(0, 200) : null,
      stem: stem ?? null,
      choices: choices && choices.length===5 ? JSON.stringify(choices) : null,
      passages: passageOf[n] ? JSON.stringify(passageOf[n]) : null,
      stemIsTitle: q.stemIsTitle === true ? "1" : null });
  }
  if (rows.length !== a.expected) { console.error(`!! ${a.label}: ${rows.length}/${a.expected} — 건너뜀`); continue; }

  await prisma.$executeRawUnsafe(`DELETE FROM "MockExamQuestion" WHERE "exam_id"=$1`, examId);
  for (const r of rows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "MockExamQuestion" ("id","exam_id","number","image_url","answer","choice_count","title","stem_url","choice_urls","passage_urls","stem_is_title")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      randomUUID(), examId, r.n, r.url, r.ans, r.choiceCount, r.title, r.stem, r.choices, r.passages, r.stemIsTitle);
  }
  const sc=rows.filter(r=>r.choices).length, pc=rows.filter(r=>r.passages).length, tc=rows.filter(r=>r.title).length;
  split+=sc; withPassage+=pc; withTitle+=tc; total+=rows.length;
  console.log(`[등록] ${a.label.padEnd(11)} ${rows.length}문항 (분리 ${sc} / 지문 ${pc} / 제목 ${tc})`);
}
console.log(`\n완료: ${total}문항 / 분리 ${split} / 지문연결 ${withPassage} / 제목 ${withTitle}`);
await prisma.$disconnect();
