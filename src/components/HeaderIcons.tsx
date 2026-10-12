// 홈 머리줄 종·돋보기 — 프리티풀(apps/web/src/components/icons/HeaderIcons.tsx) 아이콘 그대로.
//  · 사장 시안을 픽셀로 재서 좌표를 옮긴 것. 한 칸 = 132×132(시안 px) = 44pt, 두 칸을 붙이면 시안 간격 그대로.
//  · 선 색은 currentColor — 프리티풀은 #191F28 고정이지만 스타디는 다크 모드가 있어 버튼 색(글자색)을 따른다.
//  · 빨간 점(#EC6964)은 종과 떨어져 오른쪽 위 — 안 읽은 알림이 있을 때만.
export function HeaderBellIcon({ dot = false, size = 44 }: { dot?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="44 20.5 132 132" fill="none" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <path
        d="M83 88V78A27 27 0 0 1 137 78V88L141.3 95C143 97.8 141.5 105 137 105H83C78.5 105 77 97.8 78.7 95Z"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M97 105V109A13 13 0 0 0 123 109V105" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      {dot && <circle cx="148" cy="47.5" r="10.75" fill="#EC6964" />}
    </svg>
  );
}

export function HeaderSearchIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="176 20 132 132" fill="none" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <circle cx="236" cy="80" r="26.5" stroke="currentColor" strokeWidth="6.8" />
      <path d="M254.7 98.7L274.1 118.1" stroke="currentColor" strokeWidth="6.8" strokeLinecap="round" />
    </svg>
  );
}
