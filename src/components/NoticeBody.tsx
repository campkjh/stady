import type { CSSProperties } from "react";
import { isHtmlBody, sanitizeNoticeHtml } from "@/lib/noticeHtml";

/**
 * 공지 본문 그리기 — HTML 에디터로 쓴 공지는 정리(sanitize)한 HTML 로, 예전 일반 글은 줄바꿈 그대로.
 * 서버·클라이언트 어디서나 쓸 수 있다(훅 없음).
 */
export default function NoticeBody({ body, className, style }: { body: string; className?: string; style?: CSSProperties }) {
  if (isHtmlBody(body)) {
    return <div className={`notice-html${className ? ` ${className}` : ""}`} style={style} dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(body) }} />;
  }
  return (
    <div className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      {body}
    </div>
  );
}
