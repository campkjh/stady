"use client";

import { useState, type MouseEvent } from "react";

/**
 * 토스식 팔로우 버튼 — 목록 카드·글 상세 공용.
 * 누르면 버튼이 톡 튀고(스프링), 글자는 아래에서 올라오며 바뀌고, 팔로잉이 되면 체크가 그려진다.
 */
export default function FollowButton({
  following,
  busy = false,
  onToggle,
  block = false,
}: {
  following: boolean;
  busy?: boolean;
  onToggle: () => void;
  /** 한 줄 가득 차는 큰 버튼(프로필 화면) */
  block?: boolean;
}) {
  const [pop, setPop] = useState(false);
  function handle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (busy) return;
    setPop(false);
    // 같은 프레임에 껐다 켜면 애니메이션이 다시 안 돌아서 한 틱 뒤에 켠다.
    requestAnimationFrame(() => setPop(true));
    onToggle();
  }
  return (
    <button
      type="button"
      className={`fbtn${following ? " is-on" : ""}${pop ? " is-pop" : ""}${block ? " is-block" : ""}`}
      aria-pressed={following}
      disabled={busy}
      onClick={handle}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setPop(false);
      }}
    >
      <span key={following ? "on" : "off"} className="fbtn-label">
        {following && (
          <svg className="fbtn-check" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {following ? "팔로잉" : "팔로우"}
      </span>
    </button>
  );
}
