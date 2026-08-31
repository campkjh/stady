"use client";

import { useRouter } from "next/navigation";

// 커뮤니티 피드 상단(주간 인기글 위) 배너 — 탭하면 스타디 프라임 친구초대 페이지로.
// 배경은 완성 이미지, 우측 하단에 글래스(프로스티드) "친구 초대하기" 버튼을 얹는다.
export default function PrimeReferralBanner() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="prb press"
      onClick={() => router.push("/referral-event")}
      aria-label="친구 초대하면 프라임 2주 무료 — 친구 초대하기"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="prb-img" src="/banners/prime-referral-banner.webp" alt="친구 초대하면 프라임 2주 무료" />
      <span className="prb-glass">
        친구 초대하기
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginLeft: 1 }}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <style>{`
        .prb {
          position: relative;
          display: block;
          width: 100%;
          border: none;
          padding: 0;
          margin: 0 0 14px;
          background: none;
          cursor: pointer;
          border-radius: 16px;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .prb-img { display: block; width: 100%; height: auto; border-radius: 16px; }
        .prb-glass {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 15px;
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
          pointer-events: none; /* 클릭은 배너 전체(button)가 받는다 */
        }
        @media (max-width: 420px) {
          .prb-glass { right: 11px; bottom: 11px; padding: 8px 13px; font-size: 12.5px; }
        }
      `}</style>
    </button>
  );
}
