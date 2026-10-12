"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDailyQuizMessage } from "@/lib/daily-quiz-message";
import OxHeroScene from "@/components/OxHeroScene";

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
  category?: { id: string; name: string } | null;
  questions?: { section: string | null }[];
  isPremium?: boolean; // 생윤·윤사 앞 5개 이후 = 프리미엄 잠금
}

interface QuizSummaryEntry {
  answered: number;
  total: number;
  completed: boolean;
  bestPct: number | null;
}

type QuizSummaryMap = Record<string, QuizSummaryEntry>;

export default function OxQuizListPage() {
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<OxQuizSet[]>([]);
  const [summary, setSummary] = useState<QuizSummaryMap>({});
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const dailyMessage = getDailyQuizMessage("ox");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" })
        .then((res) => res.ok)
        .catch(() => false),
      fetch("/api/ox-quiz")
        .then((res) => res.json())
        .then((data) => data.oxQuizSets ?? [])
        .catch(() => []),
      // 진행 상태 요약. 실패해도 목록은 그대로 뜨도록 항상 빈 객체로 폴백한다.
      fetch("/api/quiz-summary", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => (data?.ox ?? {}) as QuizSummaryMap)
        .catch(() => ({} as QuizSummaryMap)),
      // 프리미엄 구독 여부 — 잠금 배지/이동 분기용
      fetch("/api/iap/status", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => !!data?.entitlement?.active)
        .catch(() => false),
    ]).then(([loggedIn, sets, oxSummary, premium]) => {
      setIsLoggedIn(loggedIn);
      setQuizSets(sets);
      setSummary(oxSummary);
      setIsPremiumUser(premium);
      setLoading(false);
    });
  }, []);

  function requireLoginThen(action: () => void) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    action();
  }

  // 세트 열기 — 프리미엄 잠금이면 결제 화면으로, 아니면 로그인 확인 후 풀이 화면으로.
  function openSet(qs: OxQuizSet) {
    if (qs.isPremium && !isPremiumUser) {
      requireLoginThen(() => router.push("/subscribe"));
      return;
    }
    requireLoginThen(() => router.push(`/ox-quiz/${qs.id}`));
  }

  if (loading) {
    return (
      <div className="oxi-bg" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const groups = quizSets.reduce<{ name: string; items: OxQuizSet[] }[]>((acc, qs) => {
    const name = qs.category?.name ? `${qs.category.name} OX 퀴즈` : "OX 퀴즈";
    const group = acc.find((item) => item.name === name);
    if (group) group.items.push(qs);
    else acc.push({ name, items: [qs] });
    return acc;
  }, []);
  const selectedGroup = groups.find((group) => group.name === selectedGroupName) ?? null;

  // 세트의 문항 수. 요약의 라이브 COUNT 가 있으면 그것을, 없으면 비정규화 컬럼으로 폴백한다.
  // (OxQuizSet.totalQuestions 는 어드민 입력값이라 실제 문항 수와 어긋날 수 있다.)
  // 그룹 합계와 세트 카드가 반드시 같은 값을 쓰도록 한 곳에 모아둔다.
  function denomOf(qs: OxQuizSet): number {
    const stat = summary[qs.id];
    return stat && stat.total > 0 ? stat.total : qs.totalQuestions;
  }


  return (
    <div className="oxi-bg" style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => selectedGroup ? setSelectedGroupName(null) : router.back()}
        className="press"
        style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top, 0px))", left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--oxi-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        {/* 머리 그림 — 펼친 책 위로 O·X 판이 떠오른다(OxHeroScene) */}
        <div style={{ marginBottom: 28 }}>
          <OxHeroScene />
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--oxi-ink)", textAlign: "center", marginBottom: 12 }}>
          하루에 한 번 OX퀴즈
        </h1>
        <p style={{ fontSize: 15, color: "var(--oxi-ink-soft)", textAlign: "center" }}>
          {isLoggedIn ? dailyMessage : "로그인하고 오늘의 퀴즈를 열어보세요."}
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        {/* 스크롤 칸(overflow)은 안쪽 그림자를 가장자리에서 잘라낸다 — 카드 그림자(blur 28)만큼
            위·좌우에 여백을 주고 같은 만큼 음수 마진으로 되돌려 카드 자리는 그대로 둔다. */}
        <div style={{ maxHeight: 392, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, margin: "-32px -32px 0", padding: "32px 32px 24px" }} className="quiz-list-scroll">
          {!selectedGroup && groups.map((group, index) => {
            // 그룹 합계도 세트 카드와 **같은 분모 규칙**을 써야 한다.
            // 여기만 비정규화 totalQuestions 를 쓰면, 실제 문항이 30개인데 컬럼이 25인 세트에서
            // 그룹은 "25문항", 들어가서 보는 카드는 "30문항" 으로 같은 세트가 다르게 보인다.
            const totalQuestions = group.items.reduce((sum, item) => sum + denomOf(item), 0);
            const doneCount = group.items.filter((item) => summary[item.id]?.completed).length;
            const allDone = group.items.length > 0 && doneCount === group.items.length;
            return (
              <button
                key={group.name}
                type="button"
                onClick={() => requireLoginThen(() => setSelectedGroupName(group.name))}
                className={`press oxi-card${allDone ? " is-done" : ""}`}
                style={{
                  width: "100%", padding: "20px 18px", borderRadius: 18,
                  textAlign: "center", flexShrink: 0,
                  animation: "quizItemFadeUp 0.5s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 17, fontWeight: 900 }}>
                  <span>{group.name}</span>
                  {allDone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <img src="/icons/quiz-allclear.svg" alt="" width={18} height={18} style={{ display: "block" }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--oxi-accent)" }}>전체 완료</span>
                    </span>
                  )}
                </span>
                <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--oxi-sub)" }}>
                  {group.items.length}개 중분류 · {totalQuestions}문항
                  {doneCount > 0 && (
                    <span style={{ color: "var(--c-brand)", fontWeight: 800 }}>
                      {` · ${doneCount}/${group.items.length} 단원 완료`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {selectedGroup && (
            <div>
              <p style={{
                fontSize: 13, fontWeight: 700, color: "var(--oxi-ink-soft)",
                margin: "4px 4px 8px", letterSpacing: 0.2,
              }}>
                {selectedGroup.name}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {selectedGroup.items.map((qs, index) => {
                  // 소분류가 세트 제목과 같으면(단원 단위로 분리된 세트) 중복 태그이므로 숨긴다.
                  const sections = (
                    Array.from(new Set((qs.questions ?? []).map((q) => q.section).filter(Boolean))) as string[]
                  ).filter((s) => s.trim() !== qs.title.trim());
                  const stat = summary[qs.id];
                  const denom = denomOf(qs);
                  const answered = stat?.answered ?? 0;
                  const completed = stat?.completed ?? false;
                  const inProgress = !completed && answered > 0;
                  const progressPct = denom > 0 ? Math.min(100, Math.round((answered / denom) * 100)) : 0;
                  const locked = !!qs.isPremium && !isPremiumUser;
                  return (
                    <button
                      key={qs.id}
                      type="button"
                      onClick={() => openSet(qs)}
                      className={`press oxi-card${completed ? " is-done" : ""}`}
                      style={{
                        position: "relative", overflow: "hidden",
                        width: "100%", padding: "16px 18px", borderRadius: 18,
                        textAlign: "left", flexShrink: 0,
                        animation: "quizItemFadeUp 0.5s",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 15, fontWeight: 800, textAlign: "center", opacity: locked ? 0.85 : 1 }}>
                        {locked && (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                            <path d="M7 10V8a5 5 0 0110 0v2" stroke="var(--oxi-sub)" strokeWidth="2" strokeLinecap="round" />
                            <rect x="5" y="10" width="14" height="9" rx="2.5" fill="var(--oxi-sub)" />
                          </svg>
                        )}
                        <span>{qs.title}</span>
                        {locked && (
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "var(--oxi-prem-fg)", background: "var(--oxi-prem-bg)", border: "1px solid var(--oxi-prem-bd)", borderRadius: 999, padding: "2px 7px" }}>프리미엄</span>
                        )}
                        {completed && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            <img src="/icons/quiz-clear.svg" alt="" width={16} height={16} style={{ display: "block" }} />
                            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--oxi-accent)" }}>완료</span>
                          </span>
                        )}
                      </span>
                      <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 600, color: "var(--oxi-sub)", textAlign: "center" }}>
                        {sections.length > 0 ? `${sections.length}개 소분류 · ` : ""}{denom}문항
                        {completed && stat?.bestPct != null && (
                          <span style={{ color: "var(--oxi-accent)", fontWeight: 800 }}>{` · 최고 ${stat.bestPct}%`}</span>
                        )}
                        {inProgress && (
                          <span style={{ color: "var(--oxi-accent)", fontWeight: 800 }}>{` · ${answered}/${denom} 진행 중`}</span>
                        )}
                      </span>
                      {sections.length > 0 && (
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
                          {sections.slice(0, 4).map((section) => (
                            <span
                              key={section}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                // 완료 카드는 배경이 이미 brand-soft-2 라 칩이 묻힌다 → 카드 면색으로 뒤집는다.
                                backgroundColor: "var(--oxi-chip-bg)",
                                border: "1px solid var(--oxi-chip-bd)",
                                color: "var(--oxi-accent)",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {section}
                            </span>
                          ))}
                          {sections.length > 4 && (
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              // 넘침 칩도 일반 칩과 같은 completed 분기 → 완료 카드에서 배경에 묻히지 않는다.
                              backgroundColor: "var(--oxi-chip2-bg)",
                              color: "var(--oxi-chip2-fg)",
                              fontSize: 11,
                              fontWeight: 700,
                            }}>
                              +{sections.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                      {inProgress && (
                        <span style={{
                          position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                          display: "block", backgroundColor: "var(--oxi-track)",
                        }}>
                          <span style={{
                            display: "block", height: "100%", width: `${progressPct}%`,
                            background: "var(--oxi-bar)",
                          }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--oxi-sub)", fontSize: 14 }}>등록된 OX 퀴즈가 없습니다.</p>
          )}
        </div>
        <div className="oxi-fade" aria-hidden="true" />
      </div>

      <style>{`
        /* 인트로 전용 색 한 벌. 카드가 유리라 테마 토큰(흰 면/검은 글씨)으로는 안 맞아
           이 화면에서만 쓰는 값을 따로 둔다. 기본=라이트, [data-theme="dark"] 에서 갈아끼운다.
           --oxi-paint 는 배경 그림 자체 — 아래쪽 페이드가 **같은 그림**을 쓰려고 변수로 뺐다
           (단색으로 덮으면 배경이 그라데이션이라 끝에 띠가 생긴다). */
        :root {
          --oxi-paint:
            radial-gradient(60% 42% at 24% 16%, rgba(90, 160, 255, 0.30) 0%, rgba(90, 160, 255, 0) 70%),
            radial-gradient(56% 40% at 78% 20%, rgba(255, 122, 122, 0.22) 0%, rgba(255, 122, 122, 0) 70%),
            radial-gradient(92% 58% at 50% 108%, rgba(176, 206, 245, 0.60) 0%, rgba(246, 249, 255, 0) 70%),
            linear-gradient(168deg, #F7FAFF 0%, #E9F1FB 46%, #F8FAFE 100%);
          --oxi-ink: #15233A;
          --oxi-ink-soft: rgba(21, 35, 58, 0.72);
          --oxi-sub: rgba(21, 35, 58, 0.56);
          --oxi-accent: #2A6FE0;
          --oxi-card-bg: rgba(255, 255, 255, 0.66);
          --oxi-card-bd: rgba(16, 38, 72, 0.10);
          --oxi-card-sh: 0 10px 28px rgba(26, 52, 94, 0.12);
          --oxi-done-bg: rgba(58, 126, 230, 0.13);
          --oxi-done-bd: rgba(58, 126, 230, 0.36);
          --oxi-chip-bg: rgba(42, 111, 224, 0.12);
          --oxi-chip-bd: rgba(42, 111, 224, 0.22);
          --oxi-chip2-bg: rgba(16, 38, 72, 0.07);
          --oxi-chip2-fg: rgba(21, 35, 58, 0.55);
          --oxi-track: rgba(16, 38, 72, 0.12);
          --oxi-prem-fg: #A9790B;
          --oxi-prem-bg: rgba(255, 196, 80, 0.20);
          --oxi-prem-bd: rgba(255, 196, 80, 0.48);
          --oxi-bar: linear-gradient(90deg, #5A9BFF 0%, #2A6FE0 100%);
        }
        [data-theme="dark"] {
          --oxi-paint:
            radial-gradient(60% 42% at 24% 16%, rgba(66, 146, 255, 0.30) 0%, rgba(66, 146, 255, 0) 70%),
            radial-gradient(56% 40% at 78% 20%, rgba(255, 86, 86, 0.22) 0%, rgba(255, 86, 86, 0) 70%),
            radial-gradient(90% 60% at 50% 108%, rgba(24, 68, 110, 0.55) 0%, rgba(10, 20, 32, 0) 70%),
            linear-gradient(168deg, #0C1A2B 0%, #12293C 46%, #0A1420 100%);
          --oxi-ink: #EEF4FB;
          --oxi-ink-soft: rgba(255, 255, 255, 0.92);
          --oxi-sub: rgba(255, 255, 255, 0.62);
          --oxi-accent: #8FC0FF;
          --oxi-card-bg: rgba(255, 255, 255, 0.07);
          --oxi-card-bd: rgba(255, 255, 255, 0.13);
          --oxi-card-sh: 0 10px 30px rgba(0, 0, 0, 0.34);
          --oxi-done-bg: rgba(104, 172, 255, 0.16);
          --oxi-done-bd: rgba(150, 198, 255, 0.46);
          --oxi-chip-bg: rgba(143, 192, 255, 0.16);
          --oxi-chip-bd: rgba(143, 192, 255, 0.28);
          --oxi-chip2-bg: rgba(255, 255, 255, 0.10);
          --oxi-chip2-fg: rgba(255, 255, 255, 0.66);
          --oxi-track: rgba(255, 255, 255, 0.14);
          --oxi-prem-fg: #FFD88A;
          --oxi-prem-bg: rgba(255, 200, 90, 0.18);
          --oxi-prem-bd: rgba(255, 200, 90, 0.36);
          --oxi-bar: linear-gradient(90deg, #8FC0FF 0%, #4A86E8 100%);
        }
        .oxi-bg { background: var(--oxi-paint); }
        /* 목록 끝 페이드 — 배경과 **같은 그림**을 같은 자리에 그린 뒤 위쪽만 깎는다.
           단색으로 덮으면 배경이 그라데이션이라 경계에 띠가 보인다.
           (이 요소는 카드의 조상이 아니라서 mask 를 걸어도 카드 유리가 안 깨진다.) */
        .oxi-fade {
          position: absolute; left: 0; right: 0; bottom: 0; height: 88px; pointer-events: none;
          background: var(--oxi-paint);
          background-size: 100% 100vh;
          background-position: 50% 100%;
          -webkit-mask-image: linear-gradient(to top, #000 45%, transparent 100%);
          mask-image: linear-gradient(to top, #000 45%, transparent 100%);
        }
        /* 유리 카드 — 뒤 배경(번짐)이 비쳐 보이게 */
        .oxi-card {
          background: var(--oxi-card-bg);
          border: 1px solid var(--oxi-card-bd);
          box-shadow: var(--oxi-card-sh);
          -webkit-backdrop-filter: blur(16px) saturate(1.15);
          backdrop-filter: blur(16px) saturate(1.15);
          color: var(--oxi-ink);
        }
        .oxi-card.is-done {
          background: var(--oxi-done-bg);
          border-color: var(--oxi-done-bd);
        }
        @keyframes quizItemFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-list-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
