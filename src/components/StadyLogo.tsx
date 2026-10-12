/**
 * 스타디 로고(3D 유리 마크 + 글자) — 라이트/다크 두 장을 두고 테마에 따라 바꿔 보여 준다.
 * 다크 판은 어두운 글자만 밝은 회색으로 바꾼 것(마크는 그대로) — globals .sl-light/.sl-dark
 */
export default function StadyLogo({ height = 26, alt = "Stady", style }: { height?: number; alt?: string; style?: React.CSSProperties }) {
  const w = Math.round((height * 900) / 330);
  return (
    <span className="stady-logo" style={{ display: "inline-flex", ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sl-light" src="/icons/stady-logo-3d.webp" alt={alt} width={w} height={height} style={{ height, width: "auto", display: "block" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sl-dark" src="/icons/stady-logo-3d-dark.webp" alt="" aria-hidden="true" width={w} height={height} style={{ height, width: "auto", display: "none" }} />
    </span>
  );
}
