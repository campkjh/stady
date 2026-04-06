import BackButton from "@/components/BackButton";

const tableClass = "mt-3 w-full overflow-hidden rounded-lg border border-gray-200 text-xs";
const thClass = "bg-gray-50 px-3 py-2.5 font-semibold text-gray-700 text-left";
const tdClass = "px-3 py-2.5 border-t border-gray-100";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center px-2 pt-2" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <BackButton />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-2 pb-6">
        <h1 className="mb-1 text-xl font-bold">개인정보처리방침</h1>
        <p className="mb-6 text-sm text-blue-500">시행일: 2026년 4월 1일 | 최종 수정: 2026년 4월 1일</p>

        <div className="space-y-6 text-sm leading-6 text-gray-700">
          {/* 개요 */}
          <div className="rounded-xl bg-gray-50 p-4 text-[13px] leading-relaxed text-gray-600">
            <p>
              헬스스헬(이하 &quot;회사&quot;)은 「개인정보 보호법」 제30조에 따라 이용자의 개인정보를
              보호하고, 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이
              개인정보처리방침을 수립·공개합니다. 본 방침은 Apple App Store, Google Play Store
              정책 및 대한민국 관련 법령을 준수합니다.
            </p>
          </div>

          {/* 제1조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 1조 (개인정보의 수집 항목 및 수집 방법)</h2>
            <p>회사는 서비스 제공을 위해 아래와 같은 최소한의 개인정보를 수집합니다.</p>

            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "25%" }}>구분</th>
                  <th className={thClass} style={{ width: "40%" }}>수집 항목</th>
                  <th className={thClass} style={{ width: "35%" }}>수집 시점</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>필수 정보</td>
                  <td className={tdClass}>이메일 주소, 비밀번호(암호화 저장), 닉네임</td>
                  <td className={tdClass}>회원가입 시</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>카카오 로그인</td>
                  <td className={tdClass}>카카오 계정 이메일, 프로필 닉네임</td>
                  <td className={tdClass}>카카오 소셜 로그인 시</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>선택 정보</td>
                  <td className={tdClass}>프로필 이미지, 가입 경로</td>
                  <td className={tdClass}>서비스 이용 중</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>자동 수집</td>
                  <td className={tdClass}>접속 IP, 접속 일시, 서비스 이용 기록, 기기 정보(OS, 브라우저 종류)</td>
                  <td className={tdClass}>서비스 이용 시 자동</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>학습 데이터</td>
                  <td className={tdClass}>퀴즈 풀이 기록, 점수, 소요 시간, 북마크, 오답 기록</td>
                  <td className={tdClass}>학습 활동 시 자동</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>고객 문의</td>
                  <td className={tdClass}>이름, 이메일, 문의 카테고리, 문의 제목 및 내용</td>
                  <td className={tdClass}>고객센터 문의 시</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3">
              <span className="font-medium text-gray-900">수집 방법: </span>
              회원가입 양식, 카카오 로그인 API, 서비스 이용 과정에서 자동 생성·수집, 고객센터 문의 양식
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 2조 (개인정보의 수집 및 이용 목적)</h2>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "30%" }}>이용 목적</th>
                  <th className={thClass} style={{ width: "70%" }}>상세 내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>회원 관리</td>
                  <td className={tdClass}>회원 가입·탈퇴 처리, 본인 확인, 부정 이용 방지, 계정 보안</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>서비스 제공</td>
                  <td className={tdClass}>문제집 풀이, OX 퀴즈, 영단어 퀴즈 등 학습 서비스 제공, 학습 기록 관리, 성적 분석, 맞춤형 콘텐츠 추천</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>고객 지원</td>
                  <td className={tdClass}>문의 접수 및 답변, 불만 처리, 공지사항 전달</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>서비스 개선</td>
                  <td className={tdClass}>이용 통계 분석, 서비스 품질 향상, 신규 기능 개발 참고</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[13px] text-gray-500">
              ※ 회사는 수집한 개인정보를 위 목적 이외의 용도로 사용하지 않으며, 이용 목적이 변경될 경우 사전 동의를 구합니다.
            </p>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 3조 (개인정보의 보유 및 이용 기간)</h2>
            <p>
              회사는 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
              단, 관련 법령에 의하여 보존할 필요가 있는 경우 아래와 같이 보관합니다.
            </p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "50%" }}>보존 항목</th>
                  <th className={thClass} style={{ width: "25%" }}>보존 기간</th>
                  <th className={thClass} style={{ width: "25%" }}>근거 법령</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={tdClass}>계약 또는 청약철회 등에 관한 기록</td>
                  <td className={tdClass}>5년</td>
                  <td className={tdClass}>전자상거래법</td>
                </tr>
                <tr>
                  <td className={tdClass}>대금결제 및 재화 등의 공급에 관한 기록</td>
                  <td className={tdClass}>5년</td>
                  <td className={tdClass}>전자상거래법</td>
                </tr>
                <tr>
                  <td className={tdClass}>소비자의 불만 또는 분쟁처리에 관한 기록</td>
                  <td className={tdClass}>3년</td>
                  <td className={tdClass}>전자상거래법</td>
                </tr>
                <tr>
                  <td className={tdClass}>본인확인에 관한 기록</td>
                  <td className={tdClass}>6개월</td>
                  <td className={tdClass}>정보통신망법</td>
                </tr>
                <tr>
                  <td className={tdClass}>접속에 관한 기록(로그)</td>
                  <td className={tdClass}>3개월</td>
                  <td className={tdClass}>통신비밀보호법</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 4조 (개인정보의 제3자 제공)</h2>
            <p>
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
              다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
            <p className="mt-2">자세한 사항은 &quot;개인정보 제3자 제공 동의&quot; 페이지를 확인해 주세요.</p>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 5조 (개인정보 처리 위탁)</h2>
            <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "25%" }}>수탁업체</th>
                  <th className={thClass} style={{ width: "40%" }}>위탁 업무</th>
                  <th className={thClass} style={{ width: "35%" }}>보유 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>Vercel Inc.</td>
                  <td className={tdClass}>서비스 호스팅, 인프라 운영, 파일(이미지) 저장</td>
                  <td className={tdClass}>위탁 계약 종료 시까지</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>카카오</td>
                  <td className={tdClass}>카카오 소셜 로그인 인증 서비스</td>
                  <td className={tdClass}>위탁 계약 종료 시까지</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 6조 (개인정보의 파기 절차 및 방법)</h2>
            <p>
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체 없이 해당 개인정보를 파기합니다.
            </p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "30%" }}>구분</th>
                  <th className={thClass} style={{ width: "70%" }}>파기 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>전자적 파일</td>
                  <td className={tdClass}>복구 및 재생이 불가능한 기술적 방법을 사용하여 영구 삭제</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>종이 문서</td>
                  <td className={tdClass}>분쇄기를 이용하여 분쇄하거나 소각</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 7조 (이용자 및 법정대리인의 권리·의무)</h2>
            <p>이용자(또는 법정대리인)는 회사에 대해 언제든지 다음 각 호의 권리를 행사할 수 있습니다.</p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "30%" }}>권리</th>
                  <th className={thClass} style={{ width: "70%" }}>행사 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>열람 요구</td>
                  <td className={tdClass}>마이페이지에서 본인의 개인정보 확인 가능, 또는 이메일(tlsdml0507@naver.com)로 요청</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>정정 요구</td>
                  <td className={tdClass}>마이페이지 &gt; 프로필 편집에서 직접 수정, 또는 이메일로 요청</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>삭제 요구</td>
                  <td className={tdClass}>회원 탈퇴 시 즉시 삭제, 또는 이메일로 특정 정보 삭제 요청</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>처리정지 요구</td>
                  <td className={tdClass}>이메일 또는 고객센터(010-4726-9276)를 통해 요청</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[13px] text-gray-500">
              ※ 회사는 이용자의 요청을 접수한 날로부터 10일 이내에 처리하며, 처리가 지연될 경우 그 사유를 통지합니다.
            </p>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 8조 (개인정보의 안전성 확보 조치)</h2>
            <p>회사는 이용자의 개인정보를 안전하게 관리하기 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><span className="font-medium">비밀번호 암호화:</span> bcrypt 알고리즘을 사용하여 비밀번호를 일방향 암호화하여 저장합니다.</li>
              <li><span className="font-medium">전송 구간 암호화:</span> SSL/TLS(HTTPS)를 적용하여 데이터 전송 시 암호화합니다.</li>
              <li><span className="font-medium">접근 권한 관리:</span> 개인정보에 대한 접근 권한을 최소한의 인원으로 제한합니다.</li>
              <li><span className="font-medium">접속 기록 보관:</span> 개인정보 처리시스템에 대한 접속 기록을 보관·관리합니다.</li>
            </ul>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 9조 (쿠키의 사용)</h2>
            <p>
              회사는 이용자 인증(로그인 상태 유지)을 위해 쿠키(Cookie)를 사용합니다.
              이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인이 필요한 서비스 이용이 제한될 수 있습니다.
            </p>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 10조 (추적(Tracking) 및 광고)</h2>
            <p>
              회사는 현재 제3자 추적 도구, 광고 식별자(IDFA/GAID), 또는 행동 기반 광고(타겟 광고)를
              사용하지 않습니다. 향후 광고 또는 분석 도구를 도입하는 경우, Apple의 앱 추적 투명성(ATT)
              정책 및 Google의 사용자 데이터 정책에 따라 사전 동의를 받겠습니다.
            </p>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 11조 (만 14세 미만 아동의 개인정보 보호)</h2>
            <p>
              회사는 만 14세 미만 아동의 회원가입을 제한하고 있습니다. 만 14세 미만 아동의 개인정보 수집이
              필요한 경우, 법정대리인의 동의를 받은 후 수집하며, 법정대리인은 아동의 개인정보에 대한 열람,
              정정, 삭제, 처리정지를 요청할 수 있습니다.
            </p>
          </section>

          {/* 제12조 - 데이터 삭제 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 12조 (개인정보 삭제 요청 - 계정 삭제)</h2>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px]">
              <p className="font-medium text-blue-900">Google Play / Apple App Store 정책에 따른 안내</p>
              <p className="mt-2 text-blue-800">
                이용자는 언제든지 자신의 계정과 관련된 모든 개인정보의 삭제를 요청할 수 있습니다.
                계정 삭제 요청 시 다음의 데이터가 영구적으로 삭제됩니다.
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-blue-800">
                <li>회원 정보 (이메일, 닉네임, 프로필 이미지)</li>
                <li>학습 기록 (퀴즈 풀이 기록, 점수, 북마크)</li>
                <li>고객 문의 내역</li>
              </ul>
              <p className="mt-3 font-medium text-blue-900">삭제 요청 방법:</p>
              <ul className="mt-1 list-decimal pl-5 space-y-1 text-blue-800">
                <li>앱 내 마이페이지 &gt; 회원 탈퇴</li>
                <li>이메일: tlsdml0507@naver.com</li>
                <li>고객센터: 010-4726-9276</li>
              </ul>
              <p className="mt-2 text-blue-800">
                삭제 요청 접수 후 영업일 기준 3일 이내에 처리되며, 법령에 따라 보관이 필요한 정보는 해당 기간 경과 후 파기됩니다.
              </p>
            </div>
          </section>

          {/* 제13조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 13조 (개인정보 국외 이전)</h2>
            <p>
              회사는 서비스 호스팅을 위해 Vercel Inc.(미국)의 클라우드 인프라를 이용하고 있으며,
              이에 따라 이용자의 개인정보가 미국 소재 서버에 저장·처리될 수 있습니다.
            </p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>이전받는 자</th>
                  <th className={thClass}>이전 국가</th>
                  <th className={thClass}>이전 항목</th>
                  <th className={thClass}>이전 목적</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>Vercel Inc.</td>
                  <td className={tdClass}>미국</td>
                  <td className={tdClass}>서비스 이용에 필요한 모든 데이터</td>
                  <td className={tdClass}>서비스 호스팅 및 운영</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제14조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 14조 (개인정보 보호책임자)</h2>
            <p>
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 이용자의 불만·피해구제를 위하여
              아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "30%" }}>구분</th>
                  <th className={thClass} style={{ width: "70%" }}>내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>성명</td>
                  <td className={tdClass}>김지승</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>직위</td>
                  <td className={tdClass}>대표</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>전화</td>
                  <td className={tdClass}>010-4726-9276</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>이메일</td>
                  <td className={tdClass}>tlsdml0507@naver.com</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제15조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 15조 (권익침해 구제 방법)</h2>
            <p>이용자는 개인정보 침해에 대한 피해구제, 상담 등을 아래 기관에 문의할 수 있습니다.</p>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass} style={{ width: "40%" }}>기관명</th>
                  <th className={thClass} style={{ width: "30%" }}>연락처</th>
                  <th className={thClass} style={{ width: "30%" }}>홈페이지</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${tdClass} font-medium`}>개인정보침해신고센터</td>
                  <td className={tdClass}>(국번없이) 118</td>
                  <td className={tdClass}>privacy.kisa.or.kr</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>개인정보분쟁조정위원회</td>
                  <td className={tdClass}>(국번없이) 1833-6972</td>
                  <td className={tdClass}>kopico.go.kr</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>대검찰청 사이버수사과</td>
                  <td className={tdClass}>(국번없이) 1301</td>
                  <td className={tdClass}>spo.go.kr</td>
                </tr>
                <tr>
                  <td className={`${tdClass} font-medium`}>경찰청 사이버수사국</td>
                  <td className={tdClass}>(국번없이) 182</td>
                  <td className={tdClass}>ecrm.cyber.go.kr</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 제16조 */}
          <section>
            <h2 className="mb-2 font-semibold text-gray-900">제 16조 (개인정보처리방침의 변경)</h2>
            <p>
              본 개인정보처리방침은 법령·정책 또는 보안기술의 변경에 따라 내용이 추가·삭제·수정될 수 있으며,
              변경 시에는 시행일 최소 7일 전에 서비스 내 공지사항을 통해 사전 고지합니다.
              이용자에게 불리한 변경의 경우 최소 30일 전에 고지합니다.
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
