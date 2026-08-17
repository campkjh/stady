import { put } from "@vercel/blob";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/private/tmp/claude-501/-Users-jeonghunjeonghun-a---/f31a1762-2763-4276-8707-b8b7e209efb0/scratchpad";
const token = readFileSync(join(ROOT, ".env.preview"), "utf8").match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

// 이미 올린 건 건너뛴다(중단 후 재실행 대비).
const OUT = "uploaded.json";
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

let n = 0, bytes = 0;
const total = manifest.reduce((a, e) => {
  for (const s of ["problem", "solution"]) {
    const d = `pages/${e.subject}/${s}`;
    if (existsSync(d)) a += readdirSync(d).filter(f => f.endsWith(".jpg")).length;
  }
  return a;
}, 0);

for (const exam of manifest) {
  for (const section of ["problem", "solution"]) {
    const dir = `pages/${exam.subject}/${section}`;
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
    done[exam.subject] ??= {};
    done[exam.subject][section] ??= [];
    for (let i = 0; i < files.length; i++) {
      if (done[exam.subject][section][i]) { n++; continue; }
      const body = readFileSync(join(dir, files[i]));
      // 경로를 mock-exams/ 아래로 모은다 — problems/ 는 문제집·공지와 섞여 있어
      // 나중에 무엇이 무엇인지 구분이 안 된다.
      const path = `mock-exams/2026-07/${exam.subject}/${section}/${files[i]}`;
      const blob = await put(path, body, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true, // 같은 경로 = 같은 내용이라 재실행이 멱등
        cacheControlMaxAge: 365 * 24 * 60 * 60,
        token,
      });
      done[exam.subject][section][i] = blob.url;
      n++; bytes += body.length;
      if (n % 20 === 0) {
        writeFileSync(OUT, JSON.stringify(done, null, 1));
        process.stderr.write(`  ${n}/${total} (${(bytes/1048576).toFixed(1)}MB 전송)\n`);
      }
    }
  }
}
writeFileSync(OUT, JSON.stringify(done, null, 1));
console.log(`업로드 완료: ${n}장 / 신규 전송 ${(bytes/1048576).toFixed(1)}MB`);
