// 주간 왕 뱃지 3종(기준·판정은 lib/community.ts 상단 주석 참고 — 모두 최근 7일 라이브 판정).
//   답변왕: 짧지 않은 댓글 40개 이상 — 토스 왕관 + 빨강→주황 반짝이 글자
//   채택왕: 채택(고정)된 댓글 5개 이상 — 토스 체크 메달 + 골드 반짝이 글자
//   활동왕: 주간 경험치 100 이상 — 토스 초록 번개 + 그린 반짝이 글자
// 스타일/애니메이션은 globals.css(.answer-king-* / .king-badge--*)에 정의.
type Props = { answer?: boolean; pick?: boolean; activity?: boolean };

function Badge({ kind, icon, label, title }: { kind: string; icon: string; label: string; title: string }) {
  return (
    <span className={`answer-king-badge king-badge--${kind}`} title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="answer-king-crown" />
      <span className="answer-king-text">{label}</span>
    </span>
  );
}

export default function KingBadges({ answer, pick, activity }: Props) {
  if (!answer && !pick && !activity) return null;
  return (
    <>
      {answer && <Badge kind="answer" icon="/icons/toss/crown.svg" label="답변왕" title="최근 7일 댓글 40개 이상" />}
      {pick && <Badge kind="pick" icon="/icons/toss/medal-check.svg" label="채택왕" title="최근 7일 채택된 댓글 5개 이상" />}
      {activity && <Badge kind="activity" icon="/icons/toss/lightning-green.svg" label="활동왕" title="최근 7일 경험치 100 이상" />}
    </>
  );
}
