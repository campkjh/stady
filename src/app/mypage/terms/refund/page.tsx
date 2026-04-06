import BackButton from "@/components/BackButton";

const tableClass = "mt-3 w-full overflow-hidden rounded-lg border border-gray-200 text-xs";
const thClass = "bg-gray-50 px-3 py-2.5 font-semibold text-gray-700 text-left";
const tdClass = "px-3 py-2.5 border-t border-gray-100";

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2 pb-6">
        <h1 className="mb-1 text-xl font-bold">환불 규정</h1>
        <p className="mb-6 text-sm text-blue-500">시행일: 2026년 4월 1일 | 최종 수정: 2026년 4월 1일</p>

        <div className="space-y-6 text-sm leading-6 text-gray-700">
          {/* 제1조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (목적)</h2>
            <p>
              본 약관은 헬스스헬(이하 &quot;회사&quot;)이 제공하는 학습 플랫폼 &quot;스타디(Stady)&quot;의
              유료 서비스 환불에 관한 사항을 규정함을 목적으로 합니다.
              본 환불 규정은 &quot;전자상거래 등에서의 소비자보호에 관한 법률&quot; 및 Apple App Store,
              Google Play Store 정책을 준수합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (앱스토어 결제 환불)</h2>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px]">
              <p className="font-medium text-blue-900">Apple App Store / Google Play Store 환불 안내</p>
              <p className="mt-2 text-blue-800">
                Apple App Store 또는 Google Play Store를 통해 결제한 경우, 환불은 각 스토어의
                정책에 따라 처리됩니다. 회사는 스토어 결제 건에 대해 직접 환불 처리가 불가능합니다.
              </p>
            </div>

            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "30%" }}>결제 플랫폼</th>
                  <th className={thClass} style={{ width: "70%" }}>환불 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>Apple App Store</td>
                  <td className={tdClass}>
                    Apple 지원 페이지(reportaproblem.apple.com)에서 환불 요청, 또는 기기 설정 &gt; Apple ID &gt; 구독에서 관리
                  </td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>Google Play Store</td>
                  <td className={tdClass}>
                    Google Play 앱 &gt; 결제 및 구독에서 환불 요청, 또는 play.google.com/store/account에서 관리
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (직접 결제 환불 기준)</h2>
            <p>앱스토어를 거치지 않는 직접 결제의 경우, 다음 기준에 따라 환불합니다.</p>

            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "35%" }}>구분</th>
                  <th className={thClass} style={{ width: "30%" }}>환불 금액</th>
                  <th className={thClass} style={{ width: "35%" }}>비고</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>결제 후 7일 이내, 미이용</td>
                  <td className={tdClass}>전액 환불</td>
                  <td className={tdClass}>콘텐츠 이용 기록 없음</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>결제 후 7일 이내, 이용함</td>
                  <td className={tdClass}>이용일수 공제 후 환불</td>
                  <td className={tdClass}>일할 계산 적용</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>결제 후 7일 경과</td>
                  <td className={tdClass}>잔여 기간 일할 계산 환불</td>
                  <td className={tdClass}>위약금 10% 공제</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>구독 자동 갱신</td>
                  <td className={tdClass}>갱신 후 7일 이내 전액 환불</td>
                  <td className={tdClass}>미이용 시에 한함</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3 text-[13px] text-gray-500">
              ※ 일할 계산 공식: 환불 금액 = 결제 금액 - (결제 금액 &divide; 총 이용일수 &times; 이용일수) - 위약금(해당 시)
            </p>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (환불 절차)</h2>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "15%" }}>단계</th>
                  <th className={thClass} style={{ width: "50%" }}>내용</th>
                  <th className={thClass} style={{ width: "35%" }}>소요 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium text-center`}>1</td>
                  <td className={tdClass}>앱 내 고객센터 또는 이메일(tlsdml0507@naver.com)로 환불 요청</td>
                  <td className={tdClass}>-</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium text-center`}>2</td>
                  <td className={tdClass}>환불 요청 접수 확인 및 이용 내역 검토</td>
                  <td className={tdClass}>영업일 기준 1일</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium text-center`}>3</td>
                  <td className={tdClass}>환불 승인 및 환불 금액 안내</td>
                  <td className={tdClass}>영업일 기준 1~2일</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium text-center`}>4</td>
                  <td className={tdClass}>원 결제 수단으로 환불 처리</td>
                  <td className={tdClass}>영업일 기준 3~5일</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[13px] text-gray-500">
              ※ 신용카드 환불의 경우 카드사 사정에 따라 환불 반영까지 추가 시간이 소요될 수 있습니다.
            </p>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (환불 제한)</h2>
            <p>다음의 경우에는 환불이 제한됩니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>이벤트, 프로모션 등을 통해 무상으로 제공된 서비스 또는 콘텐츠</li>
              <li>유료 콘텐츠의 전부 또는 대부분(70% 이상)을 이용 완료한 경우</li>
              <li>이용자의 귀책사유(계정 공유, 부정 이용 등)로 인한 서비스 이용 불가</li>
              <li>회원자격 제한·정지 후 이에 대한 이의가 인정되지 않는 경우</li>
            </ul>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 6조 (청약철회)</h2>
            <p>
              1. 이용자는 &quot;전자상거래 등에서의 소비자보호에 관한 법률&quot;에 따라 구매일로부터
              7일 이내에 청약철회를 할 수 있습니다.
            </p>
            <p>
              2. 다만, 디지털 콘텐츠의 특성상 이용을 개시한 경우 또는 &quot;콘텐츠산업 진흥법&quot;에 따른 예외에 해당하는 경우
              청약철회가 제한될 수 있으며, 이 경우 회사는 해당 콘텐츠 구매 시 이를 사전 고지합니다.
            </p>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 7조 (기타)</h2>
            <p>
              1. 본 약관에 명시되지 않은 사항은 전자상거래 등에서의 소비자보호에 관한 법률,
              콘텐츠산업 진흥법 및 관련 법령에 따릅니다.
            </p>
            <p>
              2. 각 앱스토어를 통한 결제의 환불은 해당 스토어의 환불 정책이 우선 적용됩니다.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#E5E7EB] px-4 pt-6 pb-4 text-xs leading-5 text-gray-400">
        <p>헬스스헬 | 우 16891</p>
        <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
        <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
        <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
        <p className="mt-2">Copyright&copy; stady. All rights reserved.</p>
      </div>
    </div>
  );
}
