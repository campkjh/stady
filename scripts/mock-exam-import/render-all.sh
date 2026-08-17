#!/bin/bash
# 매니페스트의 모든 PDF 를 페이지 JPEG 로 렌더한다.
# 판형별로 목표 해상도를 달리해 물리 해상도(DPI)를 비슷하게 맞춘다:
#   A3(841x1190pt) → 2200px  ≈133DPI, A4(595x841pt) → 1560px ≈133DPI
cd "$(dirname "$0")"
DL="/Users/jeonghunjeonghun-a.../Downloads"
OUT=pages
mkdir -p "$OUT"
node -e '
const m=require("./manifest.json");
for(const e of m){ console.log([e.subject,"problem",e.problem].join("\t")); if(e.solution) console.log([e.subject,"solution",e.solution].join("\t")); }
' | while IFS=$'\t' read -r subj sect file; do
  src="$DL/$file"
  dir="$OUT/$subj/$sect"
  # 첫 페이지 긴변(pt)으로 판형 판별
  longpt=$(./pdfinfo "$src" | awk -F'\t' '{split($2,a,"x"); print (a[1]>a[2]?a[1]:a[2])}')
  if [ "$longpt" -gt 1000 ]; then LS=2200; else LS=1560; fi
  n=$(./render "$src" "$dir" "$LS" 0.85 | wc -l | tr -d ' ')
  bytes=$(du -sk "$dir" | awk '{print $1}')
  echo "$subj/$sect  ${n}p  ${LS}px  ${bytes}KB"
done
echo "=== 렌더 완료 ==="
du -sh "$OUT"
