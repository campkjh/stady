"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import SurveyGate from "@/components/SurveyGate";
import NoticeHomeCard from "@/components/NoticeHomeCard";
import DailyQuizCard from "@/components/DailyQuizCard";
import { scheduleHomeRatingOnce } from "@/lib/appReview";
import { clientCache } from "@/lib/clientCache";

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
// 하단 그라데이션 띠 + 월계관 엠블럼. NEW·인기 뱃지와 진척도 바 포함.
function QuizBookCard({
  eyebrow, title, isNew, isPopular, progressPct, onClick,
}: {
  eyebrow: string;
  title: string;
  isNew?: boolean;
  isPopular?: boolean;
  progressPct?: number | null;
  onClick: () => void;
}) {
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
          background: "#fff",
          border: "1px solid #F1F3F5",
          boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
          overflow: "hidden",
          containerType: "inline-size",
        }}
      >
        {/* 카테고리 + 제목 */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "9% 8% 0" }}>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(10px, 9.3cqw, 14px)",
              fontWeight: 500,
              color: "#8A909C",
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
              color: "#2B313D",
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
              : "linear-gradient(256deg, #EEF1F3 0%, #ffffff 50%, #DBDFE1 100%)",
          }}
        >
          <img
            src={isPopular ? "/icons/book-laurel-gold.svg" : "/icons/book-laurel.svg"}
            alt=""
            style={{ position: "absolute", left: "6%", top: "50%", transform: "translateY(-50%)", width: "31%", display: "block" }}
          />
        </div>

        {/* NEW 뱃지 (우측 상단) */}
        {isNew && (
          <span
            style={{
              position: "absolute",
              top: "6%",
              right: "6%",
              padding: "2px 7px",
              borderRadius: 6,
              background: "#FF3B30",
              color: "#fff",
              fontSize: "clamp(8px, 7cqw, 11px)",
              fontWeight: 800,
              letterSpacing: 0.3,
            }}
          >
            NEW
          </span>
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
            <span style={{ fontSize: "clamp(8px, 7cqw, 11px)", fontWeight: 800, color: "#E59500", letterSpacing: "-0.2px" }}>
              인기
            </span>
          </div>
        )}

        {/* 진척도 게이지 (내가 푼 만큼, 카드 하단) */}
        {progressPct != null && progressPct > 0 && (
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(43,49,61,0.07)" }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, progressPct)}%`,
                background: "linear-gradient(90deg, #7DC4FF, #3787FF)",
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}
      </div>
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
  isNewUser: boolean;
}

const BANNER_ITEMS = [
  {
    title: "매일매일\nOX 퀴즈",
    icon: "/icons/banner-ox.svg",
    bg: "#3787FF",
    href: "/ox-quiz-intro",
  },
  {
    title: "영단어\n퀴즈",
    icon: "/icons/banner-vocab.svg",
    bg: "#A58CFF",
    href: "/vocab-quiz-intro",
  },
  {
    title: "새로운\n공지사항",
    icon: "/icons/banner-notice.svg",
    bg: "#5AD39F",
    href: "/notice",
  },
  {
    title: "스타디\n자주묻는 질문",
    icon: "/icons/banner-faq.svg",
    bg: "#FF9CB2",
    href: "/faq",
  },
];

interface RecentQuiz {
  key: string;
  type: "ox" | "vocab";
  id: string;
  title: string;
}

