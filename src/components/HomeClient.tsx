"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import WelcomeOverlay from "@/components/WelcomeOverlay";

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
  category: Category;
}

interface VocabQuizSet {
  id: string;
  title: string;
  thumbnail: string | null;
  totalQuestions: number;
  isPopular: boolean;
  category: Category;
}

const GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-cyan-400 to-cyan-600",
];

function getGradient(index: number) {
  return GRADIENTS[index % GRADIENTS.length];
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

export default function HomeClient({
  userName,
  categories,
  workbooks,
  oxQuizSets,
  vocabQuizSets,
  isNewUser,
}: HomeClientProps) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(isNewUser);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [popupBanner, setPopupBanner] = useState<HomeBanner | null>(null);

  const handleWelcomeComplete = useCallback(() => {
    setShowWelcome(false);
    document.cookie = "isNewUser=; path=/; max-age=0";
  }, []);

  const openBanner = useCallback((linkUrl: string | null) => {
    if (!linkUrl) return;
    if (linkUrl.startsWith("http://") || linkUrl.startsWith("https://")) {
      window.location.href = linkUrl;
      return;
    }
    router.push(linkUrl);
  }, [router]);

  useEffect(() => {
    fetch("/api/banners")
      .then((res) => res.json())
      .then((data) => {
        const nextBanners = (data.banners || []) as HomeBanner[];
        setBanners(nextBanners);
        const modal = nextBanners.find((banner) => banner.bannerType === "modal");
        if (!modal) return;
        const hiddenUntil = Number(localStorage.getItem(`home_popup_hidden_until_${modal.id}`) || 0);
        if (Date.now() > hiddenUntil) setPopupBanner(modal);
      })
      .catch(() => setBanners([]));
  }, []);

  const hidePopupForThreeDays = useCallback(() => {
    if (!popupBanner) return;
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`home_popup_hidden_until_${popupBanner.id}`, String(Date.now() + threeDays));
    setPopupBanner(null);
  }, [popupBanner]);

  const slideBanners = banners.filter((banner) => banner.bannerType !== "modal");

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff", overflow: "hidden" }}>
      {showWelcome && userName && (
        <WelcomeOverlay nickname={userName} onComplete={handleWelcomeComplete} />
      )}
      {/* Header */}
      <div className="fade-in-up" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 10px 12px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>
          {userName ? `${userName}님 안녕하세요!` : "로그인이 필요합니다."}
        </h1>
        <button type="button" onClick={() => router.push("/search")} className="search-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* Shortcut Cards */}
      <div
        className="fade-in-up fade-in-up-1"
        style={{ overflowX: "auto", overflowY: "hidden", padding: "0 10px 20px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div style={{ display: "flex", gap: 12, width: "max-content" }}>
          {BANNER_ITEMS.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => router.push(item.href)}
              className="press-deep"
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
                  width: "100%",
                  aspectRatio: "1/1",
                  borderRadius: "50%",
                  backgroundColor: "#F2F2F6",
                  border: "1px solid #F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {cat.icon.startsWith("/") ? (
                    <Image src={cat.icon} alt={cat.name} width={48} height={48} unoptimized style={{ width: "64%", height: "64%", objectFit: "contain" }} />
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

      {popupBanner && !showWelcome && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.48)" }} onClick={() => setPopupBanner(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 420, borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 20px 60px rgba(15,23,42,0.24)" }}>
            <button
              type="button"
              onClick={() => setPopupBanner(null)}
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
                border: "none",
                background: popupBanner.bgColor || "#3787FF",
                textAlign: "left",
                overflow: "hidden",
                padding: 0,
              }}
            >
              {popupBanner.imageUrl ? (
                <img src={popupBanner.imageUrl} alt={popupBanner.title} style={{ display: "block", width: "100%", maxHeight: "78vh", objectFit: "contain", background: popupBanner.bgColor || "#fff" }} />
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #EEF2F7" }}>
              <button type="button" onClick={hidePopupForThreeDays} style={{ height: 48, border: "none", background: "#F9FAFB", color: "#6B7280", fontSize: 14, fontWeight: 800 }}>
                3일간 안보기
              </button>
              <button type="button" onClick={() => setPopupBanner(null)} style={{ height: 48, border: "none", background: "#fff", color: "#111827", fontSize: 14, fontWeight: 900 }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="fade-in-up fade-in-up-4" style={{ padding: "20px 10px", display: "flex", flexDirection: "column", gap: 24 }}>
        {userName && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              내가 풀고 있는 문제집
            </h2>
            {workbooks.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
                <Image src="/icons/emoji-empty.svg" alt="" width={52} height={52} unoptimized style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: "#9CA3AF" }}>지금 풀고 계신 문제집이 없습니다</p>
              </div>
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {workbooks.map((wb, i) => (
                <button
                  key={wb.id}
                  type="button"
                  onClick={() => router.push(`/workbook/${wb.id}`)}
                  className="hover-lift"
                  style={{ textAlign: "left", background: "none", border: "none" }}
                >
                  <div style={{
                    position: "relative",
                    aspectRatio: "3/4",
                    borderRadius: 8,
                    overflow: "hidden",
                    backgroundColor: "#3787FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {wb.thumbnail ? (
                      <Image src={wb.thumbnail} alt="" fill sizes="33vw" style={{ objectFit: "cover" }} unoptimized />
                    ) : (
                      <Image src="/icons/book-cover.svg" alt="" width={60} height={80} unoptimized style={{ width: "60%", height: "auto", opacity: 0.8 }} />
                    )}
                    {wb.isPopular && (
                      <span style={{
                        position: "absolute", top: 6, right: 6, padding: "2px 8px",
                        borderRadius: 20, backgroundColor: "#FF3B5C", color: "#fff",
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      }}>인기</span>
                    )}
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {wb.title}
                    </p>
                    <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                      {wb.totalQuestions}문항/{wb.questionPerPage}문항
                    </p>
                  </div>
                </button>
              ))}
            </div>
            )}
          </section>
        )}

        {oxQuizSets.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              OX 퀴즈
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {oxQuizSets.map((ox, i) => (
                <button
                  key={ox.id}
                  type="button"
                  onClick={() => router.push(`/ox-quiz/${ox.id}`)}
                  className="hover-lift"
                  style={{ textAlign: "left", background: "none", border: "none" }}
                >
                  <div
                    className={`flex items-center justify-center bg-gradient-to-br ${getGradient(i + 3)}`}
                    style={{ position: "relative", aspectRatio: "1/1", borderRadius: 12 }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>OX</span>
                    {ox.isPopular && (
                      <span style={{
                        position: "absolute", top: 6, right: 6, padding: "2px 8px",
                        borderRadius: 20, backgroundColor: "#FF3B5C", color: "#fff",
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      }}>인기</span>
                    )}
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ox.title}
                    </p>
                    <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                      {ox.totalQuestions}문항
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {vocabQuizSets.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
              단어 퀴즈
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {vocabQuizSets.map((vq, i) => (
                <button
                  key={vq.id}
                  type="button"
                  onClick={() => router.push(`/vocab-quiz/${vq.id}`)}
                  className="hover-lift"
                  style={{ textAlign: "left", background: "none", border: "none" }}
                >
                  <div
                    className={`flex items-center justify-center bg-gradient-to-br ${getGradient(i + 5)}`}
                    style={{ position: "relative", aspectRatio: "1/1", borderRadius: 12 }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>Aa</span>
                    {vq.isPopular && (
                      <span style={{
                        position: "absolute", top: 6, right: 6, padding: "2px 8px",
                        borderRadius: 20, backgroundColor: "#FF3B5C", color: "#fff",
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      }}>인기</span>
                    )}
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {vq.title}
                    </p>
                    <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                      {vq.totalQuestions}문항
                    </p>
                  </div>
                </button>
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
