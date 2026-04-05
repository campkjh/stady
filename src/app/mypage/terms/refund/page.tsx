"use client";

import BackButton from "@/components/BackButton";

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2">
        <h1 className="mb-2 text-xl font-bold">환불규정에 대한 약관</h1>
        <p className="mb-6 text-sm text-blue-500">마지막 업데이트 2026년 1월20일</p>

        <div className="space-y-4 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (목적)</h2>
            <p>
              본 약관은 헬스스헬(이하 &quot;회사&quot;)이 제공하는 학습 서비스(이하 &quot;서비스&quot;)의
              환불에 관한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (환불 기준)</h2>
            <p>
              1. 결제일로부터 7일 이내에 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.
            </p>
            <p>
              2. 결제일로부터 7일 이내라도 서비스를 이용한 경우, 이용일수에 해당하는
              금액을 공제한 후 환불합니다.
            </p>
            <p>
              3. 결제일로부터 7일이 경과한 경우, 잔여 이용기간에 대해 일할 계산하여
              환불합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (환불 절차)</h2>
            <p>
              1. 환불을 원하시는 경우 고객센터(010-4726-9276)로 연락하시거나, 앱 내
              고객센터를 통해 환불을 요청할 수 있습니다.
            </p>
            <p>
              2. 환불 요청 접수 후 영업일 기준 3~5일 이내에 환불이 처리됩니다.
            </p>
            <p>
              3. 환불은 원 결제 수단으로 진행되며, 결제 수단에 따라 환불 소요 기간이
              다를 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (환불 제한)</h2>
            <p>
              1. 이벤트, 프로모션 등을 통해 무상으로 제공된 서비스는 환불 대상에서
              제외됩니다.
            </p>
            <p>
              2. 이용자의 귀책사유로 인한 서비스 이용 불가 시 환불이 제한될 수
              있습니다.
            </p>
            <p>
              3. 콘텐츠를 모두 이용 완료한 경우 환불이 불가합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (기타)</h2>
            <p>
              본 약관에 명시되지 않은 사항은 전자상거래 등에서의 소비자보호에 관한
              법률 및 관련 법령에 따릅니다.
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
