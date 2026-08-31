"use client";

import { useRouter } from "next/navigation";

// 커뮤니티 피드 상단(주간 인기글 위) 배너 — 탭하면 스타디 프라임 친구초대 페이지로.
// 디자인은 완성 이미지(public/banners/prime-referral-banner.webp)를 그대로 사용.
export default function PrimeReferralBanner() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="press"
      onClick={() => router.push("/referral-event")}
      aria-label="친구 초대하면 프라임 2주 무료 — 친구 초대하기"
      style={{
        display: "block",
        width: "100%",
        border: "none",
        padding: 0,
        margin: "0 0 14px",
        background: "none",
        cursor: "pointer",
        borderRadius: 16,
        overflow: "hidden",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/banners/prime-referral-banner.webp"
        alt="친구 초대하면 프라임 2주 무료 — 친구 초대하기"
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 16 }}
      />
    </button>
  );
}
