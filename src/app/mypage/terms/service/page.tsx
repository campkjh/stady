import BackButton from "@/components/BackButton";

const tableClass = "mt-3 w-full overflow-hidden rounded-lg border border-gray-200 text-xs";
const thClass = "bg-gray-50 px-3 py-2.5 font-semibold text-gray-700 text-left";
const tdClass = "px-3 py-2.5 border-t border-gray-100";

export default function ServiceTermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2 pb-6">
        <h1 className="mb-1 text-xl font-bold">서비스 이용약관</h1>
        <p className="mb-6 text-sm text-blue-500">시행일: 2026년 4월 1일 | 최종 수정: 2026년 4월 1일</p>

        <div className="space-y-6 text-sm leading-6 text-gray-700">
          {/* 제1조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (목적)</h2>
            <p>
              본 약관은 헬스스헬(이하 &quot;회사&quot;)이 운영하는 학습 플랫폼 &quot;스타디(Stady)&quot;(이하 &quot;서비스&quot;)의
              이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을
              규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (용어의 정의)</h2>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "25%" }}>용어</th>
                  <th className={thClass} style={{ width: "75%" }}>정의</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>서비스</td>
                  <td className={tdClass}>회사가 제공하는 문제집 풀이, OX 퀴즈, 영단어 퀴즈, 학습 기록 관리 등 모바일 및 웹 기반 학습 관련 일체의 서비스</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>이용자</td>
                  <td className={tdClass}>본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>회원</td>
                  <td className={tdClass}>회사에 개인정보를 제공하여 회원등록을 한 자로서, 서비스를 지속적으로 이용할 수 있는 자</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>콘텐츠</td>
                  <td className={tdClass}>서비스 내에서 제공되는 문제집, 퀴즈, 해설 등 일체의 학습 자료</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (약관의 게시 및 변경)</h2>
            <p>1. 본 약관의 내용은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지합니다.</p>
            <p>2. 회사는 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시에는 적용일 및 변경 사유를 명시하여 서비스 내에 최소 7일 전 공지합니다. 이용자에게 불리한 변경의 경우 최소 30일 전에 공지합니다.</p>
            <p>3. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</p>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (회원가입)</h2>
            <p>1. 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.</p>
            <p>2. 회사는 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.</p>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
              <li>만 14세 미만인 경우 (법정대리인의 동의가 없는 경우)</li>
              <li>이전에 회원자격을 상실한 적이 있는 경우 (단, 회사의 재가입 승인을 받은 경우 제외)</li>
              <li>기술상 현저히 지장이 있는 경우</li>
            </ul>
            <p className="mt-2">3. 회원가입은 이메일 가입 또는 카카오 소셜 로그인을 통해 가능합니다.</p>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (서비스의 제공)</h2>
            <p>회사는 다음과 같은 서비스를 제공합니다.</p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "30%" }}>서비스</th>
                  <th className={thClass} style={{ width: "70%" }}>설명</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>문제집 풀이</td>
                  <td className={tdClass}>다양한 과목·카테고리별 문제집 학습 및 성적 분석</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>OX 퀴즈</td>
                  <td className={tdClass}>참/거짓 형식의 퀴즈 풀이 및 해설 제공</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>영단어 퀴즈</td>
                  <td className={tdClass}>4지선다 형식의 영어 단어 학습 퀴즈</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>학습 기록 관리</td>
                  <td className={tdClass}>풀이 내역, 점수, 오답 노트, 북마크 기능</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>고객 지원</td>
                  <td className={tdClass}>공지사항, FAQ, 1:1 문의 기능</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2">서비스는 연중무휴 24시간 제공을 원칙으로 하며, 시스템 점검 등의 경우 사전 공지 후 일시 중단할 수 있습니다.</p>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 6조 (이용자의 의무)</h2>
            <p>이용자는 다음 각 호의 행위를 하여서는 안 됩니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>허위 정보를 등록하는 행위</li>
              <li>타인의 개인정보를 도용하는 행위</li>
              <li>서비스 내 콘텐츠를 무단으로 복제, 배포, 전송, 출판하는 행위</li>
              <li>회사 또는 제3자의 지적재산권을 침해하는 행위</li>
              <li>서비스의 안정적 운영을 방해하는 행위 (해킹, 바이러스 유포 등)</li>
              <li>다른 이용자의 서비스 이용을 방해하는 행위</li>
              <li>관련 법령에 위반되는 행위</li>
            </ul>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 7조 (지적재산권)</h2>
            <p>
              1. 서비스 내에서 제공되는 모든 콘텐츠(문제, 해설, 이미지, 디자인 등)에 대한 지적재산권은 회사에 귀속됩니다.
            </p>
            <p>
              2. 이용자는 서비스를 통해 얻은 정보를 회사의 사전 동의 없이 상업적으로 이용하거나 제3자에게 제공할 수 없습니다.
            </p>
            <p>
              3. 이용자가 서비스 내에 게시한 리뷰, 문의 등의 저작권은 해당 이용자에게 귀속됩니다.
            </p>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 8조 (회원 탈퇴 및 자격 제한)</h2>
            <p>1. 회원은 회사에 언제든지 탈퇴를 요청할 수 있으며, 회사는 즉시 회원탈퇴를 처리합니다.</p>
            <p>2. 회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한·정지 또는 상실시킬 수 있습니다.</p>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>가입 신청 시에 허위 내용을 등록한 경우</li>
              <li>다른 사람의 서비스 이용을 방해하거나 정보를 도용한 경우</li>
              <li>서비스를 이용하여 법령 또는 본 약관이 금지하는 행위를 한 경우</li>
              <li>회사의 서비스 운영을 고의로 방해한 경우</li>
            </ul>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 9조 (서비스의 변경 및 중단)</h2>
            <p>1. 회사는 상당한 이유가 있는 경우 운영상·기술상의 필요에 따라 서비스를 변경할 수 있습니다.</p>
            <p>2. 다음의 경우 서비스의 전부 또는 일부를 일시적으로 중단할 수 있습니다.</p>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>시스템 정기 점검, 서버 증설·교체 등 기술적 필요</li>
              <li>천재지변, 국가비상사태 등 불가항력</li>
              <li>전기통신사업법에 정한 기간통신사업자의 서비스 중단</li>
            </ul>
            <p className="mt-2">3. 서비스 중단 시 사전에 공지하며, 불가피한 경우 사후에 공지할 수 있습니다.</p>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 10조 (면책조항)</h2>
            <p>1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</p>
            <p>2. 회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.</p>
            <p>3. 회사는 이용자가 서비스를 이용하여 기대하는 학습 효과 등에 대하여 책임을 지지 않습니다.</p>
            <p>4. 회사는 이용자 간 또는 이용자와 제3자 간에 서비스를 매개로 하여 발생한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해에 대해 책임을 지지 않습니다.</p>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 11조 (분쟁 해결 및 관할)</h2>
            <p>1. 본 약관은 대한민국 법률에 따라 규율되고 해석됩니다.</p>
            <p>2. 서비스 이용과 관련하여 회사와 이용자 사이에 분쟁이 발생한 경우, 양 당사자는 분쟁의 해결을 위해 성실히 협의합니다.</p>
            <p>3. 협의에 의해 해결되지 않은 분쟁은 민사소송법에 따른 관할 법원에 소를 제기할 수 있습니다.</p>
          </section>

          {/* 부칙 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">부칙</h2>
            <p>본 약관은 2026년 4월 1일부터 시행합니다.</p>
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
