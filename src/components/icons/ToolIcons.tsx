// 퀴즈 도구 아이콘 — 사장 제공 토스 아이콘 폴더의 컬러 아이콘(public/icons/tools/*.svg).
//  섞기=주사위 · 노트=메모지 · 책갈피=파랑 · 타이머=시계 · 양옆 탭=손가락(컬러)
// 컬러 아이콘이라 켜짐/꺼짐은 색이 아니라 아이콘 종류(책갈피)나 주변 강조(링·배경)로 보여 준다.
type IconProps = { size?: number; className?: string };

function Img({ name, size, className }: { name: string; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/tools/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}

/** 문제 섞기(주사위) */
export const ShuffleIcon = ({ size = 22, className }: IconProps) => <Img name="shuffle-dice" size={size} className={className} />;
/** 메모(퀴즈 노트) */
export const MemoIcon = ({ size = 22, className }: IconProps) => <Img name="memo" size={size} className={className} />;
/** 책갈피 — 켜짐(파랑 채움) */
export const BookmarkFillIcon = ({ size = 22, className }: IconProps) => <Img name="bookmark-on" size={size} className={className} />;
/** 책갈피 — 꺼짐: 같은 파랑 아이콘을 쓰고 켜짐/꺼짐은 배경·링으로 구분한다(검정 선 아이콘은 색이 없어 쓰지 않는다) */
export const BookmarkLineIcon = ({ size = 22, className }: IconProps) => <Img name="bookmark-on" size={size} className={className} />;
/** 타이머(시계) */
export const ClockIcon = ({ size = 18, className }: IconProps) => <Img name="clock" size={size} className={className} />;
/** 탭(손가락 클릭) — 양옆 탭 넘기기. 원본이 짙은 단색이라 모양만 마스크로 쓰고 색은 color 로 입힌다(기본 = 글자색). */
export const TapIcon = ({ size = 22, className, color = "currentColor" }: IconProps & { color?: string }) => (
  <span
    className={className}
    aria-hidden="true"
    style={{
      display: "block",
      flexShrink: 0,
      width: size,
      height: size,
      background: color,
      WebkitMaskImage: "url(/icons/tools/tap.svg)",
      maskImage: "url(/icons/tools/tap.svg)",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskPosition: "center",
      maskPosition: "center",
    }}
  />
);
