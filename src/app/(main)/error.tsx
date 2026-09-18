"use client";

import { useEffect } from "react";

// (main) 화면(홈·커뮤니티·옵시디언·책갈피·마이홈)에서 렌더 중 오류가 나면 이 화면이 뜬다.
// 이게 없으면 화면이 통째로 비어 버리는데, 다크 테마에서는 그냥 '검은 화면'으로 보여서
// 사용자는 앱이 멈춘 줄 안다(갤럭시탭 옵시디언 검은 화면 신고 대응).
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 웹뷰 콘솔에 남겨 원인 추적에 쓴다(digest 는 서버 로그와 짝지을 수 있는 값).
    console.error("[stady] 화면 렌더 오류:", error?.message, error?.digest);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 17, fontWeight: 800, color: "var(--c-text-c)" }}>
        화면을 여는 중 문제가 생겼어요
      </p>
      <p style={{ fontSize: 13.5, color: "var(--c-text-4c)", lineHeight: 1.6 }}>
        잠시 후 다시 시도해 주세요. 계속 같은 화면이면
        <br />
        마이홈 &gt; 고객센터로 알려주시면 바로 확인할게요.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "none", borderRadius: 12, padding: "11px 20px", cursor: "pointer",
            background: "var(--c-timer)", color: "#fff", fontSize: 14, fontWeight: 800,
          }}
        >
          다시 시도
        </button>
        <button
          type="button"
          onClick={() => { window.location.href = "/"; }}
          style={{
            border: "1px solid var(--c-border)", borderRadius: 12, padding: "11px 20px", cursor: "pointer",
            background: "var(--c-bg)", color: "var(--c-text-3)", fontSize: 14, fontWeight: 700,
          }}
        >
          홈으로
        </button>
      </div>
      {error?.digest && (
        <p style={{ fontSize: 11, color: "var(--c-text-5)", marginTop: 6 }}>오류코드 {error.digest}</p>
      )}
    </div>
  );
}
