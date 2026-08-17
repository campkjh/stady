// questions3/{과목}/ 전체 업로드. 경로 접두 questions3(기존 questions* 는 1년 캐시라 덮어쓰기 금지).
import { put } from "@vercel/blob";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const ROOT="/private/tmp/claude-501/-Users-jeonghunjeonghun-a---/f31a1762-2763-4276-8707-b8b7e209efb0/scratchpad";
const token=readFileSync(join(ROOT,".env.preview"),"utf8").match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const OUT="uploaded-q3.json";
const done=existsSync(OUT)?JSON.parse(readFileSync(OUT,"utf8")):{};
const subjects=readdirSync("questions3");
let n=0,bytes=0;
const total=subjects.reduce((a,s)=>a+readdirSync(`questions3/${s}`).filter(f=>f.endsWith(".jpg")).length,0);
for (const s of subjects) {
  const files=readdirSync(`questions3/${s}`).filter(f=>f.endsWith(".jpg")).sort();
  done[s]??={};
  for (const f of files) {
    if (done[s][f]) { n++; continue; }
    const body=readFileSync(join("questions3",s,f));
    const blob=await put(`mock-exams/2026-07/${s}/questions3/${f}`, body, {
      access:"public", contentType:"image/jpeg", addRandomSuffix:false, allowOverwrite:true,
      cacheControlMaxAge:365*24*60*60, token,
    });
    done[s][f]=blob.url; n++; bytes+=body.length;
    if (n%60===0){ writeFileSync(OUT,JSON.stringify(done)); process.stderr.write(`  ${n}/${total} (${(bytes/1048576).toFixed(0)}MB)\n`); }
  }
}
writeFileSync(OUT,JSON.stringify(done));
console.log(`업로드 완료: ${n}장 / 신규 ${(bytes/1048576).toFixed(1)}MB`);