export default function HomeClient({
  userName,
  isAdmin,
  categories,
  oxQuizSets,
  vocabQuizSets,
  isNewUser,
}: HomeClientProps) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(isNewUser);
  // 캐시 시드 → 탭 재진입 시 즉시 표시(데이터 변동 시에만 갱신).
  const [banners, setBanners] = useState<HomeBanner[]>(() => clientCache.get<HomeBanner[]>("home-banners") ?? []);
  const [popupBanner, setPopupBanner] = useState<HomeBanner | null>(null);
  const [recentQuizzes, setRecentQuizzes] = useState<RecentQuiz[]>(() => clientCache.get<RecentQuiz[]>("home-recent") ?? []);
  const [oxProgress, setOxProgress] = useState<Record<string, number>>(() => clientCache.get<Record<string, number>>("home-oxprogress") ?? {});
  const welcomeVisible = showWelcome && Boolean(userName);

  const handleWelcomeComplete = useCallback(() => {
    setShowWelcome(false);
    document.cookie = "isNewUser=; path=/; max-age=0";
    // 리뷰 프롬프트는 더 이상 온보딩 직후 띄우지 않는다. 퀴즈를 3개 이상 풀었을 때
    // 계정당 1회만 띄우도록 서버 게이트(/api/app-review)로 일원화했다.
  }, []);

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

  // 최근에 푼 OX·단어 퀴즈 (세트별 가장 최근 1개씩, 최대 6개).
  useEffect(() => {
    if (!userName) return;
    fetch("/api/attempts", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const attempts = data?.attempts;
        if (!Array.isArray(attempts)) return;
        const seen = new Set<string>();
        const recent: RecentQuiz[] = [];
        for (const a of attempts) {
          if (a.oxQuizSet) {
            const k = `ox:${a.oxQuizSet.id}`;
            if (!seen.has(k)) { seen.add(k); recent.push({ key: k, type: "ox", id: a.oxQuizSet.id, title: a.oxQuizSet.title }); }
          } else if (a.vocabQuizSet) {
            const k = `vocab:${a.vocabQuizSet.id}`;
            if (!seen.has(k)) { seen.add(k); recent.push({ key: k, type: "vocab", id: a.vocabQuizSet.id, title: a.vocabQuizSet.title }); }
          }
          if (recent.length >= 6) break;
        }
        if (clientCache.set("home-recent", recent)) setRecentQuizzes(recent);
      })
      .catch(() => {});
  }, [userName]);

  // OX 퀴즈별 진척도(내가 답한 문항 수). 카드에 얇은 막대로 표시.
  useEffect(() => {
    if (!userName) return;
    fetch("/api/ox-progress", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.progress && typeof data.progress === "object") {
          if (clientCache.set("home-oxprogress", data.progress)) setOxProgress(data.progress);
        }
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
  const newQuizzes = [
    ...oxQuizSets.filter((q) => isNewCreatedAt(q.createdAt)).map((q) => ({ key: `ox:${q.id}`, type: "ox" as const, id: q.id, title: q.title, totalQuestions: q.totalQuestions, isPopular: q.isPopular, createdAt: q.createdAt })),
    ...vocabQuizSets.filter((q) => isNewCreatedAt(q.createdAt)).map((q) => ({ key: `vocab:${q.id}`, type: "vocab" as const, id: q.id, title: q.title, totalQuestions: q.totalQuestions, isPopular: q.isPopular, createdAt: q.createdAt })),
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

  // OX 세트의 진척도(%) — 답한 문항 수 / 총 문항. 기록 없으면 null.
  function oxProgressPct(id: string): number | null {
    const answered = oxProgress[id];
    if (answered == null) return null;
    const total = oxQuizSets.find((o) => o.id === id)?.totalQuestions;
    if (!total) return null;
    return Math.min(100, Math.round((answered / total) * 100));
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff", overflow: "hidden" }}>
      {welcomeVisible && userName && (
        <WelcomeOverlay nickname={userName} onComplete={handleWelcomeComplete} />
      )}
      {/* 첫 진입 평생 1회 온보딩 설문 */}
      <SurveyGate />
      {/* Header */}
      <div className="fade-in-up" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "20px 10px 12px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {userName ? `${userName}님 안녕하세요!` : "로그인이 필요합니다."}
        </h1>
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
                border: "1px solid #D6E4FF",
                background: "#EEF5FF",
                color: "#1F5EDC",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3L19 6V11C19 15.4 16.2 19.2 12 21C7.8 19.2 5 15.4 5 11V6L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M9 12L11 14L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              관리자
            </button>
          )}
          <button type="button" onClick={() => router.push("/search")} className="search-btn" aria-label="검색">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      {/* 첫 진입 시 안 본 새 공지 카드 */}
      <NoticeHomeCard />

      {/* Shortcut Cards */}
      <div
        className="fade-in-up fade-in-up-1 home-shortcuts"
        style={{ overflowX: "auto", overflowY: "hidden", padding: "0 10px 20px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="home-shortcuts-row" style={{ display: "flex", gap: 12, width: "max-content" }}>
          {BANNER_ITEMS.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => router.push(item.href)}
              className="press-deep home-shortcut-card"
              style={{
                position: "relative",
                width: 140,
                height: 140,
                backgroundColor: item.bg,
                borderRadius: 24,
                border: "none",
                textAlign: "left",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <Image
                src={item.icon}
                alt=""
                width={80}
                height={53}
                unoptimized
                style={{ position: "absolute", top: 16, left: 12 }}
              />
              <div style={{ position: "absolute", bottom: 12, left: 12 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", whiteSpace: "pre-line", lineHeight: 1.3 }}>
                  {item.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Category Grid */}
      <div className="fade-in-up fade-in-up-2" style={{ padding: "0 10px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => router.push(`/category?id=${cat.id}`)}
                className="cat-btn"
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                }}
              >
                {cat.isPopular && (
                  <span style={{
                    position: "absolute", top: -4, right: 0, zIndex: 1,
                    padding: "1px 6px", borderRadius: 20,
                    backgroundColor: "#FF3B5C", color: "#fff",
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                    lineHeight: "16px",
                  }}>인기</span>
                )}
                <div className="cat-circle" style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  backgroundColor: "#F2F2F6",
                  border: "1px solid #F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {cat.icon.startsWith("/") ? (
                    <Image src={cat.icon} alt={cat.name} width={38} height={38} unoptimized style={{ width: 38, height: 38, objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                  {cat.name}
                </span>
              </button>
          ))}
        </div>
      </div>

      {/* 데일리 퀴즈 (카테고리 아이콘 아래) */}
      <div className="fade-in-up fade-in-up-2" style={{ padding: "0 10px 20px" }}>
        <DailyQuizCard />
      </div>

      {/* Slide Banner */}
      {slideBanners.length > 0 && (
        <div
          className="fade-in-up fade-in-up-3"
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
                  background: banner.bgColor || "#3787FF",
                  scrollSnapAlign: "center",
                  cursor: banner.linkUrl ? "pointer" : "default",
                }}
              >
                {banner.imageUrl && (
                  <img src={banner.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {!banner.imageUrl && <div style={{ position: "absolute", inset: 0, background: banner.bgColor || "#3787FF" }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 8, backgroundColor: "#F9FAFB" }} />

      {popupBanner && !welcomeVisible && (
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
              background: "#fff",
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
                background: popupBanner.bgColor || "#3787FF",
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
                    background: popupBanner.bgColor || "#fff",
                  }}
                />
              ) : (
                <div style={{ position: "relative", width: "100%", aspectRatio: "2/1" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,0,0,0.1), rgba(255,255,255,0.08))" }} />
                  <div style={{ position: "absolute", left: 22, right: 54, bottom: 20 }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.22, whiteSpace: "pre-line" }}>{popupBanner.title}</p>
                    {popupBanner.subtitle && (
                      <p style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,0.88)", fontWeight: 700 }}>{popupBanner.subtitle}</p>
                    )}
                  </div>
                </div>
              )}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #EEF2F7", flex: "0 0 auto" }}>
              <button type="button" onClick={hidePopupForThreeDays} style={{ height: 48, border: "none", background: "#F9FAFB", color: "#6B7280", fontSize: 14, fontWeight: 800 }}>
                3일동안 안보기
              </button>
              <button type="button" onClick={closePopup} style={{ height: 48, border: "none", background: "#fff", color: "#111827", fontSize: 14, fontWeight: 900 }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="fade-in-up fade-in-up-4" style={{ padding: "20px 10px", display: "flex", flexDirection: "column", gap: 24 }}>
        {recentQuizzes.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              최근에 푼 퀴즈
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {recentQuizzes.map((q) => (
                <QuizBookCard
                  key={q.key}
                  eyebrow={quizEyebrow(q.type, q.id)}
                  title={q.title}
                  progressPct={q.type === "ox" ? oxProgressPct(q.id) : null}
                  onClick={() => router.push(q.type === "ox" ? `/ox-quiz/${q.id}` : `/vocab-quiz/${q.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {newQuizzes.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              새로운 퀴즈
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {newQuizzes.map((q) => (
                <QuizBookCard
                  key={q.key}
                  eyebrow={quizEyebrow(q.type, q.id)}
                  title={q.title}
                  isNew
                  isPopular={q.isPopular}
                  progressPct={q.type === "ox" ? oxProgressPct(q.id) : null}
                  onClick={() => router.push(q.type === "ox" ? `/ox-quiz/${q.id}` : `/vocab-quiz/${q.id}`)}
                />
              ))}
            </div>
          </section>
        )}
        {SHOW_STORE_SECTION && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
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
              border: "1px solid #EEF0F3",
              background: "#fff",
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
              <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.85, letterSpacing: 0.5 }}>STADY</span>
              <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.1, textAlign: "center" }}>2026<br />한국사</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#111", margin: 0 }}>2026 한국사</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "3px 0 0", fontWeight: 600 }}>한국사 문제집 · PDF 다운로드</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: "#3787FF", margin: "8px 0 0" }}>3,900원</p>
            </div>
            <span style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 999,
              background: "#3787FF",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
            }}>구매</span>
          </button>
        </section>
        )}

        {userName && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              준비중
            </h2>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
              <Image src="/icons/under-construction.svg" alt="" width={52} height={52} unoptimized style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: "#9CA3AF" }}>문제집은 현재 준비중입니다.</p>
            </div>
          </section>
        )}

        {oxQuizSets.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              OX 퀴즈
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {oxQuizSets.map((ox) => (
                <QuizBookCard
                  key={ox.id}
                  eyebrow={`${ox.category.name}OX`}
                  title={ox.title}
                  isPopular={ox.isPopular}
                  progressPct={oxProgressPct(ox.id)}
                  onClick={() => router.push(`/ox-quiz/${ox.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {vocabQuizSets.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              단어 퀴즈
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {vocabQuizSets.map((vq) => (
                <QuizBookCard
                  key={vq.id}
                  eyebrow={vocabEyebrow(vq.title)}
                  title={vq.title}
                  isPopular={vq.isPopular}
                  onClick={() => router.push(`/vocab-quiz/${vq.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, padding: "24px 16px 16px", borderTop: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginBottom: 16 }}>
          <Link href="/mypage/terms/privacy" style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "none" }}>개인정보처리방침</Link>
          <Link href="/mypage/terms/service" style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "none" }}>서비스 이용약관</Link>
          <Link href="/mypage/terms/third-party" style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "none" }}>제3자 제공 동의</Link>
          <Link href="/withdraw" style={{ fontSize: 12, color: "#D1D5DB", textDecoration: "none" }}>회원탈퇴</Link>
        </div>
        <div style={{ fontSize: 11, color: "#D1D5DB", lineHeight: 1.6 }}>
          <p>헬스스헬 | 대표자 김지승</p>
          <p>사업자 등록 번호 852-06-03583</p>
          <p>경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
          <p>T 010-4726-9276 | E tlsdml0507@naver.com</p>
          <p style={{ marginTop: 8 }}>Copyright&copy; stady. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
