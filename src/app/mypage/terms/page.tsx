import Link from "next/link";
import BackButton from "@/components/BackButton";

const TERMS_ITEMS = [
  { label: "개인정보처리방침", href: "/mypage/terms/privacy" },
  { label: "서비스 이용약관", href: "/mypage/terms/service" },
  { label: "개인정보 제3자 제공 동의", href: "/mypage/terms/third-party" },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2">
        <h1 className="mb-6 text-xl font-bold">모든 이용약관 및 정보</h1>

        {/* Menu items */}
        <div className="flex flex-col gap-3">
          {TERMS_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-gray-800 transition-shadow hover:shadow-md"
            >
              <span>{item.label}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#E5E7EB] px-4 pt-6 pb-4 text-xs leading-5 text-gray-400">
        <p>헬스스헬 | 우 16891</p>
        <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
        <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
        <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
        <p className="mt-2">Copyright© stady. All right reserved.</p>
      </div>
    </div>
  );
}
