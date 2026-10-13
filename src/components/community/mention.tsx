import type { ReactNode } from "react";

/** 본문 맨 앞 '@닉네임' 은 파랗게(토스 언급). */
export function renderWithMention(text: string): ReactNode {
  const m = /^@(\S+)/.exec(text);
  if (!m) return text;
  return (
    <>
      <span style={{ color: "#3182F6", fontWeight: 500 }}>{m[0]}</span>
      {text.slice(m[0].length)}
    </>
  );
}
