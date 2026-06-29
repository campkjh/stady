// 답변왕 뱃지: 주간 댓글 10개 이상 유저. 왕관 아이콘 + "답변왕"(빨강→주황/인디언옐로우
// 그라데이션이 반짝이는 글자). 스타일/애니메이션은 globals.css(.answer-king-*)에 정의.
export default function AnswerKingBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="answer-king-badge" title="답변왕">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/answer-king-crown.svg" alt="" className="answer-king-crown" />
      <span className="answer-king-text">답변왕</span>
    </span>
  );
}
