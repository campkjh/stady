const DAILY_MESSAGES = {
  ox: [
    "오늘의 감각을 OX로 깨워볼까요?",
    "짧게 풀고 확실하게 기억해요.",
    "오늘도 한 문제씩 단단하게 가요.",
    "가볍게 시작해도 실력은 쌓여요.",
    "오늘의 판단력, OX로 체크!",
    "헷갈리는 개념을 오늘 정리해봐요.",
    "매일 한 번, 감을 잃지 않기.",
  ],
  vocab: [
    "오늘의 단어 감각을 깨워볼까요?",
    "단어 하나가 점수를 바꿔요.",
    "오늘 외운 단어는 내일의 실력!",
    "짧게 풀고 오래 기억해요.",
    "오늘도 단어력 한 칸 올리기.",
    "헷갈리는 뜻부터 차근차근.",
    "매일 보는 단어가 진짜 실력이 돼요.",
  ],
} as const;

export function getDailyQuizMessage(type: keyof typeof DAILY_MESSAGES) {
  const now = new Date();
  const daySeed = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000
  );
  const messages = DAILY_MESSAGES[type];
  return messages[daySeed % messages.length];
}
