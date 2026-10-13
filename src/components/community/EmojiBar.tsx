"use client";

// 댓글 입력창 위 이모지 줄 — 누르면 onPick 으로 이모지 글자를 넘긴다(입력칸 포커스는 유지).
export const EMOJI_ITEMS: { icon: string; emoji: string; label: string }[] = [
  { icon: "heart-red", emoji: "❤️", label: "하트" },
  { icon: "emoji-cry", emoji: "😢", label: "눈물" },
  { icon: "emoji-grin", emoji: "😁", label: "웃음" },
  { icon: "emoji-ok", emoji: "👌", label: "오케이" },
  { icon: "emoji-fire", emoji: "🔥", label: "불" },
  { icon: "emoji-cold", emoji: "🥶", label: "얼음" },
];

export default function EmojiBar({ onPick, className = "" }: { onPick: (emoji: string) => void; className?: string }) {
  return (
    <div className={className}>
      {EMOJI_ITEMS.map((item) => (
        <button
          key={item.icon}
          type="button"
          className="emoji-bar-btn"
          aria-label={`${item.label} 이모지 넣기`}
          // 누르는 순간 입력칸이 포커스를 잃어 키보드가 내려가지 않게 한다.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(item.emoji)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/icons/community/${item.icon}.svg`} alt="" width={30} height={30} style={{ display: "block" }} />
        </button>
      ))}
    </div>
  );
}
