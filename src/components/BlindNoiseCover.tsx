"use client";

// 스포일러(Mark as spoiler) 커버 — 움직이는 노이즈로 이미지를 가리고 탭하면 공개.
// 블러된 이미지 위에 얹혀 프리미엄 그레인 + 광택이 흐른다. 피드/상세 공용.
// 스타일은 globals.css 의 .blind-noise 참고.
export default function BlindNoiseCover({
  onReveal,
  label = "스포일러",
  hint = "탭하면 공개",
}: {
  onReveal: () => void;
  label?: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className="blind-noise"
      aria-label={`${label} — ${hint}`}
      onClick={(event) => {
        // 피드 카드/링크의 클릭(상세 이동)으로 번지지 않게 막고 여기서만 공개한다.
        event.stopPropagation();
        event.preventDefault();
        onReveal();
      }}
    >
      <span className="blind-noise-hint">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/community/eye-off.svg" alt="" width={16} height={16} />
        {label}
      </span>
      <span className="blind-noise-sub">{hint}</span>
    </button>
  );
}
