"use client";

import BackButton from "@/components/BackButton";

export default function ServiceTermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2">
        <h1 className="mb-2 text-xl font-bold">서비스 이용약관</h1>
        <p className="mb-6 text-sm text-blue-500">마지막 업데이트 2026년 4월 1일</p>

        <div className="space-y-4 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (목적)</h2>
            <p>
              본 약관은 헬스스헬(이하 &quot;회사&quot;)이 운영하는 학습 플랫폼 &quot;스타디(Stady)&quot;(이하 &quot;서비스&quot;)의
              이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (용어의 정의)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>&quot;서비스&quot;란 회사가 제공하는 문제 풀이, OX 퀴즈, 영단어 퀴즈 등 학습 관련 일체의 서비스를 말합니다.</li>
              <li>&quot;이용자&quot;란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원을 말합니다.</li>
              <li>&quot;회원&quot;이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 서비스를 이용하는 자를 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (약관의 효력 및 변경)</h2>
            <p>
              1. 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.
            </p>
            <p>
              2. 회사는 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위에서
              본 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지합니다.
            </p>
            <p>
              3. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (회원가입)</h2>
            <p>
              1. 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는
              의사표시를 함으로서 회원가입을 신청합니다.
            </p>
            <p>
              2. 회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지
              않는 한 회원으로 등록합니다.
            </p>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
              <li>기타 회원으로 등록하는 것이 기술상 현저히 지장이 있다고 판단되는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (서비스의 제공 및 변경)</h2>
            <p>회사는 다음과 같은 서비스를 제공합니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>문제집 풀이 서비스</li>
              <li>OX 퀴즈 서비스</li>
              <li>영단어 퀴즈 서비스</li>
              <li>학습 기록 및 성적 관리 서비스</li>
              <li>기타 회사가 추가 개발하거나 제휴를 통해 제공하는 서비스</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 6조 (서비스의 중단)</h2>
            <p>
              1. 회사는 설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는
              서비스의 제공을 일시적으로 중단할 수 있습니다.
            </p>
            <p>
              2. 제1항에 의한 서비스 중단의 경우 회사는 서비스 내 공지사항에 이를 통지합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 7조 (회원 탈퇴 및 자격 상실)</h2>
            <p>
              1. 회원은 회사에 언제든지 탈퇴를 요청할 수 있으며 회사는 즉시 회원탈퇴를 처리합니다.
            </p>
            <p>
              2. 회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다.
            </p>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>가입 신청 시에 허위 내용을 등록한 경우</li>
              <li>다른 사람의 서비스 이용을 방해하거나 정보를 도용하는 등 전자상거래 질서를 위협하는 경우</li>
              <li>서비스를 이용하여 법령 또는 본 약관이 금지하는 행위를 하는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 8조 (면책조항)</h2>
            <p>
              1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는
              서비스 제공에 관한 책임이 면제됩니다.
            </p>
            <p>
              2. 회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.
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
