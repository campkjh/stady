// 스타디 프라임 배너 — 완성 이미지(public/banners/stady-prime-banner.webp).
// cta 를 주면 우측 하단에 글래스(프로스티드) 버튼을 얹는다(비구독자 "구독하기" 등).
// 클릭은 감싸는 Link/부모가 받으므로 버튼은 순수 장식(pointer-events:none).
export default function StadyPrimeBanner({ cta }: { cta?: string }) {
  return (
    <div className="spb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="spb-img"
        src="/banners/stady-prime-banner.webp"
        alt="스타디 프라임 — 집중의 차이를 만드는 프리미엄 학습 경험"
      />
      {cta && (
        <span className="spb-glass">
          {cta}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginLeft: 1 }}>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <style>{`
        .spb { position: relative; display: block; width: 100%; border-radius: 18px; overflow: hidden; }
        .spb-img { display: block; width: 100%; height: auto; border-radius: 18px; }
        .spb-glass {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 16px;
          border-radius: 999px;
          font-size: 13.5px;
          font-weight: 800;
          letter-spacing: -0.2px;
          color: #2f3ba3;
          background: rgba(255, 255, 255, 0.34);
          -webkit-backdrop-filter: blur(9px) saturate(1.35);
          backdrop-filter: blur(9px) saturate(1.35);
          border: 1px solid rgba(255, 255, 255, 0.62);
          box-shadow: 0 5px 16px rgba(80, 90, 180, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.72);
          pointer-events: none;
        }
        @media (max-width: 420px) {
          .spb-glass { right: 11px; bottom: 11px; padding: 8px 13px; font-size: 12.5px; }
        }
      `}</style>
    </div>
  );
}
