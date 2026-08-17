// 원시 PDF 텍스트만으로 정답을 뽑는다(검증에서 정확함이 확인된 경로).
// Vision 위치추론은 영어 14번부터 틀린 값을 만들어 폐기했다 — 빈 곳은 채우지 않고 남긴다.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const DL = "/Users/jeonghunjeonghun-a.../Downloads";
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const CIRC = { "①":1,"②":2,"③":3,"④":4,"⑤":5 };
const EXPECT = { "kor-hwajak":45,"kor-eonmae":45,"eng":45,"math-prob":30,"math-calc":30,"math-geo":30,"korhist":20 };
const sh=(b,a)=>execFileSync(b,a,{encoding:"utf8",maxBuffer:40*1024*1024});
const pages=(p)=>Number(sh("./pdfinfo",[p]).split("\t")[0]);

const out=[];
for (const e of manifest) {
  const pdf=`${DL}/${e.solution}`, exp=EXPECT[e.subject]??20;
  let all=""; for(let i=1;i<=pages(pdf);i++) all+="\n"+sh("./full",[pdf,String(i)]);
  const ans={};
  for (const m of all.matchAll(/(\d{1,2})\s*([①②③④⑤])/g)) {
    const q=Number(m[1]); if(q>=1&&q<=exp&&ans[q]===undefined) ans[q]=CIRC[m[2]];
  }
  for (const line of all.split("\n")) {
    const t=line.trim().split(/\s+/);
    if(t.length<4||t.length%2!==0||!t.every(x=>/^\d{1,4}$/.test(x))) continue;
    let ok=true; for(let i=2;i<t.length;i+=2) if(Number(t[i])!==Number(t[i-2])+1) ok=false;
    if(!ok) continue;
    for(let i=0;i<t.length;i+=2){const q=Number(t[i]),v=Number(t[i+1]); if(q>=1&&q<=exp&&ans[q]===undefined) ans[q]=v;}
  }
  const missing=Array.from({length:exp},(_,i)=>i+1).filter(q=>ans[q]===undefined);
  out.push({subject:e.subject,label:e.label,expected:exp,answers:ans,missing});
  console.log(`${missing.length?"⚠ ":"✅"} ${e.label.padEnd(11)} ${exp-missing.length}/${exp}${missing.length?"  누락: "+missing.join(","):""}`);
}
writeFileSync("answers.json", JSON.stringify(out,null,1));
