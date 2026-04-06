import BackHeader from "@/components/BackHeader";
import Accordion from "@/components/Accordion";

const NOTICES = [
  {
    id: 1,
    title: "서비스 업데이트 안내",
    date: "2026.04.01",
    detail:
      "안녕하세요, 스타디입니다. 더 나은 학습 경험을 위해 서비스가 업데이트되었습니다. 새로운 UI와 개선된 문제 풀이 환경을 확인해 보세요.",
  },
  {
    id: 2,
    title: "시스템 점검 안내",
    date: "2026.03.25",
    detail:
      "시스템 안정성 향상을 위한 점검이 예정되어 있습니다. 점검 시간: 4월 10일 오전 2시~6시. 해당 시간에는 서비스 이용이 제한될 수 있습니다.",
  },
  {
    id: 3,
    title: "새로운 문제집 추가",
    date: "2026.03.18",
    detail:
      "수학, 영어, 과학 등 다양한 과목의 새로운 문제집이 추가되었습니다. 지금 바로 확인하고 학습을 시작해 보세요!",
  },
  {
    id: 4,
    title: "이벤트 안내",
    date: "2026.03.10",
    detail:
      "스타디 출석 이벤트가 진행 중입니다! 7일 연속 출석 시 특별 문제집을 무료로 제공합니다. 이벤트 기간: 3월 10일~4월 10일.",
  },
  {
    id: 5,
    title: "개인정보 처리방침 변경",
    date: "2026.03.01",
    detail:
      "개인정보 처리방침이 일부 변경되었습니다. 변경된 내용은 마이페이지 > 개인정보 처리방침에서 확인하실 수 있습니다. 변경 시행일: 2026년 4월 1일.",
  },
];

export default function NoticePage() {
  const items = NOTICES.map((notice) => ({
    id: notice.id,
    header: (
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 4 }}>
          {notice.title}
        </p>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>{notice.date}</p>
      </div>
    ),
    content: (
      <div style={{ padding: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "#4B5563" }}>
        {notice.detail}
      </div>
    ),
  }));

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      <BackHeader title="공지사항" />
      <Accordion items={items} />
    </div>
  );
}
