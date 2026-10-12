"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SurveyGate from "@/components/SurveyGate";
import NoticePopup from "@/components/NoticePopup";
import IntroBannerCarousel from "@/components/IntroBannerCarousel";
import NewWorkbookBubble from "@/components/NewWorkbookBubble";
import NoticeHomeCard from "@/components/NoticeHomeCard";
import DailyQuizCard from "@/components/DailyQuizCard";
import MockExamBrowser, { type BrowserExam } from "@/components/MockExamBrowser";
import { scheduleHomeRatingOnce } from "@/lib/appReview";
import { clientCache } from "@/lib/clientCache";
import { useEntrance } from "@/lib/entrance";
import PrimeFab from "@/components/PrimeFab";
import { HeaderBellIcon, HeaderSearchIcon } from "@/components/HeaderIcons";
import StadyLogo from "@/components/StadyLogo";

// 홈 "스타디 교재"(한국사 3,900원 PDF) 상품 카드 노출 여부.
// 임시 숨김 상태. 다시 노출하려면 true 로 바꾸세요.
const SHOW_STORE_SECTION = false;

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  isPopular: boolean;
}

interface Workbook {
  id: string;
  title: string;
  thumbnail: string | null;
  categoryId: string;
  totalQuestions: number;
  questionPerPage: number;
  isPopular: boolean;
  createdAt: string | Date;
  category: Category;
}

interface OxQuizSet {
  id: string;
  title: string;
  thumbnail: string | null;
  totalQuestions: number;
  isPopular: boolean;
  createdAt: string | Date;
  category: Category;
  answerRate?: number | null;
  isPremium?: boolean; // 생윤·윤사 앞 5개 이후 = 프리미엄 잠금
}

interface VocabQuizSet {
  id: string;
  title: string;
  thumbnail: string | null;
  totalQuestions: number;
  isPopular: boolean;
  createdAt: string | Date;
  category: Category;
}

// GET /api/quiz-summary 응답. 기록이 있는 세트만 키로 들어온다(없으면 '미시작').
interface QuizSummaryEntry {
  answered: number;
  total: number;
  completed: boolean;
  bestPct: number | null;
}
interface QuizSummary {
  ox: Record<string, QuizSummaryEntry>;
  vocab: Record<string, QuizSummaryEntry>;
}
const EMPTY_QUIZ_SUMMARY: QuizSummary = { ox: {}, vocab: {} };

// 등록된 지 7일 이내면 새 퀴즈로 본다.
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
function isNewCreatedAt(createdAt: string | Date) {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t < NEW_WINDOW_MS;
}

// 단어 카드의 카테고리 라벨. 단어 세트는 과목 카테고리가 의미 없으므로(예: 영단어가
// 생활과윤리로 배정돼 있음) 제목 내용으로 라벨을 정한다.
function vocabEyebrow(title: string): string {
  return /영(어|단어)|english/i.test(title) ? "영단어" : "단어";
}

