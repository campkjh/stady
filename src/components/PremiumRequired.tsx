"use client";

import { useRouter } from "next/navigation";

// 프리미엄 전용 콘텐츠 잠금 화면. LoginRequired 와 같은 자리에 쓴다.
// 구독 화면(/subscribe)으로 보낸다 — 실제 결제는 그쪽 IAP 흐름이 담당.
export default function PremiumRequired({
  title = "프리미엄 전용 콘텐츠예요",
  description = "구독하시면 생윤·윤사 전체 단원과 모의고사를 마음껏 풀 수 있어요.",
}: {
  title?: string;
  description?: string;
}) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px 20px",
        background: "var(--c-bg)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--c-warn-i, #FFE9A8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 22,
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 10V8a6 6 0 1112 0v2"
            stroke="#3E1918"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="4" y="10" width="16" height="10" rx="2.5" fill="#3E1918" />
        </svg>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--c-text-c)", marginBottom: 6, textAlign: "center" }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: "var(--c-text-4c)", marginBottom: 30, textAlign: "center", lineHeight: 1.5, maxWidth: 300 }}>
        {description}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
        <button
          type="button"
          onClick={() => router.push("/subscribe")}
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 48,
            borderRadius: 14,
            backgroundColor: "var(--c-inverse-5)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
          }}
        >
          프리미엄 구독하기
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="press"
          style={{
            width: "100%",
            height: 48,
            borderRadius: 14,
            backgroundColor: "transparent",
            color: "var(--c-text-4c)",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
