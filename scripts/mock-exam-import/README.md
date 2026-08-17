# 모의고사 PDF 일괄 등록

기출 PDF(문제 + 해설)를 페이지 이미지로 굽고 Blob 에 올린 뒤 MockExam 으로 등록한다.
2026학년도 7월 학력평가 24과목(206쪽)을 이걸로 넣었다.

## 왜 이런 방식인가
- 이 맥에는 poppler/ImageMagick 이 없다. Xcode 는 있으므로 **CoreGraphics 로 직접 렌더**한다.
  AppKit(NSGraphicsContext)은 헤드리스에서 죽으므로 쓰지 않는다.
- 시험지는 **원본 해상도가 기능**이다. MockExamViewer 가 `naturalWidth` 기준으로 OCR 크롭과
  필기 캔버스 정렬을 하고 4배 확대를 지원한다. 그래서 업로드 경로(`/api/upload`)에도
  리사이즈를 넣지 않았고, 여기서도 해상도를 함부로 낮추지 않는다.

## 함정
- **macOS 파일명은 NFD(자모 분해)** 다. `"2026년 7월"` 같은 NFC 리터럴과 직접 비교하면 하나도 안 맞는다.
  반드시 `.normalize("NFC")` 후 비교할 것.
- 수능 시험지는 **A3(841x1190pt) 2단 조판이 한 페이지**다. 펼침면이 아니므로 좌우로 쪼개면 안 된다.
  국어/수학은 A4(595x841pt)다. 판형별로 목표 px 을 달리해 물리 해상도를 맞춘다(A3 2200 / A4 1560 ≈ 133DPI).
- 국어·수학의 과목별 파일은 앞부분(공통)이 같아 텍스트만 보면 중복처럼 보이지만,
  뒤쪽 선택과목이 달라 **각각 완전한 시험지**다. 합치지 말 것.
- ImageIO 가 WebP **쓰기**를 지원하지 않는다(읽기만). JPEG q0.85 를 쓴다.

## 순서
```bash
cd scripts/mock-exam-import
SDK=$(xcrun --sdk macosx --show-sdk-path)
xcrun swiftc -O -sdk "$SDK" render.swift  -o render
xcrun swiftc -O -sdk "$SDK" pdfinfo.swift -o pdfinfo

node build-manifest.mjs   # 파일명 → 과목 매칭. 짝 안 맞으면 여기서 걸린다
./render-all.sh           # PDF → pages/{과목}/{problem|solution}/pNNN.jpg
node upload.mjs           # Blob 업로드(mock-exams/{회차}/…). 멱등, 중단 후 재실행 가능
node register.mjs --dry   # 등록 계획 확인
node register.mjs         # MockExam / MockExamImage / MockExamMeta 삽입
```

`build-manifest.mjs` 의 `SUBJECT`/`LABEL`/`ORDER` 는 `src/lib/examSubjects.ts` 와 **id 가 일치해야** 한다.
`register.mjs` 의 `YEAR`/`MONTH`/`TITLE`/`SORT_BASE` 를 회차에 맞게 바꿔서 쓴다.
`upload.mjs` 의 경로 접두(`mock-exams/2026-07`)도 회차마다 바꿀 것 — `problems/` 는
문제집·공지 이미지와 섞여 있어 나중에 구분이 안 된다.

⚠️ 로컬 `.env.local` 의 DATABASE_URL 은 **프로덕션 Neon** 이다. register.mjs 는 실제 서비스에 쓴다.

## 문항 단위 분해(qextract3 — 모바일 풀이용)

시험지를 문항별로 잘라 `MockExamQuestion` 으로 등록한다(풀이 화면 /mock-exam/[id]/solve).
순서: `qall3.sh`(문항/발문/선택지/지문 크롭) → `answers3.mjs`+`finalize.mjs`(해설 PDF 에서 정답)
→ `upload-q3.mjs` → `register-q3.mjs`.

qextract3.swift 가 고생한 함정들 — 재작업 시 그대로 유지할 것:
- **PDFKit characterBounds 는 한글 PDF 에서 문자 인덱스와 좌표가 어긋난다**(오버레이로 확증).
  좌표는 전부 Vision(렌더 이미지 OCR)에서 얻고, 크롭은 벡터 PDF 에서 다시 그린다.
- 문항번호 오탐: <보기>의 "ㄱ." 이 "7." 로 읽힌다 → 단의 번호 여백(최솟값)에 붙은 것만 인정.
- 크기/정렬: 스케일은 긴 변이 아니라 **단 폭 기준 고정**(전 크롭 동일 DPI), x 범위는
  번호 여백~실측 잉크 오른쪽 끝(97퍼센타일). 좌우 대칭 가정은 우측이 잘린다.
- 하단 쪽번호/"확인 사항" 박스: Vision 으로 찾아 그 위에서 컷.
- 문항이 다음 단/페이지로 이어지면 세그먼트로 잘라 세로 스티칭. 이때 연속 단의 시작은
  **페이지 상단 제목 밴드 아래**(contentTop) — 안 그러면 "국어 영역" 헤더가 크롭에 딸려 온다.
- 선택지 분리는 ①~⑤ 가 각 줄에서 시작할 때만(한 줄 조합형은 통짜+버튼 UI 폴백).
- 발문 제목 텍스트는 수학에선 저장 금지(Vision 이 수식을 깨뜨림).
- 업로드 경로는 회차마다 `questions3` 처럼 버전 접두를 갈 것 — blob 이 1년 캐시라
  같은 경로 덮어쓰기는 CDN 에 낡은 크롭을 박제할 수 있다.
- 정답 파싱: 원시 PDF 텍스트가 정확(수학 단답형 포함). **Vision 위치 추론으로 정답표를
  채우면 안 된다** — 영어 14번부터 전부 어긋난 전례. 영어처럼 원문에서 일부만 나오면
  정답표를 이미지로 잘라 육안 판독 후 finalize.mjs 에 하드코딩(1~12 원문 일치로 교차검증).
