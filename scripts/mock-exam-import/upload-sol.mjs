import { put } from "@vercel/blob";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const ROOT="/private/tmp/claude-501/-Users-jeonghunjeonghun-a---/f31a1762-2763-4276-8707-b8b7e209efb0/scratchpad";
const token=readFileSync(join(ROOT,".env.preview"),"utf8").match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const OUT="uploaded-sol.json"; const done=existsSync(OUT)?JSON.parse(readFileSync(OUT,"utf8")):{};
let n=0;
for (const s of readdirSync("solutions")) {
  done[s]??={};
  for (const f of readdirSync(`solutions/${s}`).filter(f=>f.endsWith(".jpg")).sort()) {
    if (done[s][f]) { n++; continue; }
    const blob=await put(`mock-exams/2026-07/${s}/solutions1/${f}`, readFileSync(join("solutions",s,f)), {
      access:"public", contentType:"image/jpeg", addRandomSuffix:false, allowOverwrite:true, cacheControlMaxAge:365*24*60*60, token });
    done[s][f]=blob.url; n++;
    if (n%60===0) writeFileSync(OUT,JSON.stringify(done));
  }
}
writeFileSync(OUT,JSON.stringify(done)); console.log("해설 업로드:", n);
