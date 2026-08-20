import BackHeader from "@/components/BackHeader";

const tableClass = "mt-3 w-full overflow-hidden rounded-lg text-xs";
const thClass = "px-3 py-2.5 font-semibold text-left";
const tdClass = "px-3 py-2.5";
const tableStyle = { border: "1px solid var(--c-border)" } as const;
const thStyle = { background: "var(--c-bg-soft)", color: "var(--c-text-2c)" } as const;
const tdStyle = { borderTop: "1px solid var(--c-bg-muted)" } as const;
const h2Style = { color: "var(--c-text-2)" } as const;

export default function ThirdPartyPage() {
  return (
    <div className="flex flex-col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <BackHeader title="개인정보 제3자 제공 동의" />

      <div className="flex flex-1 flex-col" style={{ padding: "8px 20px 24px" }}>
        <p className="mb-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-5)" }}>시행일: 2026년 4월 1일 | 최종 수정: 2026년 4월 1일</p>

        <div className="space-y-6" style={{ fontSize: 14, lineHeight: 1.7, color: "var(--c-text-3b)" }}>
          {/* 제1조 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 1조 (목적)</h2>
            <p>
              헬스스헬(이하 &quot;회사&quot;)은 이용자의 개인정보를 &quot;개인정보처리방침&quot;에서 고지한
              범위 내에서 사용하며, 이용자의 사전 동의 없이 해당 범위를 초과하여 이용하거나
              원칙적으로 제3자에게 제공하지 않습니다.
              본 동의서는 Apple App Store, Google Play Store 정책 및 「개인정보 보호법」을 준수합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 2조 (개인정보 제3자 제공 현황)</h2>
            <p>회사는 현재 이용자의 개인정보를 다음과 같이 제3자에게 제공하고 있습니다.</p>
            <div className="rounded-xl p-3 mt-3 text-[13px]" style={{ border: "1px solid var(--c-success-line)", background: "var(--c-success-soft-2)", color: "var(--c-success-d)" }}>
              현재 이용자의 개인정보를 제3자에게 직접 제공하고 있지 않습니다.
              아래는 서비스 운영을 위해 개인정보 처리를 위탁하는 업체 현황입니다.
            </div>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 3조 (개인정보 처리 위탁 현황)</h2>
            <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
            <table className={tableClass} style={tableStyle}>
              <thead>
                <tr>
                  <th className={thClass} style={thStyle}>수탁업체</th>
                  <th className={thClass} style={thStyle}>위탁 업무</th>
                  <th className={thClass} style={thStyle}>제공 항목</th>
                  <th className={thClass} style={thStyle}>보유 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>Vercel Inc. (미국)</td>
                  <td className={tdClass} style={tdStyle}>서비스 호스팅, 인프라 운영, 파일 저장</td>
                  <td className={tdClass} style={tdStyle}>서비스 이용에 필요한 모든 데이터</td>
                  <td className={tdClass} style={tdStyle}>위탁 계약 종료 시까지</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>카카오 (대한민국)</td>
                  <td className={tdClass} style={tdStyle}>소셜 로그인 인증</td>
                  <td className={tdClass} style={tdStyle}>카카오 계정 식별 정보</td>
                  <td className={tdClass} style={tdStyle}>위탁 계약 종료 시까지</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제4조 - 데이터 안전 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 4조 (Google Play 데이터 안전 섹션 공개)</h2>
            <p>Google Play Store 정책에 따라 앱에서 수집·공유하는 데이터를 다음과 같이 공개합니다.</p>
            <table className={tableClass} style={tableStyle}>
              <thead>
                <tr>
                  <th className={thClass} style={{ ...thStyle, width: "25%" }}>데이터 유형</th>
                  <th className={thClass} style={{ ...thStyle, width: "20%" }}>수집 여부</th>
                  <th className={thClass} style={{ ...thStyle, width: "20%" }}>공유 여부</th>
                  <th className={thClass} style={{ ...thStyle, width: "35%" }}>목적</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>이메일 주소</td>
                  <td className={tdClass} style={tdStyle}>수집</td>
                  <td className={tdClass} style={tdStyle}>비공유</td>
                  <td className={tdClass} style={tdStyle}>계정 관리, 로그인</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>이름/닉네임</td>
                  <td className={tdClass} style={tdStyle}>수집</td>
                  <td className={tdClass} style={tdStyle}>비공유</td>
                  <td className={tdClass} style={tdStyle}>프로필 표시, 서비스 개인화</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>프로필 사진</td>
                  <td className={tdClass} style={tdStyle}>선택 수집</td>
                  <td className={tdClass} style={tdStyle}>비공유</td>
                  <td className={tdClass} style={tdStyle}>프로필 표시</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>앱 활동 기록</td>
                  <td className={tdClass} style={tdStyle}>수집</td>
                  <td className={tdClass} style={tdStyle}>비공유</td>
                  <td className={tdClass} style={tdStyle}>학습 기록 관리, 서비스 개선</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>기기/접속 정보</td>
                  <td className={tdClass} style={tdStyle}>자동 수집</td>
                  <td className={tdClass} style={tdStyle}>비공유</td>
                  <td className={tdClass} style={tdStyle}>보안, 서비스 품질 향상</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[13px]" style={{ color: "var(--c-text-4)" }}>
              ※ &quot;비공유&quot;: 제3자에게 이전하지 않음 (서비스 제공자(수탁업체) 제외)
            </p>
          </section>

          {/* 제5조 - Apple 관련 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 5조 (Apple 앱 개인정보 보호 라벨)</h2>
            <p>Apple App Store 정책에 따라 앱의 데이터 수집 관행을 다음과 같이 공개합니다.</p>
            <table className={tableClass} style={tableStyle}>
              <thead>
                <tr>
                  <th className={thClass} style={{ ...thStyle, width: "30%" }}>항목</th>
                  <th className={thClass} style={{ ...thStyle, width: "70%" }}>내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>사용자 추적</td>
                  <td className={tdClass} style={tdStyle}>추적하지 않음 (IDFA 사용 안 함)</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>사용자에게 연결된 데이터</td>
                  <td className={tdClass} style={tdStyle}>이메일, 닉네임, 학습 기록</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`} style={tdStyle}>사용자에게 연결되지 않은 데이터</td>
                  <td className={tdClass} style={tdStyle}>사용 데이터 (접속 로그), 진단 데이터</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 6조 (예외사항)</h2>
            <p>다음의 경우에는 이용자의 동의 없이 개인정보를 제3자에게 제공할 수 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위하여 불가피한 경우</li>
              <li>공공기관이 법령 등에서 정하는 소관 업무의 수행을 위하여 불가피한 경우</li>
              <li>정보주체 또는 그 법정대리인이 의사표시를 할 수 없는 상태에 있거나 주소불명 등으로
                사전 동의를 받을 수 없는 경우로서 명백히 정보주체 또는 제3자의 급박한 생명, 신체,
                재산의 이익을 위하여 필요하다고 인정되는 경우</li>
              <li>수사기관이 관련 법령에 의한 적법한 절차에 따라 요청하는 경우</li>
            </ul>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 7조 (향후 제3자 제공 시 절차)</h2>
            <p>
              향후 서비스 제공을 위해 개인정보 제3자 제공이 필요한 경우,
              회사는 다음 사항을 사전에 고지하고 별도의 동의를 받겠습니다.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>개인정보를 제공받는 자</li>
              <li>제공받는 자의 개인정보 이용 목적</li>
              <li>제공하는 개인정보의 항목</li>
              <li>제공받는 자의 개인정보 보유 및 이용 기간</li>
              <li>동의를 거부할 수 있다는 사실 및 거부에 따른 불이익 내용</li>
            </ul>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="mb-2 font-semibold" style={h2Style}>제 8조 (동의 거부 권리)</h2>
            <p>
              이용자는 개인정보 제3자 제공에 대한 동의를 거부할 권리가 있습니다.
              필수 동의를 거부하는 경우 회원가입이 제한될 수 있으며,
              선택 동의를 거부하는 경우 일부 서비스의 이용이 제한될 수 있습니다.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--c-border)", padding: "24px 20px 16px", fontSize: 12, fontWeight: 600, lineHeight: 1.7, color: "var(--c-text-5)" }}>
        <p>스타디 | 우 16891</p>
        <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
        <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
        <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
        <p style={{ marginTop: 8 }}>Copyright&copy; stady. All rights reserved.</p>
      </div>
    </div>
  );
}
