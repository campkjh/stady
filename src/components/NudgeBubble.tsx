import type { CSSProperties } from "react";

/**
 * 둥둥 떠다니는 말풍선 넛지.
 * 하단 네비의 "새로운 커뮤니티" 팁과 같은 결(흰 말풍선 + 꼬리 + 상하 부유 + 글자 샤이머)이고,
 * 앞에 공용 아이콘 세트(design/icon-set)의 SVG를, 뒤에 경험치 배지를 붙일 수 있다.
 * 장식 요소라 pointer-events는 꺼 둔다(아래 버튼/입력창 터치를 막지 않도록).
 *
 * tail="down"  말풍선이 대상 위에 있을 때(꼬리가 아래를 가리킴)
 * tail="up"    말풍선이 대상 아래에 있을 때
 * tailAlign    꼬리를 말풍선의 어디에 둘지. end/start면 tailInset(px)만큼 가장자리에서 띄운다.
 */
export default function NudgeBubble({
  icon,
  text,
  xp,
  tail = "down",
  tailAlign = "center",
  tailInset = 26,
  compact = false,
  style,
}: {
  icon: string;
  text: string;
  xp?: number;
  tail?: "down" | "up";
  tailAlign?: "center" | "start" | "end";
  tailInset?: number;
  compact?: boolean;
  style?: CSSProperties;
}) {
  const size = compact ? 15 : 17;
  const tailStyle: CSSProperties =
    tailAlign === "end"
      ? { alignSelf: "flex-end", marginRight: tailInset }
      : tailAlign === "start"
        ? { alignSelf: "flex-start", marginLeft: tailInset }
        : {};

  return (
    <div
      className={`nudge-bubble-wrap${tail === "up" ? " is-tail-up" : ""}${compact ? " is-compact" : ""}`}
      style={style}
      aria-hidden="true"
    >
      <div className="nudge-bubble">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/icons/${icon}.svg`} alt="" width={size} height={size} style={{ display: "block", flexShrink: 0 }} />
        <span className="nudge-bubble-text">{text}</span>
        {xp != null && <span className="nudge-bubble-xp">+{xp} XP</span>}
      </div>
      <svg className="nudge-bubble-tail" style={tailStyle} width="34" height="11" viewBox="0 0 39 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30.922 2.63L20.459 11C19.729 11.584 18.69 11.584 17.96 11L7.496 2.63C5.368 0.928001 2.725 0 0 0H38.418C35.693 0 33.05 0.928001 30.922 2.63Z" fill="white" />
      </svg>
    </div>
  );
}
