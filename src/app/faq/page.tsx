import BackHeader from "@/components/BackHeader";
import Accordion from "@/components/Accordion";

const FAQS = [
  {
    id: 1,
    question: "문제집은 어떻게 풀 수 있나요?",
    answer:
      "홈 화면에서 원하는 문제집을 선택하면 바로 풀이를 시작할 수 있습니다. 카테고리별로 문제집을 찾아볼 수도 있습니다.",
  },
  {
    id: 2,
    question: "틀린 문제는 어디서 확인할 수 있나요?",
    answer:
      "풀이 내역 탭에서 이전에 풀었던 문제와 결과를 확인할 수 있습니다. 틀린 문제만 모아서 다시 풀어볼 수도 있습니다.",
  },
  {
    id: 3,
    question: "OX퀴즈는 매일 바뀌나요?",
    answer:
      "네, OX퀴즈는 매일 새로운 문제가 출제됩니다. 매일 꾸준히 풀어보며 실력을 향상시켜 보세요!",
  },
  {
    id: 4,
    question: "영단어 퀴즈 난이도는 어떻게 되나요?",
    answer:
      "영단어 퀴즈는 초급, 중급, 고급으로 나뉘어 있으며, 학습 수준에 맞게 선택하여 풀 수 있습니다.",
  },
  {
    id: 5,
    question: "결제는 어떻게 하나요?",
    answer:
      "마이페이지 > 결제 관리에서 다양한 결제 수단을 이용하실 수 있습니다. 신용카드, 계좌이체 등을 지원합니다.",
  },
  {
    id: 6,
    question: "비밀번호를 잊어버렸어요",
    answer:
      "로그인 화면에서 '비밀번호 찾기'를 통해 가입 시 등록한 이메일로 비밀번호 재설정 링크를 받으실 수 있습니다.",
  },
  {
    id: 7,
    question: "앱에서 알림을 받을 수 있나요?",
    answer:
      "마이페이지 > 설정에서 알림을 켜시면 새로운 문제집 추가, 이벤트 등의 소식을 받아보실 수 있습니다.",
  },
];

export default function FAQPage() {
  const items = FAQS.map((faq) => ({
    id: faq.id,
    header: (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#4A90D9", flexShrink: 0 }}>Q.</span>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{faq.question}</p>
      </div>
    ),
    content: (
      <div style={{ padding: "0 0 16px 30px", fontSize: 14, lineHeight: 1.6, color: "#4B5563", display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B", flexShrink: 0 }}>A.</span>
        <span>{faq.answer}</span>
      </div>
    ),
  }));

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      <BackHeader title="자주묻는 질문" />
      <Accordion items={items} />
    </div>
  );
}
