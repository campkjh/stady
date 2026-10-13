/*
 * 공지 본문 = HTML(어드민 HTML 에디터로 작성). 예전 공지는 일반 글(줄바꿈만)이라 둘 다 다룬다.
 *  · isHtmlBody      : 에디터로 쓴 HTML 인지(블록 태그로 시작) — 아니면 예전 일반 글
 *  · sanitizeNoticeHtml: 허용한 태그·속성만 남긴다(저장할 때·그릴 때 모두 한 번씩 — 서버/클라 어디서나 돌도록 DOM 에 안 기댄다)
 *  · htmlToText      : 홈 카드·알림·커뮤니티 미러처럼 글자만 필요한 곳용(문단·목록은 줄바꿈으로)
 *  · plainToHtml     : 예전 일반 글을 에디터에 불러올 때 HTML 로 바꿔 준다
 */

const BLOCK_START = /^\s*<(p|h[1-6]|ul|ol|div|blockquote|hr|pre|br)(\s|>|\/)/i;

export function isHtmlBody(body: string): boolean {
  return BLOCK_START.test(body || "");
}

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "del", "s", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "hr", "a", "code", "pre", "span", "div"]);
const VOID = new Set(["br", "hr"]);

function safeHref(raw: string): string | null {
  const v = raw.trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");
  if (/^(https?:|mailto:|tel:)/i.test(v) || /^\/(?!\/)/.test(v) || v.startsWith("#")) return raw.trim();
  return null;
}

export function sanitizeNoticeHtml(html: string): string {
  let s = String(html || "");
  // 스크립트·스타일·주석은 내용까지 통째로 제거
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi, "");
  return s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, tagRaw: string, attrs: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED.has(tag)) return ""; // 허용하지 않은 태그는 껍데기만 벗긴다(안의 글자는 남음)
    if (full.startsWith("</")) return VOID.has(tag) ? "" : `</${tag}>`;
    if (tag === "a") {
      const m = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = m ? safeHref((m[2] ?? m[3] ?? m[4] ?? "").replace(/&amp;/g, "&")) : null;
      return href ? `<a href="${href.replace(/"/g, "&quot;").replace(/&/g, "&amp;")}" target="_blank" rel="noopener noreferrer">` : "<a>";
    }
    return VOID.has(tag) ? `<${tag}>` : `<${tag}>`; // 속성은 전부 버린다(onclick·style 등)
  });
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

export function htmlToText(html: string): string {
  if (!isHtmlBody(html)) return String(html || "");
  return sanitizeNoticeHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 예전 일반 글 → HTML (빈 줄은 문단 나눔, 한 줄 바꿈은 <br>) */
export function plainToHtml(text: string): string {
  const t = String(text || "").trim();
  if (!t) return "";
  return t
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
