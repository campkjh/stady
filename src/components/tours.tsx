"use client";

import CoachMarks, { K, type TourStep } from "@/components/CoachMarks";

/**
 * 탭별 첫 진입 튜토리얼 문구. 짚는 칸 = 각 화면의 data-tour.
 * id 를 올리면 이미 본 사람에게도 다시 뜬다(문구·구성을 크게 바꿨을 때만).
 */
const COMMUNITY: TourStep[] = [
  { sel: '[data-tour="com-cats"]', text: <>게시판별로 <K>골라서</K> 볼 수 있어요</>, sub: "궁금한 건 질문게시판에 올려 보세요", radius: 22 },
  { sel: '[data-tour="com-weekly"]', text: <>이번 주 <K>인기글</K>이 여기 모여요</>, sub: "옆으로 밀어서 넘겨 보세요" },
  { sel: '[data-tour="com-profile"]', text: <><K>프로필</K>을 누르면 활동을 볼 수 있어요</>, sub: "팔로우하면 그 사람 소식을 놓치지 않아요", radius: 16 },
  { sel: '[data-tour="com-write"]', text: <>글을 쓰면 <K>경험치</K>가 쌓여요</>, sub: "하루에 한 번 글쓰기 +10 XP", radius: 30 },
];

const OBSIDIAN: TourStep[] = [
  { sel: '[data-tour="tmr-clock"]', text: <>▶ 를 눌러 <K>공부 시간</K>을 기록해요</>, sub: "오늘 공부한 시간이 이렇게 쌓여요", radius: 20 },
  { sel: '[data-tour="tmr-flame"]', text: <>이번 주 시간으로 <K>불꽃 등급</K>이 올라가요</>, sub: "월요일에 초기화돼요", radius: 16 },
  { sel: '[data-tour="tmr-tabs"]', text: <><K>스타디룸</K>에서 같이 공부하고 <K>랭킹</K>으로 겨뤄요</>, sub: "3위 안에 들면 프라임 1주일 무료", radius: 14 },
  { sel: '[data-tour="tmr-friends"]', text: <><K>친구</K>를 추가해 함께 공부해요</>, sub: "친구 요청이 오면 여기에 알림이 떠요", radius: 22 },
];

const POST_DETAIL: TourStep[] = [
  { sel: '[data-tour="cd-actions"]', text: <><K>하트</K>로 공감하고 <K>공유</K>도 할 수 있어요</>, sub: "링크 복사·공유는 오른쪽 아이콘이에요", radius: 14 },
  { sel: '[data-tour="cd-sort"]', text: <>댓글은 <K>인기순·최신순</K>으로 골라 봐요</>, sub: "추천순·오래된순도 있어요", radius: 14 },
  { sel: '[data-tour="cd-reply"]', text: <><K>답글 달기</K>를 누르면 <K>@멘션</K>이 붙어요</>, sub: "그 사람에게 바로 답글이 달려요", radius: 12 },
  { sel: '[data-tour="cd-compose"]', text: <>아래에서 <K>댓글</K>을 남겨요</>, sub: "이모지를 누르면 입력칸에 바로 들어가요", radius: 22 },
];

export const CommunityTour = () => <CoachMarks id="com-v1" steps={COMMUNITY} />;
export const ObsidianTour = () => <CoachMarks id="obs-v1" steps={OBSIDIAN} />;
export const PostDetailTour = () => <CoachMarks id="cdet-v1" steps={POST_DETAIL} />;
