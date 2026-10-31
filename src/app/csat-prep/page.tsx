"use client";

// 수능대비자료(2026-10-29, 구 홈 바로가기 '엘리트 모의고사') — 프리미엄 구독자 전용 파이널 자료.
//  · 엘리트 모의고사(문제집) 카드 + OX 묶음 카드(생윤 '사상가별 파이널 선지'·윤사 '사상가별 고난도 선지') → 누르면 단원별 OX 세트(소분류=사상가).
//  · 모양은 OX 인트로와 같은 유리 카드(oxiTheme). 잠금이면 결제 화면, 아니면 로그인 확인 후 풀이 화면.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OXI_THEME_CSS } from "@/components/oxiTheme";

interface CsatSet {
  id: string;
  /** 묶음(OxSetCollection.collection) */
  group: string;
  title: string;
  totalQuestions: number;
  sections: string[];
  isPremium: boolean;
}
interface CsatElite {
  id: string;
  title: string;
  subject: string | null;
  totalQuestions: number;
  isPremium: boolean;
}
interface QuizSummaryEntry { answered: number; total: number; completed: boolean; bestPct: number | null }

interface CsatGroup { collection: string; title: string; subject: string }
// API 가 묶음 목록을 안 주던 때 대비 기본값
const DEFAULT_GROUPS: CsatGroup[] = [{ collection: "csat-final", title: "사상가별 파이널 선지", subject: "생활과 윤리" }];

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7 10V8a5 5 0 0110 0v2" stroke="var(--oxi-sub)" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="9" rx="2.5" fill="var(--oxi-sub)" />
    </svg>
  );
}

function PremiumBadge() {
  return (
    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--oxi-prem-fg)", background: "var(--oxi-prem-bg)", border: "1px solid var(--oxi-prem-bd)", borderRadius: 999, padding: "2px 7px" }}>
      프리미엄
    </span>
  );
}

