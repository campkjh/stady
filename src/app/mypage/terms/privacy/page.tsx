"use client";

import BackButton from "@/components/BackButton";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2">
        <h1 className="mb-2 text-xl font-bold">개인정보 수집 및 이용약관</h1>
        <p className="mb-6 text-sm text-blue-500">마지막 업데이트 2026년 4월 1일</p>

        <div className="space-y-4 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (목적)</h2>
            <p>
              헬스스헬(이하 &quot;회사&quot;)은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고
              이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이
              개인정보 처리방침을 수립·공개합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (수집하는 개인정보 항목)</h2>
            <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>필수항목: 이메일 주소, 비밀번호, 닉네임</li>
              <li>카카오 로그인 시: 카카오 계정 이메일, 프로필 정보</li>
              <li>서비스 이용 과정에서 자동 수집: 접속 IP, 접속 로그, 서비스 이용 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (개인정보의 수집 및 이용목적)</h2>
            <p>회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인 확인, 개인 식별, 가입 의사 확인</li>
              <li>서비스 제공: 문제 풀이, 학습 기록 관리, 성적 분석 등 맞춤형 학습 서비스 제공</li>
              <li>고객 상담 및 불만 처리: 문의 접수, 처리 결과 통보</li>
              <li>서비스 개선: 이용 통계 분석, 서비스 품질 향상</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (개인정보의 보유 및 이용기간)</h2>
            <p>
              1. 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를
              수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <p>
              2. 회원 탈퇴 시 개인정보는 즉시 파기합니다. 다만, 관련 법령에 의하여 보존할 필요가
              있는 경우 해당 법령에서 정한 기간 동안 보관합니다.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
              <li>접속에 관한 기록: 3개월</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (개인정보의 파기)</h2>
            <p>
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는 복구할 수 없는 방법으로
              영구 삭제하며, 그 밖의 기록물은 분쇄하거나 소각합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 6조 (정보주체의 권리·의무)</h2>
            <p>정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 7조 (개인정보 보호책임자)</h2>
            <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 관련 불만처리 및 피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>개인정보 보호책임자: 김지승</li>
              <li>연락처: 010-4726-9276</li>
              <li>이메일: tlsdml0507@naver.com</li>
            </ul>
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
