# 아이콘 세트 (토스 스타일)

오너가 제공한 공용 아이콘 세트. **앞으로 새 아이콘이 필요하면 여기서 먼저 찾는다.**

- 파일명 규칙: `icon-<이름>,<검색키워드들>.svg` (키워드는 한/영 혼용)
  예: `icon-medal-gold,gold,medal,first,1st.svg`
- 찾을 때: `ls design/icon-set | grep -i <키워드>` (한글 키워드도 매칭됨)
- 쓸 때: `public/icons/` 로 복사하고 용도에 맞는 짧은 이름을 붙인다
  (예: `ui-user.svg`, `tier-gold.svg`). 원본 파일명은 길어서 그대로 쓰지 않는다.
- 색상 교체: 단색 계열이라 SVG의 hex를 치환해 테마별 변형을 만들 수 있다
  (티어 아이콘 6종이 이 방식으로 `icon-test-league-10000-1~6`에서 파생됨).

## 이미 사용 중
- `public/icons/tier-{iron,silver,gold,emerald,diamond,master}.svg`
  ← `icon-test-league-10000-{1,3,6,5,4,2}.svg` 를 티어 색상으로 리컬러
- `public/icons/ui-user.svg` ← `icon-user...`
- `public/icons/ui-chat.svg` ← `icon-chat-bubble-grey...`
- `public/icons/ui-picture.svg` ← `icon-picture...`
