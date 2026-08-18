import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const up=JSON.parse(readFileSync("uploaded-sol.json","utf8"));
const p=new PrismaClient();
await p.$executeRawUnsafe(`ALTER TABLE "MockExamQuestion" ADD COLUMN IF NOT EXISTS "solution_url" TEXT`);
const exams=await p.$queryRawUnsafe(`SELECT e.id, m.subject FROM "MockExam" e JOIN "MockExamMeta" m ON m.exam_id=e.id WHERE e.title=$1`,"2026학년도 7월 학력평가");
let n=0;
for (const e of exams) {
  const files=up[e.subject]||{};
  for (const [f,url] of Object.entries(files)) {
    const num=Number(f.match(/\d+/)[0]);
    const r=await p.$executeRawUnsafe(`UPDATE "MockExamQuestion" SET "solution_url"=$1 WHERE "exam_id"=$2 AND "number"=$3`, url, e.id, num);
    n+=Number(r);
  }
}
const c=await p.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM "MockExamQuestion" WHERE solution_url IS NOT NULL`);
console.log("해설 연결:", n, "| DB solution_url 보유:", c[0].c);
await p.$disconnect();
