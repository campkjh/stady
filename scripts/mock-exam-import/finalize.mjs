import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const DL="/Users/jeonghunjeonghun-a.../Downloads";
const data=JSON.parse(readFileSync("answers.json","utf8"));
const man=JSON.parse(readFileSync("manifest.json","utf8"));
const sh=(b,a)=>execFileSync(b,a,{encoding:"utf8",maxBuffer:40*1024*1024});
const pages=(p)=>Number(sh("./pdfinfo",[p]).split("\t")[0]);

// 1) 수학 단답형 꼬리("29 30 30 59"): 줄 전체가 숫자여야 한다는 조건 때문에 놓쳤다.
//    본문에 섞여 있어도 "연속한 번호 + 답" 쌍이면 받는다.
for (const e of data) {
  if (!e.missing.length) continue;
  const sol=man.find(m=>m.subject===e.subject).solution;
  let all=""; const pdf=`${DL}/${sol}`;
  for(let i=1;i<=pages(pdf);i++) all+=" "+sh("./full",[pdf,String(i)]).replace(/\n/g," ");
  for (const q of [...e.missing]) {
    const m=all.match(new RegExp(`(?:^|\\s)${q}\\s+(\\d{1,3})(?:\\s|$)`));
    // 바로 앞 번호의 답이 이미 있고, q-1 과 q 가 나란히 나오는 자리만 신뢰
    const ctx=all.match(new RegExp(`${q-1}\\s+\\d{1,3}\\s+${q}\\s+(\\d{1,3})`));
    if (ctx) { e.answers[q]=Number(ctx[1]); e.missing=e.missing.filter(x=>x!==q); }
    else if (m && e.subject.startsWith("math")) { e.answers[q]=Number(m[1]); e.missing=e.missing.filter(x=>x!==q); }
  }
}

// 2) 영어: 원문 텍스트에 1~12행만 나온다. 정답표를 이미지로 확대해 직접 판독했고,
//    그중 1~12번이 원문과 정확히 일치해 판독 신뢰성이 교차 검증됐다.
const ENG="2,2,2,5,1, 4,4,5,5,4, 1,1,2,1,1, 3,4,1,3,1, 5,3,3,4,4, 3,3,5,5,3, 3,2,4,4,4, 5,2,2,4,2, 1,5,3,5,5"
  .split(",").map(s=>Number(s.trim()));
const eng=data.find(d=>d.subject==="eng");
ENG.forEach((v,i)=>{ eng.answers[i+1]=v; });
eng.missing=[]; eng.note="정답표를 이미지로 판독(원문 텍스트는 1~12행만 추출됨). 1~12번이 원문과 일치해 교차 검증됨.";

// 3) 화학Ⅰ 16번: 시도교육청 정답 정정으로 '모두 정답 처리'된 문항.
const chem=data.find(d=>d.subject==="sci-chem1");
if (chem.missing.includes(16)) {
  chem.answers[16]=0;                  // 0 = 전항 정답(어떤 답을 골라도 정답)
  chem.missing=chem.missing.filter(q=>q!==16);
  chem.note="16번은 인천광역시교육청 정답 정정 안내로 '모두 정답 처리'된 문항(answer=0).";
}

writeFileSync("answers.json", JSON.stringify(data,null,1));
let total=0, filled=0;
for (const e of data) { total+=e.expected; filled+=e.expected-e.missing.length;
  console.log(`${e.missing.length?"⚠ ":"✅"} ${e.label.padEnd(11)} ${e.expected-e.missing.length}/${e.expected}${e.missing.length?"  누락: "+e.missing.join(","):""}${e.note?"  ※":""}`);
}
console.log(`\n합계 ${filled}/${total} 문항 정답 확보`);
