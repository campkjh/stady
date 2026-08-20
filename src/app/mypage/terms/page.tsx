import Link from "next/link";
import BackHeader from "@/components/BackHeader";

const TERMS_ITEMS = [
  { label: "개인정보처리방침", href: "/mypage/terms/privacy" },
  { label: "서비스 이용약관", href: "/mypage/terms/service" },
  { label: "개인정보 제3자 제공 동의", href: "/mypage/terms/third-party" },
];

function Chevron() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--c-text-b)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function TermsPage() {
  return (
    <div className="flex flex-col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <BackHeader title="약관 및 정책" />

      <div className="flex flex-1 flex-col" style={{ padding: "8px 20px 0" }}>
        {/* 약관 목록 — 라운드 카드 하나에 행 3개 */}
        <div
          style={{
            borderRadius: 18,
            border: "1px solid var(--c-border)",
            background: "var(--c-bg)",
            overflow: "hidden",
          }}
        >
          {TERMS_ITEMS.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className="press"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 58,
                padding: "0 18px",
                textDecoration: "none",
                borderTop: i === 0 ? "none" : "1px solid var(--c-bg-muted)",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>
                {item.label}
              </span>
              <Chevron />
            </Link>
          ))}
        </div>
      </div>

      {/* 사업자 정보 푸터 */}
      <div
        style={{
          borderTop: "1px solid var(--c-border)",
          padding: "24px 20px 16px",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.7,
          color: "var(--c-text-5)",
        }}
      >
        <p>스타디 | 우 16891</p>
        <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
        <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
        <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
        <p style={{ marginTop: 8 }}>Copyright&copy; stady. All right reserved.</p>
      </div>
    </div>
  );
}
