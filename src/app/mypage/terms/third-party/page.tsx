"use client";

import BackButton from "@/components/BackButton";

export default function ThirdPartyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2">
        <h1 className="mb-2 text-xl font-bold">개인정보 제3자 제공 동의</h1>
        <p className="mb-6 text-sm text-blue-500">마지막 업데이트 2026년 4월 1일</p>

        <div className="space-y-4 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (목적)</h2>
            <p>
              헬스스헬(이하 &quot;회사&quot;)은 이용자의 개인정보를 &quot;개인정보 수집 및 이용약관&quot;에서 고지한
              범위 내에서 사용하며, 이용자의 사전 동의 없이 동 범위를 초과하여 이용하거나
              원칙적으로 제3자에게 제공하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (개인정보 제공 현황)</h2>
            <p>
              회사는 현재 이용자의 개인정보를 제3자에게 제공하고 있지 않습니다.
              향후 서비스 제공을 위해 제3자 제공이 필요한 경우, 아래 사항을 사전에 고지하고
              별도의 동의를 받겠습니다.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>개인정보를 제공받는 자</li>
              <li>제공받는 자의 개인정보 이용목적</li>
              <li>제공하는 개인정보의 항목</li>
              <li>제공받는 자의 개인정보 보유 및 이용기간</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (예외사항)</h2>
            <p>다음의 경우에는 이용자의 동의 없이 개인정보를 제3자에게 제공할 수 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위하여 불가피한 경우</li>
              <li>공공기관이 법령 등에서 정하는 소관 업무의 수행을 위하여 불가피한 경우</li>
              <li>정보주체 또는 그 법정대리인이 의사표시를 할 수 없는 상태에 있거나
                주소불명 등으로 사전 동의를 받을 수 없는 경우로서 명백히 정보주체 또는
                제3자의 급박한 생명, 신체, 재산의 이익을 위하여 필요하다고 인정되는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (개인정보 처리 위탁)</h2>
            <p>
              회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-gray-700">수탁업체</th>
                    <th className="px-3 py-2 font-semibold text-gray-700">위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-3 py-2">Vercel Inc.</td>
                    <td className="px-3 py-2">서비스 호스팅 및 인프라 운영</td>
                  </tr>
                  <tr className="border-t border-gray-100">
                    <td className="px-3 py-2">카카오</td>
                    <td className="px-3 py-2">소셜 로그인 인증 서비스</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (동의 거부 권리)</h2>
            <p>
              이용자는 개인정보 제3자 제공에 대한 동의를 거부할 권리가 있습니다.
              다만, 동의를 거부할 경우 제3자 제공이 필요한 일부 서비스의 이용이 제한될 수 있습니다.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#E5E7EB] px-4 pt-6 pb-4 mt-8 text-xs leading-5 text-gray-400">
        <p>헬스스헬 | 우 16891</p>
        <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
        <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
        <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
        <p className="mt-2">Copyright© stady. All right reserved.</p>
      </div>
    </div>
  );
}
