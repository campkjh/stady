#!/bin/bash
cd "$(dirname "$0")"
DL="/Users/jeonghunjeonghun-a.../Downloads"
node -e '
const m=require("./manifest.json");
const EXP={ "kor-hwajak":45,"kor-eonmae":45,"math-prob":30,"math-calc":30,"math-geo":30,"eng":45,"korhist":20 };
for(const e of m) if(e.solution) console.log([e.subject,e.label,e.solution,EXP[e.subject]??20].join("\t"));
' | while IFS=$'\t' read -r subj label file exp; do
  out=$(./sextract "$DL/$file" "solutions/$subj" 1400 2>&1 | tail -1)
  cnt=$(echo "$out" | grep -oE '^해설 [0-9]+' | grep -oE '[0-9]+')
  [ "$cnt" = "$exp" ] && mark="✅" || mark="⚠ "
  printf "%s %-12s %s/%s\n" "$mark" "$label" "${cnt:-0}" "$exp"
done
