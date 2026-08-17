#!/bin/bash
cd "$(dirname "$0")"
DL="/Users/jeonghunjeonghun-a.../Downloads"
node -e '
const m=require("./manifest.json");
const EXP={ "kor-hwajak":45,"kor-eonmae":45,"math-prob":30,"math-calc":30,"math-geo":30,"eng":45,"korhist":20 };
for(const e of m) console.log([e.subject, e.label, e.problem, EXP[e.subject]??20].join("\t"));
' | while IFS=$'\t' read -r subj label file exp; do
  out=$(./qextract3 "$DL/$file" "questions3/$subj" 1400 2>&1 | tail -1)
  cnt=$(echo "$out" | grep -oE '^문항 [0-9]+' | grep -oE '[0-9]+')
  if [ "$cnt" = "$exp" ]; then mark="✅"; else mark="⚠ "; fi
  printf "%s %-12s %s\n" "$mark" "$label" "$out"
done
