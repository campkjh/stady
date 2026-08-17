import { readdirSync, writeFileSync } from "node:fs";
const DL = "/Users/jeonghunjeonghun-a.../Downloads";

// 파일명 → 과목 id (examSubjects.ts 의 SUBJECT_GROUPS 와 일치해야 함)
const SUBJECT = {
  "화법과 작문": "kor-hwajak", "언어와 매체": "kor-eonmae",
  "확률과 통계": "math-prob", "미적분": "math-calc", "기하": "math-geo",
  "영어": "eng", "한국사": "korhist",
  "생활과 윤리": "soc-life-ethics", "윤리와 사상": "soc-ethics-thought",
  "한국지리": "soc-kor-geo", "세계지리": "soc-world-geo",
  "동아시아사": "soc-east-asia", "세계사": "soc-world-hist",
  "정치와 법": "soc-politics", "경제": "soc-economy", "사회문화": "soc-culture",
  "물리학1": "sci-physics1", "물리학2": "sci-physics2",
  "화학1": "sci-chem1", "화학2": "sci-chem2",
  "생명과학1": "sci-bio1", "생명과학2": "sci-bio2",
  "지구과학1": "sci-earth1", "지구과학2": "sci-earth2",
};
// 표시용 라벨(앱 과목 label 과 동일하게)
const LABEL = {
  "kor-hwajak":"화법과 작문","kor-eonmae":"언어와 매체","math-prob":"확률과 통계","math-calc":"미적분",
  "math-geo":"기하","eng":"영어","korhist":"한국사","soc-life-ethics":"생활과 윤리",
  "soc-ethics-thought":"윤리와 사상","soc-kor-geo":"한국지리","soc-world-geo":"세계지리",
  "soc-east-asia":"동아시아사","soc-world-hist":"세계사","soc-politics":"정치와 법",
  "soc-economy":"경제","soc-culture":"사회·문화","sci-physics1":"물리학Ⅰ","sci-physics2":"물리학Ⅱ",
  "sci-chem1":"화학Ⅰ","sci-chem2":"화학Ⅱ","sci-bio1":"생명과학Ⅰ","sci-bio2":"생명과학Ⅱ",
  "sci-earth1":"지구과학Ⅰ","sci-earth2":"지구과학Ⅱ",
};
// 사용자가 원할 만한 정렬(국어→수학→영어→한국사→사탐→과탐)
const ORDER = ["kor-hwajak","kor-eonmae","math-prob","math-calc","math-geo","eng","korhist",
  "soc-life-ethics","soc-ethics-thought","soc-kor-geo","soc-world-geo","soc-east-asia",
  "soc-world-hist","soc-politics","soc-economy","soc-culture",
  "sci-physics1","sci-physics2","sci-chem1","sci-chem2","sci-bio1","sci-bio2","sci-earth1","sci-earth2"];

// ⚠️ macOS 파일명은 NFD(자모 분해)라 NFC 리터럴과 직접 비교하면 절대 안 맞는다.
const raw = readdirSync(DL);
const files = raw.filter((f) => f.normalize("NFC").startsWith("2026년 7월") && f.endsWith(".pdf"));
const exams = {};
for (const f of files) {
  // "2026년 7월 [시행 ]<과목>[ 해설].pdf" — 공백/'시행' 표기가 들쭉날쭉해서 정규화 후 매칭
  const base = f.normalize("NFC").replace(/\.pdf$/, "").replace(/^2026년 7월\s*/, "").replace(/^시행\s*/, "").trim();
  const isSolution = /해설\s*$/.test(base);
  const subjectName = base.replace(/\s*해설\s*$/, "").trim();
  const id = SUBJECT[subjectName];
  if (!id) { console.error("!! 과목 매칭 실패:", JSON.stringify(subjectName), "←", f); continue; }
  exams[id] ??= { subject: id, label: LABEL[id], problem: null, solution: null };
  if (isSolution) exams[id].solution = f; else exams[id].problem = f;
}
const list = ORDER.filter((id) => exams[id]).map((id, i) => ({ ...exams[id], sortOrder: i }));
const missing = list.filter((e) => !e.problem || !e.solution);
console.log(`과목 ${list.length}개 / 파일 ${files.length}개`);
if (missing.length) { console.log("\n!! 짝이 안 맞는 과목:"); missing.forEach(m=>console.log("  ", m.label, "문제:", !!m.problem, "해설:", !!m.solution)); }
const unmatched = ORDER.filter(id=>!exams[id]);
if (unmatched.length) console.log("파일 없는 과목:", unmatched.join(", "));
writeFileSync("manifest.json", JSON.stringify(list, null, 1));
console.log("\n순서:");
list.forEach((e)=>console.log(` ${String(e.sortOrder).padStart(2)} ${e.label.padEnd(12)} ${e.subject}`));