// 문제집(책) 표지 스타일 퀴즈 카드: 흰 표지 + 카테고리(연회색)·제목(네이비) +
// 하단 그라데이션 띠 + 월계관 엠블럼. NEW·인기·완료 뱃지와 진척도 바 포함.
function QuizBookCard({
  eyebrow, title, isNew, isPopular, isDone, progressPct, answerRate, locked, onClick,
}: {
  eyebrow: string;
  title: string;
  isNew?: boolean;
  isPopular?: boolean;
  isDone?: boolean;
  progressPct?: number | null;
  answerRate?: number | null;
  locked?: boolean;
  onClick: () => void;
}) {
  // 우측 상단 배지 줄(완료 아이콘 + NEW)이 차지하는 폭. 카테고리 라벨이 그 아래로 깔려
  // 가려지지 않도록, 같은 폭만큼 라벨 오른쪽 여백을 비워 둔다(넘치면 말줄임).
  const badgeWidths: string[] = [];
  if (isDone) badgeWidths.push("clamp(15px, 16cqw, 22px)");
  if (isNew) badgeWidths.push("calc(clamp(8px, 7cqw, 11px) * 2 + 16px)");
  const eyebrowPaddingRight = badgeWidths.length
    ? `calc(${badgeWidths.join(" + ")} + ${3 * (badgeWidths.length - 1) + 4}px)`
    : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover-lift"
      style={{ textAlign: "left", background: "none", border: "none", padding: 0, display: "block", width: "100%" }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "114 / 161",
          borderRadius: 14,
          background: "var(--c-bg)",
          border: "1px solid var(--c-bg-muted-4)",
          boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
          overflow: "hidden",
          containerType: "inline-size",
        }}
      >
        {locked && (
          <span aria-label="프리미엄 전용" style={{ position: "absolute", top: 7, left: 7, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(17,24,39,0.72)", color: "#fff", borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 700 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 10V8a5 5 0 0110 0v2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              <rect x="5" y="10" width="14" height="9" rx="2.5" fill="#fff" />
            </svg>
            프리미엄
          </span>
        )}
        {/* 카테고리 + 제목 */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "9% 8% 0" }}>
          <p
            style={{
              margin: 0,
              paddingRight: eyebrowPaddingRight,
              fontSize: "clamp(10px, 9.3cqw, 14px)",
              fontWeight: 500,
              color: "var(--c-text-4)",
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {eyebrow}
          </p>
          <p
            style={{
              margin: "3% 0 0",
              fontSize: "clamp(14px, 13cqw, 21px)",
              fontWeight: 700,
              color: "var(--c-text-2)",
              lineHeight: 1.18,
              letterSpacing: "-0.4px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </p>
        </div>

        {/* 하단 그라데이션 띠 + 월계관 (인기 문제집은 금색) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "26.7%",
            background: isPopular
              ? "linear-gradient(256deg, #F7EAC6 0%, #FFFDF6 50%, #EAD7A0 100%)"
              : "linear-gradient(256deg, var(--c-bg-muted-6) 0%, var(--c-bg) 50%, var(--c-bg-muted-21) 100%)",
          }}
        >
          <img
            src={isPopular ? "/icons/book-laurel-gold.svg" : "/icons/book-laurel.svg"}
            alt=""
            style={{ position: "absolute", left: "6%", top: "50%", transform: "translateY(-50%)", width: "31%", display: "block" }}
          />
        </div>

        {/* 완료 + NEW 뱃지 (우측 상단, 한 줄로 나란히 → 서로 겹치지 않음) */}
        {(isNew || isDone) && (
          <div
            style={{
              position: "absolute",
              top: "6%",
              right: "6%",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {/* 이미 다 푼 퀴즈 표시 */}
            {isDone && (
              <img
                src="/icons/quiz-clear.svg"
                alt="완료"
                style={{ width: "clamp(15px, 16cqw, 22px)", height: "auto", display: "block" }}
              />
            )}
            {isNew && (
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "var(--c-danger-e)",
                  color: "#fff",
                  fontSize: "clamp(8px, 7cqw, 11px)",
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                NEW
              </span>
            )}
          </div>
        )}

        {/* 인기 뱃지 — 반짝이는 황금 도토리 + "인기" (우측 하단, NEW와 안 겹치게) */}
        {isPopular && (
          <div
            style={{
              position: "absolute",
              right: "6%",
              bottom: "9%",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <img
              src="/icons/popular-acorn.svg"
              alt=""
              style={{ width: "clamp(13px, 15cqw, 22px)", height: "auto", display: "block" }}
            />
            <span style={{ fontSize: "clamp(8px, 7cqw, 11px)", fontWeight: 700, color: "var(--c-warn-e)", letterSpacing: "-0.2px" }}>
              인기
            </span>
          </div>
        )}

        {/* 진척도 게이지 (내가 푼 만큼, 카드 하단) */}
        {progressPct != null && progressPct > 0 && (
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "var(--c-bg-muted-4)" }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, progressPct)}%`,
                background: "linear-gradient(90deg, var(--c-brand) 0%, var(--c-brand-deep-7) 100%)",
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}
      </div>
      {/* 카드 아래 정답률 (사용자 응답 집계) */}
      {answerRate != null && (
        <p style={{ margin: "6px 2px 0", fontSize: 12, fontWeight: 600, color: "var(--c-text-4)", letterSpacing: "-0.2px" }}>
          정답률 <span style={{ color: "var(--c-brand)", fontWeight: 700 }}>{answerRate}%</span>
        </p>
      )}
    </button>
  );
}

interface HomeBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  bgColor: string;
  bannerType: "slide" | "modal";
}

interface HomeClientProps {
  userName: string | null;
  isAdmin: boolean;
  categories: Category[];
  workbooks: Workbook[];
  oxQuizSets: OxQuizSet[];
  vocabQuizSets: VocabQuizSet[];
  mockExams: BrowserExam[];
  mockExamYears: number[];
  isPremiumUser: boolean;
}

type BannerItem = { title: string; image: string; bg: string; href: string };
/** 홈 바로가기 4장(2×2). 사장이 준 3D 그림 — 바탕은 그림 색을 아주 옅게 깐다. */
const BANNER_ITEMS: BannerItem[] = [
  {
    title: "매일매일\nOX 퀴즈",
    image: "/images/home/shortcut-ox.webp",
    bg: "#E9F1FF",
    href: "/ox-quiz-intro",
  },
  {
    title: "영단어\n퀴즈",
    image: "/images/home/shortcut-vocab.webp",
    bg: "#F1ECFF",
    href: "/vocab-quiz-intro",
  },
  {
    title: "기출\n모의고사",
    image: "/images/home/shortcut-mock.webp",
    bg: "#FFF1E3",
    href: "/mock-exam",
  },
  {
    title: "엘리트\n모의고사",
    image: "/images/home/shortcut-elite.webp",
    bg: "#ECF4E7",
    // 실제 문제집으로 보낸다(없으면 문제집 목록). id 를 박지 않고 데이터에서 찾는다.
    href: "",
  },
];

export default function HomeClient({
  userName,
  isAdmin,
  categories,
  workbooks,
  oxQuizSets,
  vocabQuizSets,
  mockExams,
  mockExamYears,
  isPremiumUser,
}: HomeClientProps) {
  const router = useRouter();
  // 프리티풀 퀵매칭 등장 — 홈에 들어올 때만(뒤로가기·30초 안 재진입은 생략)
  const enter = useEntrance("home");
  // 종 아이콘 빨간 점 — 안 읽은 알림이 있을 때만(로그인한 사용자만 묻는다)
  const [unreadNotif, setUnreadNotif] = useState(0);
  useEffect(() => {
    if (!userName) return;
    let alive = true;
    fetch("/api/notifications/unread", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && typeof d.unread === "number") setUnreadNotif(d.unread); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userName]);
  // '새로운 문제집' 말풍선 자리 계산용 — 바로가기 묶음(기준 칸)과 가리킬 '엘리트 모의고사' 카드.
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const eliteCardRef = useRef<HTMLButtonElement>(null);
  // 캐시 시드 → 탭 재진입 시 즉시 표시(데이터 변동 시에만 갱신).
  const [banners, setBanners] = useState<HomeBanner[]>(() => clientCache.get<HomeBanner[]>("home-banners") ?? []);
  const [popupBanner, setPopupBanner] = useState<HomeBanner | null>(null);
  const [quizSummary, setQuizSummary] = useState<QuizSummary>(() => clientCache.get<QuizSummary>("home-quizsummary") ?? EMPTY_QUIZ_SUMMARY);
  // 홈에서 앱 사용 3분 뒤 별점 팝업을 기기당 1회만 띄운다.
  useEffect(() => {
    return scheduleHomeRatingOnce();
  }, []);

  const openBanner = useCallback((linkUrl: string | null) => {
    if (!linkUrl) return;
    setPopupBanner(null);
    if (linkUrl.startsWith("http://") || linkUrl.startsWith("https://")) {
      window.location.href = linkUrl;
      return;
    }
    router.push(linkUrl);
  }, [router]);

  // 퀴즈(OX·영단어) 세트별 진척/완료. 카드에 얇은 막대 + 완료 뱃지로 표시.
  useEffect(() => {
    if (!userName) return;
    fetch("/api/quiz-summary", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || typeof data !== "object") return;
        const next: QuizSummary = {
          ox: data.ox && typeof data.ox === "object" ? data.ox : {},
          vocab: data.vocab && typeof data.vocab === "object" ? data.vocab : {},
        };
        if (clientCache.set("home-quizsummary", next)) setQuizSummary(next);
      })
      .catch(() => {});
  }, [userName]);

  useEffect(() => {
    fetch("/api/banners")
      .then((res) => res.json())
      .then((data) => {
        const nextBanners = (data.banners || []) as HomeBanner[];
        if (clientCache.set("home-banners", nextBanners)) setBanners(nextBanners);
        // 첫 진입 모달 배너 자동 노출(관리자가 추가한 "진입 모달 배너"). "3일동안 안보기"로
        // 닫은 배너는 기간 동안 다시 띄우지 않는다.
        const modal = nextBanners.find((b) => b.bannerType === "modal");
        if (modal) {
          let hidden = false;
          try {
            const until = Number(localStorage.getItem(`home_popup_hidden_until_${modal.id}`));
            hidden = Number.isFinite(until) && until > Date.now();
          } catch {
            // localStorage 차단 환경(일부 WebView)에서는 그냥 노출.
          }
          if (!hidden) setPopupBanner(modal);
        }
      })
      .catch(() => setBanners([]));
  }, []);

  const closePopup = useCallback(() => {
    setPopupBanner(null);
  }, []);

  const hidePopupForThreeDays = useCallback(() => {
    if (!popupBanner) return;
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(`home_popup_hidden_until_${popupBanner.id}`, String(Date.now() + threeDays));
    } catch {
      // localStorage may be blocked in some WebView modes; closing still works for the current view.
    }
    setPopupBanner(null);
  }, [popupBanner]);

  const slideBanners = banners.filter((banner) => banner.bannerType !== "modal");

  // "새로운 퀴즈": 최근 등록된 OX·단어 세트(등록 최신순, 최대 6개).
  // 7일 안에 올라온 문제집이 있는 과목 — 홈 과목 버튼 위 말풍선용.
  // 여러 과목에 걸쳐 있으면 가장 최근 것 하나만 알린다(말풍선이 겹치지 않게).
  // '엘리트 모의고사' 바로가기가 갈 곳 — id 를 박지 않고 제목으로 찾는다(없으면 문제집 목록).
  const eliteWorkbook = workbooks.find((w) => w.title.includes("엘리트")) ?? workbooks[0];
  const eliteHref = eliteWorkbook ? `/workbook/${eliteWorkbook.id}` : "/category";
  const freshWorkbook = workbooks
    .filter((w) => isNewCreatedAt(w.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const newQuizzes = [
    ...oxQuizSets.filter((q) => isNewCreatedAt(q.createdAt)).map((q) => ({ key: `ox:${q.id}`, type: "ox" as const, id: q.id, title: q.title, totalQuestions: q.totalQuestions, isPopular: q.isPopular, createdAt: q.createdAt, answerRate: q.answerRate ?? null, isPremium: q.isPremium ?? false })),
    ...vocabQuizSets.filter((q) => isNewCreatedAt(q.createdAt)).map((q) => ({ key: `vocab:${q.id}`, type: "vocab" as const, id: q.id, title: q.title, totalQuestions: q.totalQuestions, isPopular: q.isPopular, createdAt: q.createdAt, answerRate: null, isPremium: false })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // 카드 상단 카테고리 라벨. OX는 "카테고리명+OX"(예: 생활과윤리OX), 단어는 내용 기반 라벨.
  function quizEyebrow(type: "ox" | "vocab", id: string): string {
    if (type === "vocab") {
      const title = vocabQuizSets.find((s) => s.id === id)?.title ?? "";
      return vocabEyebrow(title);
    }
    const name = oxQuizSets.find((s) => s.id === id)?.category?.name;
    return name ? `${name}OX` : "OX";
  }

  // 세트별 내 기록. 기록이 없는 세트는 키 자체가 없다(= 미시작).
  function quizStat(type: "ox" | "vocab", id: string): QuizSummaryEntry | undefined {
    return (type === "ox" ? quizSummary.ox : quizSummary.vocab)?.[id];
  }

  // 진척도(%) — 답한 문항 수 / 총 문항. 분모는 서버 실집계(total) 우선, 없으면 세트의 totalQuestions.
  // 완료 여부로 막대를 100%까지 채우지 않는다(세트에 문항이 추가되면 미완료분이 감춰진다).
  // 완료는 배지(isDone)라는 별도 축으로 그린다.
  function quizProgressPct(type: "ox" | "vocab", id: string, fallbackTotal: number): number | null {
    const stat = quizStat(type, id);
    if (!stat) return null;
    const total = stat.total || fallbackTotal;
    if (!total) return null;
    const answered = stat.answered ?? 0;
    if (!answered) return null;
    return Math.min(100, Math.round((answered / total) * 100));
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "var(--c-bg)", overflowX: "clip" }}>
      {/* 첫 진입 평생 1회 온보딩 설문 */}
      <SurveyGate />
      {/* 진입 시 첫 공지 팝업(7일동안 안보기 / 닫기) */}
      <NoticePopup />
      {/* 앱 첫 진입 배너 — 2초마다 넘어가는 슬라이드(X = 3일 동안 안 보기) */}
      <IntroBannerCarousel
        storageKey="app_intro_v2_hidden_until"
        slides={[
          { image: "/banners/obsidian-rank.jpg", alt: "옵시디언 랭킹 3위 이내 달성 시 스타디 프라임 일주일 무료" },
          { image: "/banners/community-answer-king.jpg", alt: "답변왕에게 스타디 프라임 7일 제공" },
        ]}
      />
      {/* Header — 프리티풀 홈 머리줄: 로고 · 검색 · 구독. 인사말 대신 로고, 비로그인이면 로그인 버튼 */}
      <div className="home-head" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "calc(14px + env(safe-area-inset-top, 0px)) 14px 10px" }}>
        <Link href="/" aria-label="스타디 홈" className={enter ? "qd-a-title" : undefined} style={{ display: "inline-flex", alignItems: "center" }}>
          <StadyLogo height={30} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="press"
              aria-label="관리자 페이지로 이동"
              style={{
                height: 36,
                padding: "0 11px",
                borderRadius: 18,
                border: "1px solid var(--c-brand-line-3)",
                background: "var(--c-brand-soft-3)",
                color: "var(--c-brand-deep)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3L19 6V11C19 15.4 16.2 19.2 12 21C7.8 19.2 5 15.4 5 11V6L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M9 12L11 14L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              관리자
            </button>
          )}
          {!userName && (
            <button type="button" onClick={() => router.push("/login")} className="press home-login-btn">
              로그인
            </button>
          )}
          {/* 종·돋보기 — 프리티풀 홈 머리줄 아이콘(44pt 칸 둘을 붙여 시안 간격 그대로) */}
          <div style={{ display: "flex", alignItems: "center", marginRight: -6 }}>
            <button type="button" onClick={() => router.push("/notifications")} className="press home-search-btn" aria-label={unreadNotif > 0 ? `알림 ${unreadNotif}개` : "알림"}>
              <HeaderBellIcon dot={unreadNotif > 0} />
            </button>
            <button type="button" onClick={() => router.push("/search")} className="press home-search-btn" aria-label="검색">
              <HeaderSearchIcon />
            </button>
          </div>
        </div>
      </div>

      {/* 스타디 프라임 구독 — 헤더가 아니라 네비 위 플로팅(홈에서만, 미구독자에게만) */}
      {!isPremiumUser && <PrimeFab onClick={() => router.push("/subscribe")} />}

      {/* 첫 진입 시 안 본 새 공지 카드 */}
      <NoticeHomeCard />

      {/* 태블릿: 좌측 세로 숏컷(스티키) + 우측 스크롤 콘텐츠 2단 레이아웃 */}
      <div className="home-body">
      {/* Shortcut Cards (태블릿=좌측 스티키 컬럼) */}
      <div className="home-side">
      <div ref={shortcutsRef} className={`home-shortcuts${enter ? " qd-a-item" : ""}`} style={{ position: "relative", padding: "0 10px 20px", animationDelay: "0.12s" }}>
        {freshWorkbook && (
          <NewWorkbookBubble
            containerRef={shortcutsRef}
            anchorRef={eliteCardRef}
            href={eliteHref}
            subtitle={`${freshWorkbook.category?.name ?? ""} · ${freshWorkbook.title}`}
          />
        )}
        <div className="home-shortcuts-row">
          {BANNER_ITEMS.map((item) => {
            const href = item.href || eliteHref;
            return (
              <button
                key={item.title}
                ref={item.href === "" ? eliteCardRef : undefined}
                type="button"
                onClick={() => router.push(href)}
                className="press-deep home-shortcut-card"
                style={{ backgroundColor: item.bg }}
              >
                <p className="home-shortcut-title">{item.title}</p>
                {/* 그림은 칸을 넘칠 만큼 크게 깔고 오른쪽 아래에 붙인다(바탕이 비치는 3D 컷) */}
                <Image
                  src={item.image}
                  alt=""
                  width={1536}
                  height={1024}
                  unoptimized
                  className="home-shortcut-art"
                />
              </button>
            );
          })}
        </div>
      </div>
      </div>{/* /home-side */}

      <div className="home-main">


      {/* 데일리 퀴즈 (카테고리 아이콘 아래) */}
      <div className={enter ? "qd-a-item" : undefined} style={{ padding: "0 10px 20px", animationDelay: "0.22s" }}>
        <DailyQuizCard />
      </div>

      {/* Slide Banner */}
      {slideBanners.length > 0 && (
        <div
          className={enter ? "qd-a-item" : undefined}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            padding: "0 10px 20px",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "x mandatory",
          }}
        >
          <div style={{ display: "flex", gap: 10, width: "max-content" }}>
            {slideBanners.map((banner) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => openBanner(banner.linkUrl)}
                className="press-deep"
                style={{
                  position: "relative",
                  width: "calc(100vw - 20px)",
                  maxWidth: 480,
                  aspectRatio: "2/1",
                  border: "none",
                  borderRadius: 14,
                  overflow: "hidden",
                  flexShrink: 0,
                  textAlign: "left",
                  background: banner.bgColor || "var(--c-brand)",
                  scrollSnapAlign: "center",
                  cursor: banner.linkUrl ? "pointer" : "default",
                }}
              >
                {banner.imageUrl && (
                  <img src={banner.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {!banner.imageUrl && <div style={{ position: "absolute", inset: 0, background: banner.bgColor || "var(--c-brand)" }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 8, backgroundColor: "var(--c-bg-soft)" }} />

      {popupBanner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "max(14px, env(safe-area-inset-top, 0px)) 14px max(14px, env(safe-area-inset-bottom, 0px))",
            boxSizing: "border-box",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.48)" }} onClick={closePopup} />
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 420,
              maxHeight: "calc(100dvh - 28px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              borderRadius: 18,
              overflow: "hidden",
              background: "var(--c-bg)",
              boxShadow: "0 20px 60px rgba(15,23,42,0.24)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              type="button"
              onClick={closePopup}
              aria-label="닫기"
              style={{ position: "absolute", top: 10, right: 10, zIndex: 3, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.52)", color: "#fff", fontSize: 20, lineHeight: "32px" }}
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => openBanner(popupBanner.linkUrl)}
              style={{
                position: "relative",
                width: "100%",
                flex: "1 1 auto",
                minHeight: 0,
                border: "none",
                background: popupBanner.bgColor || "var(--c-brand)",
                textAlign: "left",
                overflow: "hidden",
                padding: 0,
              }}
            >
              {popupBanner.imageUrl ? (
                <img
                  src={popupBanner.imageUrl}
                  alt={popupBanner.title}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: "calc(100dvh - 96px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                    objectFit: "contain",
                    background: popupBanner.bgColor || "var(--c-bg)",
                  }}
                />
              ) : (
                <div style={{ position: "relative", width: "100%", aspectRatio: "2/1" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,0,0,0.1), rgba(255,255,255,0.08))" }} />
                  <div style={{ position: "absolute", left: 22, right: 54, bottom: 20 }}>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.22, whiteSpace: "pre-line" }}>{popupBanner.title}</p>
                    {popupBanner.subtitle && (
                      <p style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,0.88)", fontWeight: 700 }}>{popupBanner.subtitle}</p>
                    )}
                  </div>
                </div>
              )}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid var(--c-bg-muted-9)", flex: "0 0 auto" }}>
              <button type="button" onClick={hidePopupForThreeDays} style={{ height: 48, border: "none", background: "var(--c-bg-soft)", color: "var(--c-text-3)", fontSize: 14, fontWeight: 700 }}>
                3일동안 안보기
              </button>
              <button type="button" onClick={closePopup} style={{ height: 48, border: "none", background: "var(--c-bg)", color: "var(--c-text)", fontSize: 14, fontWeight: 700 }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={enter ? "qd-a-item" : undefined} style={{ padding: "20px 10px", display: "flex", flexDirection: "column", gap: 28, animationDelay: "0.32s" }}>
        {newQuizzes.length > 0 && (
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: "var(--c-text-c)", marginBottom: 16 }}>
              새로운 퀴즈
            </h2>
            <div className="home-quiz-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {newQuizzes.map((q) => (
                <QuizBookCard
                  key={q.key}
                  eyebrow={quizEyebrow(q.type, q.id)}
                  title={q.title}
                  isNew
                  isPopular={q.isPopular}
                  isDone={quizStat(q.type, q.id)?.completed === true}
                  progressPct={quizProgressPct(q.type, q.id, q.totalQuestions)}
                  answerRate={q.answerRate}
                  locked={q.isPremium && !isPremiumUser}
                  onClick={() =>
                    q.isPremium && !isPremiumUser
                      ? router.push("/subscribe")
                      : router.push(q.type === "ox" ? `/ox-quiz/${q.id}` : `/vocab-quiz/${q.id}`)
                  }
                />
              ))}
            </div>
          </section>
        )}
        {SHOW_STORE_SECTION && (
        <section>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: "var(--c-text-c)", marginBottom: 16 }}>
            스타디 교재
          </h2>
          <button
            type="button"
            onClick={() => router.push("/store/korean-history")}
            className="press-deep"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
              padding: 12,
              borderRadius: 16,
              border: "1px solid var(--c-bg-muted-6)",
              background: "var(--c-bg)",
              textAlign: "left",
              boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
            }}
          >
            <div style={{
              flexShrink: 0,
              width: 64,
              height: 84,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3787FF, #1E5FD8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, letterSpacing: 0.5 }}>STADY</span>
              <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>2026<br />한국사</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-c)", margin: 0 }}>2026 한국사</p>
              <p style={{ fontSize: 12, color: "var(--c-text-4c)", margin: "3px 0 0", fontWeight: 600 }}>한국사 문제집 · PDF 다운로드</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-brand)", margin: "8px 0 0" }}>3,900원</p>
            </div>
            <span style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 999,
              background: "var(--c-brand)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
            }}>구매</span>
          </button>
        </section>
        )}

        {/* 모의고사 — 목록 화면(/mock-exam)과 같은 분류 탭(시행 연도/월/과목) + 같은 카드.
            두 화면이 갈라지지 않도록 컴포넌트를 그대로 재사용한다(embedded 로 페이지 여백만 끈다). */}
        {mockExams.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: "var(--c-text-c)", margin: 0 }}>모의고사</h2>
              <Link href="/mock-exam" style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, color: "var(--c-text-4)", textDecoration: "none" }}>
                전체보기 ›
              </Link>
            </div>
            <MockExamBrowser exams={mockExams} years={mockExamYears} embedded limit={6} isPremiumUser={isPremiumUser} />
          </section>
        )}
      </div>
      </div>{/* /home-main */}
      </div>{/* /home-body */}

      {/* Footer */}
      <div style={{ marginTop: 32, padding: "24px 16px 16px", borderTop: "1px solid var(--c-bg-muted)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginBottom: 16 }}>
          <Link href="/mypage/terms/privacy" style={{ fontSize: 12, color: "var(--c-text-4c)", textDecoration: "none" }}>개인정보처리방침</Link>
          <Link href="/mypage/terms/service" style={{ fontSize: 12, color: "var(--c-text-4c)", textDecoration: "none" }}>서비스 이용약관</Link>
          <Link href="/mypage/terms/third-party" style={{ fontSize: 12, color: "var(--c-text-4c)", textDecoration: "none" }}>제3자 제공 동의</Link>
          <Link href="/withdraw" style={{ fontSize: 12, color: "var(--c-text-5d)", textDecoration: "none" }}>회원탈퇴</Link>
        </div>
        <div style={{ fontSize: 11, color: "var(--c-text-5d)", lineHeight: 1.6 }}>
          <p>스타디 | 대표자 김지승</p>
          <p>사업자 등록 번호 852-06-03583</p>
          <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
          <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
          <p style={{ marginTop: 8 }}>Copyright&copy; stady. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
