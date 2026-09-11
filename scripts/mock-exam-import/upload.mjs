import { put } from "@vercel/blob";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// 토큰은 저장소 .env 에서 읽는다(프로덕션 Blob).
const token = readFileSync(new URL("../../.env", import.meta.url), "utf8")
  .match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)[1];
const MANIFEST = process.env.MANIFEST || "manifest.json";
const PAGES = process.env.PAGES || "pages";
// 회차별 Blob 경로 접두. problems/ 는 문제집·공지와 섞이므로 쓰지 않는다.
const PREFIX = process.env.BLOB_PREFIX || "mock-exams/2026-07";
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

// 이미 올린 건 건너뛴다(중단 후 재실행 대비).
const OUT = process.env.UPLOADED || "uploaded.json";
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

let n = 0, bytes = 0;
const total = manifest.reduce((a, e) => {
  for (const s of ["problem", "solution"]) {
    const d = `${PAGES}/${e.subject}/${s}`;
    if (existsSync(d)) a += readdirSync(d).filter(f => f.endsWith(".jpg")).length;
  }
  return a;
}, 0);

for (const exam of manifest) {
  for (const section of ["problem", "solution"]) {
    const dir = `${PAGES}/${exam.subject}/${section}`;
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
    done[exam.subject] ??= {};
    done[exam.subject][section] ??= [];
    for (let i = 0; i < files.length; i++) {
      if (done[exam.subject][section][i]) { n++; continue; }
      const body = readFileSync(join(dir, files[i]));
      // 경로를 mock-exams/ 아래로 모은다 — problems/ 는 문제집·공지와 섞여 있어
      // 나중에 무엇이 무엇인지 구분이 안 된다.
      const path = `${PREFIX}/${exam.subject}/${section}/${files[i]}`;
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
