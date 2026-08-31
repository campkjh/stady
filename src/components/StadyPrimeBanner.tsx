// 프리미엄(스타디 프라임) 사용자 전용 배너 — 마이페이지 티어 뱃지 아래.
// 디자인은 완성 이미지(public/banners/stady-prime-banner.webp)를 그대로 사용.
export default function StadyPrimeBanner() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/banners/stady-prime-banner.webp"
      alt="스타디 프라임 — 집중의 차이를 만드는 프리미엄 학습 경험"
      style={{ display: "block", width: "100%", height: "auto", borderRadius: 18 }}
    />
  );
}
