"use client";

import CoachMarks, { K, type TourStep } from "@/components/CoachMarks";

/**
 * 탭별 첫 진입 튜토리얼 문구. 짚는 칸 = 각 화면의 data-tour.
 * id 를 올리면 이미 본 사람에게도 다시 뜬다(문구·구성을 크게 바꿨을 때만).
 */
const COMMUNITY: TourStep[] = [
  { sel: '[data-tour="com-cats"]', text: <>게시판별로 <K>골라서</K> 볼 수 있어요</>, sub: "궁금한 건 질문게시판에 올려 보세요", radius: 22 },
  { sel: '[data-tour="com-weekly"]', text: <>이번 주 <K>인기글</K>이 여기 모여요</>, sub: "옆으로 밀어서 넘겨 보세요" },
  { sel: '[data-tour="com-profile"]', text: <><K>프로필</K>을 누르면 활동을 볼 수 있어요</>, sub: "남긴 글·댓글·리포스트와 배지를 볼 수 있어요", radius: 16 },
  {
    sel: '[data-tour="com-write"]',
    text: <>활동하면 <K>점수</K>가 쌓여요</>,
    sub: <>글 쓰기 <b>+10</b> · 댓글 <b>+3</b> · 내 글에 공감 받기 <b>+2</b><br />퀴즈를 풀거나 문제를 내도 점수를 받아요</>,
    radius: 30,
  },
  {
    sel: '[data-tour="com-tier"]',
    text: <>점수가 쌓이면 <K>등급</K>이 올라가요</>,
    sub: <>아이언 → 실버 40점 → 골드 120점 → 에메랄드 300점<br />→ 다이아 600점 → 마스터 1,200점 이상으로 계속돼요</>,
    radius: 14,
  },
  {
    sel: '[data-tour="com-tier"]',
    text: <><K>답변왕</K>이 되면 스타디 <K>프라임 무료</K></>,
    sub: <>최근 7일 동안 15자 이상 댓글을 10개 쓰면 답변왕 뱃지!<br />뱃지를 유지하는 동안 프라임이 계속 무료예요</>,
    radius: 14,
  },
];

const OBSIDIAN: TourStep[] = [
  { sel: '[data-tour="tmr-clock"]', text: <>▶ 를 눌러 <K>공부 시간</K>을 기록해요</>, sub: "오늘 공부한 시간이 이렇게 쌓여요", radius: 20 },
  { sel: '[data-tour="tmr-flame"]', text: <>이번 주 시간으로 <K>불꽃 등급</K>이 올라가요</>, sub: "월요일에 초기화돼요", radius: 16 },
  { sel: '[data-tour="tmr-tabs"]', text: <><K>스타디룸</K>에서 같이 공부하고 <K>랭킹</K>으로 겨뤄요</>, sub: "3위 안에 들면 프라임 1주일 무료", radius: 14 },
  { sel: '[data-tour="tmr-friends"]', text: <><K>친구</K>를 추가해 함께 공부해요</>, sub: "친구 요청이 오면 여기에 알림이 떠요", radius: 22 },
];

const POST_DETAIL: TourStep[] = [
  { sel: '[data-tour="cd-actions"]', text: <><K>하트</K>로 공감하고 <K>공유</K>도 할 수 있어요</>, sub: "리포스트·공유는 오른쪽 아이콘이에요", radius: 14 },
  { sel: '[data-tour="cd-sort"]', text: <>댓글은 <K>인기순·최신순</K>으로 골라 봐요</>, sub: "추천순·오래된순도 있어요", radius: 14 },
  { sel: '[data-tour="cd-reply"]', text: <><K>답글 달기</K>를 누르면 <K>@멘션</K>이 붙어요</>, sub: "그 사람에게 바로 답글이 달려요", radius: 12 },
  { sel: '[data-tour="cd-compose"]', text: <>아래에서 <K>댓글</K>을 남겨요</>, sub: "이모지를 누르면 입력칸에 바로 들어가요", radius: 22 },
];

const OX_QUIZ: TourStep[] = [
  { sel: '[data-tour="ox-question"]', text: <>문제 <K>지문</K>을 읽고 O / X 로 답해요</>, sub: "양옆 화면을 탭하거나 옆으로 밀어서 문제를 넘겨요", radius: 16 },
  { sel: '[data-tour="ox-answer"]', text: <><K>그렇다 / 아니다</K>를 눌러요</>, sub: "누르면 정답과 해설이 바로 나와요", radius: 20 },
  { sel: '[data-tour="ox-toolbox"]', text: <>도구는 <K>위 헤더</K>에 있어요</>, sub: "양옆 탭 넘기기 · 문제 섞기 · 퀴즈 노트 · 책갈피", radius: 20 },
  { sel: '[data-tour="ox-chips"]', text: <><K>정답·오답</K>만 모아 다시 풀 수 있어요</>, sub: "틀린 문제만 골라 복습해 보세요", radius: 24 },
  { sel: '[data-tour="ox-list"]', text: <><K>목록</K>에서 원하는 문제로 바로 가요</>, sub: "정답은 노랑, 오답은 빨강으로 표시돼요", radius: 14 },
];

const BOOKMARKS: TourStep[] = [
  { sel: '[data-tour="bm-tabs"]', text: <>문제 종류별로 <K>모아서</K> 볼 수 있어요</>, sub: "OX·영단어·문제집 탭을 눌러 보세요", radius: 22 },
  { sel: '[data-tour="bm-review"]', text: <>모은 문제를 <K>한 번에 다시 풀어요</K></>, sub: "틀렸거나 헷갈린 문제만 복습하기 좋아요", radius: 20 },
  { sel: '[data-tour="bm-card"]', text: <>카드를 누르면 그 <K>문제로 이동</K>해요</>, sub: "퀴즈 노트에 적은 메모와 그림도 같이 보여요", radius: 14 },
  { sel: '[data-tour="bm-vocab"]', text: <>영단어는 <K>옆으로 밀어서</K> 뺄 수 있어요</>, sub: "왼쪽으로 밀면 삭제 버튼이 나와요", radius: 14 },
  { sel: '[data-tour="bm-clear"]', text: <>정리할 땐 <K>모든 책갈피</K>를 한 번에 취소해요</>, sub: "눌러도 한 번 더 물어봐요", radius: 999 },
];

export const CommunityTour = () => <CoachMarks id="com-v1" steps={COMMUNITY} />;
export const ObsidianTour = () => <CoachMarks id="obs-v1" steps={OBSIDIAN} />;
export const PostDetailTour = () => <CoachMarks id="cdet-v1" steps={POST_DETAIL} />;
export const OxQuizTour = () => <CoachMarks id="ox-v1" steps={OX_QUIZ} />;
export const BookmarksTour = () => <CoachMarks id="bm-v1" steps={BOOKMARKS} />;