export default function CsatPrepPage() {
  const router = useRouter();
  const [elite, setElite] = useState<CsatElite | null>(null);
  const [sets, setSets] = useState<CsatSet[]>([]);
  const [summary, setSummary] = useState<Record<string, QuizSummaryEntry>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CsatGroup[]>(DEFAULT_GROUPS);
  // 열어 둔 묶음(collection). null 이면 첫 화면(카드 목록).
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((res) => res.ok).catch(() => false),
      fetch("/api/csat-prep").then((res) => res.json()).catch(() => ({})),
      fetch("/api/quiz-summary", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => (data?.ox ?? {}) as Record<string, QuizSummaryEntry>)
        .catch(() => ({} as Record<string, QuizSummaryEntry>)),
      fetch("/api/iap/status", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => !!data?.entitlement?.active)
        .catch(() => false),
    ]).then(([loggedIn, data, oxSummary, premium]) => {
      setIsLoggedIn(loggedIn);
      setElite(data?.elite ?? null);
      setSets(data?.sets ?? []);
      if (Array.isArray(data?.groups) && data.groups.length) setGroups(data.groups);
      setSummary(oxSummary);
      setIsPremiumUser(premium);
      setLoading(false);
    });
  }, []);

  function go(locked: boolean, href: string) {
    if (!isLoggedIn) { router.push("/login"); return; }
    router.push(locked ? "/subscribe" : href);
  }

  if (loading) {
    return (
      <div className="oxi-bg" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <style>{OXI_THEME_CSS}</style>
      </div>
    );
  }

  const setsOf = (collection: string) => sets.filter((s) => (s.group ?? DEFAULT_GROUPS[0].collection) === collection);
  const openSets = openGroup ? setsOf(openGroup) : [];
  const openMeta = groups.find((g) => g.collection === openGroup);
  const eliteLocked = !!elite?.isPremium && !isPremiumUser;

  return (
    <div className="oxi-bg" style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => (openGroup ? setOpenGroup(null) : router.back())}
        className="press"
        aria-label="뒤로"
        style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top, 0px))", left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--oxi-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/home/shortcut-elite.webp" alt="" width={132} height={132} style={{ display: "block", marginBottom: 24, animation: "quizItemFadeUp 0.6s" }} />
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--oxi-ink)", textAlign: "center", marginBottom: 12 }}>
          수능대비자료
        </h1>
        <p style={{ fontSize: 15, color: "var(--oxi-ink-soft)", textAlign: "center", lineHeight: 1.5 }}>
          프리미엄 구독자 전용 파이널 자료예요.
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        <div style={{ maxHeight: 392, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, margin: "-32px -32px 0", padding: "32px 32px 24px" }} className="quiz-list-scroll">
          {!openGroup && (
            <>
              {elite && (
                <button
                  type="button"
                  onClick={() => go(eliteLocked, `/workbook/${elite.id}`)}
                  className="press oxi-card"
                  style={{ width: "100%", padding: "20px 18px", borderRadius: 18, textAlign: "center", flexShrink: 0, animation: "quizItemFadeUp 0.5s" }}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 17, fontWeight: 700 }}>
                    {eliteLocked && <LockIcon />}
                    <span>{elite.title}</span>
                    {eliteLocked && <PremiumBadge />}
                  </span>
                  <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--oxi-sub)" }}>
                    {elite.subject ? `${elite.subject} · ` : ""}{elite.totalQuestions}문항 실전 모의고사
                  </span>
                </button>
              )}
              {groups.map((g) => {
                const gs = setsOf(g.collection);
                if (gs.length === 0) return null;
                const total = gs.reduce((sum, s) => sum + (summary[s.id]?.total || s.totalQuestions), 0);
                const done = gs.filter((s) => summary[s.id]?.completed).length;
                return (
                  <button
                    key={g.collection}
                    type="button"
                    onClick={() => setOpenGroup(g.collection)}
                    className={`press oxi-card${done === gs.length ? " is-done" : ""}`}
                    style={{ width: "100%", padding: "20px 18px", borderRadius: 18, textAlign: "center", flexShrink: 0, animation: "quizItemFadeUp 0.5s" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 17, fontWeight: 700 }}>
                      {!isPremiumUser && <LockIcon />}
                      <span>{g.title}</span>
                      {!isPremiumUser && <PremiumBadge />}
                    </span>
                    <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--oxi-sub)" }}>
                      {g.subject} OX · {gs.length}개 단원 · {total}문항
                      {done > 0 && <span style={{ color: "var(--oxi-accent)" }}>{` · ${done}/${gs.length} 단원 완료`}</span>}
                    </span>
                  </button>
                );
              })}
              {!elite && sets.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--oxi-sub)", fontSize: 14 }}>준비 중인 자료예요.</p>
              )}
            </>
          )}

          {openGroup && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--oxi-ink-soft)", margin: "4px 4px 8px", letterSpacing: 0.2 }}>
                {openMeta ? `${openMeta.title} · ${openMeta.subject}` : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {openSets.map((s) => {
                  const stat = summary[s.id];
                  const denom = stat && stat.total > 0 ? stat.total : s.totalQuestions;
                  const answered = stat?.answered ?? 0;
                  const completed = stat?.completed ?? false;
                  const inProgress = !completed && answered > 0;
                  const progressPct = denom > 0 ? Math.min(100, Math.round((answered / denom) * 100)) : 0;
                  const locked = s.isPremium && !isPremiumUser;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => go(locked, `/ox-quiz/${s.id}`)}
                      className={`press oxi-card${completed ? " is-done" : ""}`}
                      style={{ position: "relative", overflow: "hidden", width: "100%", padding: "16px 18px", borderRadius: 18, textAlign: "center", flexShrink: 0, animation: "quizItemFadeUp 0.5s" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 15, fontWeight: 700 }}>
                        {locked && <LockIcon />}
                        <span>{s.title}</span>
                        {locked && <PremiumBadge />}
                        {completed && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/icons/quiz-clear.svg" alt="" width={16} height={16} style={{ display: "block" }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--oxi-accent)" }}>완료</span>
                          </span>
                        )}
                      </span>
                      <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 600, color: "var(--oxi-sub)" }}>
                        사상가 {s.sections.length}명 · {denom}문항
                        {completed && stat?.bestPct != null && <span style={{ color: "var(--oxi-accent)", fontWeight: 700 }}>{` · 최고 ${stat.bestPct}%`}</span>}
                        {inProgress && <span style={{ color: "var(--oxi-accent)", fontWeight: 700 }}>{` · ${answered}/${denom} 진행 중`}</span>}
                      </span>
                      {s.sections.length > 0 && (
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
                          {s.sections.map((section) => (
                            <span key={section} style={{ padding: "4px 8px", borderRadius: 999, backgroundColor: "var(--oxi-chip-bg)", border: "1px solid var(--oxi-chip-bd)", color: "var(--oxi-accent)", fontSize: 11, fontWeight: 700 }}>
                              {section}
                            </span>
                          ))}
                        </span>
                      )}
                      {inProgress && (
                        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, display: "block", backgroundColor: "var(--oxi-track)" }}>
                          <span style={{ display: "block", height: "100%", width: `${progressPct}%`, background: "var(--oxi-bar)" }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="oxi-fade" aria-hidden="true" />
      </div>

      <style>{OXI_THEME_CSS}</style>
    </div>
  );
}
