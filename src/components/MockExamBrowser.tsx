"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SUBJECT_GROUPS, EXAM_MONTHS, findSubject } from "@/lib/examSubjects";

export interface BrowserExam {
  id: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  pageCount: number;
  solutionCount: number;
  year: number | null;
  month: number | null;
  subject: string | null;
  /** 문항별 풀이(모바일)가 준비된 시험지면 카드에 "문제 풀기"가 붙는다. */
  hasQuestions?: boolean;
}

const ALL = "all";

// 좌측(모바일은 상단) 메뉴 항목. 시행 연도/월 + 과목 대분류 7개.
// 아이콘은 공용 mono 세트에서 가져온 mxi-*.svg(활성은 -on 접미사로 진한 버전).
const SECTIONS = [
  { key: "year", label: "시행 연도", icon: "mxi-year" },
  { key: "month", label: "시행 월", icon: "mxi-month" },
  ...SUBJECT_GROUPS.map((g) => ({ key: g.key, label: g.label, icon: g.icon })),
];

export default function MockExamBrowser({
  exams,
  years,
  // 홈 섹션 안에 넣을 때. 레일의 sticky/블러와 페이지 여백을 끄고, 좁은 우측 컬럼에 맞게
  // 태블릿에서도 "레일이 위에 붙는" 한 단 레이아웃을 유지한다.
  embedded = false,
}: {
  exams: BrowserExam[];
  years: number[];
  embedded?: boolean;
}) {
  const [year, setYear] = useState<number | typeof ALL>(ALL);
  const [month, setMonth] = useState<number | typeof ALL>(ALL);
  const [subject, setSubject] = useState<string>(ALL);
  // 펼쳐진 메뉴 섹션. null이면 접힌 상태(첨부 이미지처럼 아이콘만 보임).
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      exams.filter(
        (e) =>
          (year === ALL || e.year === year) &&
          (month === ALL || e.month === month) &&
          (subject === ALL || e.subject === subject)
      ),
    [exams, year, month, subject]
  );

  const subjectHit = findSubject(subject === ALL ? null : subject);
  const activeCount = (year !== ALL ? 1 : 0) + (month !== ALL ? 1 : 0) + (subject !== ALL ? 1 : 0);

  function isActive(key: string) {
    if (key === "year") return year !== ALL;
    if (key === "month") return month !== ALL;
    return subjectHit?.group.key === key;
  }

  // 접혀 있어도 뭘 골랐는지 보이도록 항목 아래에 선택값을 적는다.
  function pickedLabel(key: string): string | null {
    if (key === "year") return year !== ALL ? `${year}` : null;
    if (key === "month") return month !== ALL ? `${month}월` : null;
    return subjectHit?.group.key === key ? subjectHit.subject.label : null;
  }

  function reset() {
    setYear(ALL);
    setMonth(ALL);
    setSubject(ALL);
    setOpen(null);
  }

  const openGroup = SUBJECT_GROUPS.find((g) => g.key === open);

  return (
    <div className={`mx-shell${embedded ? " is-embedded" : ""}`}>
      {/* ───── 메뉴: 태블릿은 좌측 레일, 모바일은 상단 바 ───── */}
      <nav className="mx-rail" aria-label="모의고사 분류">
        {SECTIONS.map((s) => {
          const on = isActive(s.key);
          const expanded = open === s.key;
          const picked = pickedLabel(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`mx-rail-item${on ? " is-on" : ""}${expanded ? " is-open" : ""}`}
              onClick={() => setOpen((cur) => (cur === s.key ? null : s.key))}
              aria-expanded={expanded}
            >
              <span className="mx-rail-ico">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/${s.icon}${on || expanded ? "-on" : ""}.svg`} alt="" width={24} height={24} />
              </span>
              <span className="mx-rail-label">{s.label}</span>
              {picked && <span className="mx-rail-picked">{picked}</span>}
            </button>
          );
        })}
        {activeCount > 0 && (
          <button type="button" className="mx-rail-reset" onClick={reset}>초기화</button>
        )}
      </nav>

      {/* ───── 펼침 패널: 태블릿은 레일 오른쪽, 모바일은 바 아래로 ───── */}
      {open && (
        <div className="mx-panel">
          <div className="mx-panel-head">
            {SECTIONS.find((s) => s.key === open)?.label}
            <button type="button" className="mx-panel-close" onClick={() => setOpen(null)} aria-label="닫기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-4b)" strokeWidth="2.6" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mx-panel-body">
            {open === "year" && (
              <>
                <PanelChip active={year === ALL} onClick={() => setYear(ALL)}>전체</PanelChip>
                {years.map((y) => (
                  <PanelChip key={y} active={year === y} onClick={() => setYear(y)}>{y}</PanelChip>
                ))}
              </>
            )}
            {open === "month" && (
              <>
                <PanelChip active={month === ALL} onClick={() => setMonth(ALL)}>전체</PanelChip>
                {EXAM_MONTHS.map((m) => (
                  <PanelChip key={m} active={month === m} onClick={() => setMonth(m)}>{m}월</PanelChip>
                ))}
              </>
            )}
            {openGroup && (
              <>
                <PanelChip active={subject === ALL} onClick={() => setSubject(ALL)}>전체</PanelChip>
                {openGroup.subjects.map((s) => (
                  <PanelChip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>{s.label}</PanelChip>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ───── 결과 ───── */}
      <div className="mx-main">
        <div className="mx-result-head">
          <span className="mx-count">모의고사 <b>{filtered.length}</b>개</span>
          {activeCount > 0 && <button type="button" className="mx-reset-wide" onClick={reset}>필터 초기화</button>}
        </div>

        {filtered.length === 0 ? (
          <p className="mx-empty">{exams.length === 0 ? "등록된 모의고사가 없습니다." : "조건에 맞는 모의고사가 없어요."}</p>
        ) : (
          <div className="mx-grid">
            {filtered.map((ex) => {
              const hit = findSubject(ex.subject);
              return (
                // 카드 전체(→ 필기 뷰어)와 "문제 풀기"(→ 문항 풀이)는 형제 링크로 둔다.
                // 링크 안에 링크를 넣으면 안 되기 때문.
                <div key={ex.id} className="mx-item-wrap">
                  <Link href={`/mock-exam/${ex.id}`} className="hover-lift mx-item">
                    <div className="mx-thumb">
                      {ex.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ex.coverUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="mx-thumb-empty">📄</span>
                      )}
                      {ex.solutionCount > 0 && <span className="mx-badge">해설</span>}
                    </div>
                    <p className="mx-title">{ex.title}</p>
                    <p className="mx-sub">
                      {hit ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/icons/${hit.group.icon}.svg`} alt="" width={13} height={13} />
                          {hit.subject.label}
                        </>
                      ) : (
                        ex.subtitle || `${ex.pageCount}페이지`
                      )}
                    </p>
                  </Link>
                  {ex.hasQuestions && (
                    <Link href={`/mock-exam/${ex.id}/solve`} className="mx-solve">
                      문제 풀기
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BrowserStyles />
    </div>
  );
}

function PanelChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`mx-pchip${active ? " is-on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function BrowserStyles() {
  return (
    <style>{`
      /* ── 기본(모바일): 메뉴가 헤더 아래 가로로 붙고, 누르면 아래로 펼쳐진다 ── */
      .mx-shell { padding-bottom: 40px; }
      .mx-rail {
        position: sticky; top: 0; z-index: 20;
        display: flex; align-items: flex-start; gap: 2px;
        padding: 8px 10px; overflow-x: auto; scrollbar-width: none;
        background: var(--c-bg-a95);
        backdrop-filter: saturate(180%) blur(10px);
        -webkit-backdrop-filter: saturate(180%) blur(10px);
        border-bottom: 1px solid var(--c-bg-muted-2);
      }
      .mx-rail-item {
        flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 3px;
        width: 64px; padding: 4px 2px 6px; border: none; background: none; cursor: pointer;
        font-family: inherit; -webkit-tap-highlight-color: transparent;
      }
      .mx-rail-ico {
        display: grid; place-items: center; width: 40px; height: 40px; border-radius: 13px;
        transition: background .16s ease, transform .16s ease;
      }
      .mx-rail-item.is-on .mx-rail-ico, .mx-rail-item.is-open .mx-rail-ico { background: var(--c-bg-muted-2); }
      .mx-rail-item:active .mx-rail-ico { transform: scale(0.94); }
      .mx-rail-label {
        font-size: 11px; font-weight: 700; color: var(--c-text-5); letter-spacing: -0.3px;
        white-space: nowrap; transition: color .16s ease;
      }
      .mx-rail-item.is-on .mx-rail-label, .mx-rail-item.is-open .mx-rail-label { color: var(--c-text-2b); }
      .mx-rail-picked {
        font-size: 10px; font-weight: 800; color: var(--c-brand); max-width: 62px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .mx-rail-reset {
        flex: 0 0 auto; align-self: center; border: none; background: none; color: var(--c-text-4b);
        font-size: 12px; font-weight: 700; padding: 6px 8px; cursor: pointer; font-family: inherit;
      }

      .mx-panel {
        border-bottom: 1px solid var(--c-bg-muted-2); background: var(--c-bg-soft-9); overflow: hidden;
        animation: mxPanelDown .22s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .mx-panel-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px 2px; font-size: 13px; font-weight: 800; color: var(--c-text-2b);
      }
      .mx-panel-close { border: none; background: none; padding: 4px; cursor: pointer; line-height: 0; }
      .mx-panel-body { display: flex; flex-wrap: wrap; gap: 7px; padding: 10px 16px 14px; }
      .mx-pchip {
        padding: 8px 13px; border-radius: 999px; border: 1px solid var(--c-bg-muted-16); background: var(--c-bg);
        font-size: 13.5px; font-weight: 700; color: var(--c-text-3b); cursor: pointer; font-family: inherit;
        white-space: nowrap; transition: border-color .15s ease, background .15s ease, color .15s ease;
      }
      .mx-pchip.is-on { border-color: var(--c-brand); background: var(--c-brand-soft-7); color: var(--c-brand-deep); }
      @keyframes mxPanelDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
      @media (prefers-reduced-motion: reduce) { .mx-panel { animation: none } }

      /* ── 결과 ── */
      .mx-result-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 8px; }
      .mx-count { font-size: 13px; color: var(--c-text-4b); font-weight: 600; }
      .mx-count b { color: var(--c-text-b); font-weight: 800; }
      .mx-reset-wide { display: none; }
      .mx-empty { padding: 48px 20px; text-align: center; color: var(--c-text-4c); font-size: 14px; margin: 0; }
      .mx-grid { padding: 4px 16px 40px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
      .mx-item-wrap { position: relative; }
      .mx-item { text-decoration: none; display: block; }
      /* 썸네일 위에 얹는 "문제 풀기" — 카드 링크와 겹치지 않게 형제로 두고 위에 띄운다. */
      .mx-solve {
        position: absolute; right: 7px; top: 7px; z-index: 2;
        padding: 5px 10px; border-radius: 999px; text-decoration: none;
        background: var(--c-brand); color: #fff; font-size: 11px; font-weight: 800;
        box-shadow: 0 2px 8px rgba(55,135,255,0.35);
      }
      .mx-solve:active { transform: scale(0.94); }
      .mx-thumb {
        position: relative; aspect-ratio: 3 / 4; border-radius: 14px; overflow: hidden;
        border: 1px solid var(--c-bg-muted-6); background: var(--c-bg-muted); box-shadow: 0 4px 14px rgba(15,23,42,0.06);
      }
      .mx-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mx-thumb-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--c-text-5); font-size: 30px; }
      .mx-badge {
        position: absolute; left: 8px; top: 8px; padding: 3px 7px; border-radius: 999px;
        background: rgba(17,24,39,0.72); color: #fff; font-size: 10.5px; font-weight: 800;
      }
      .mx-title { margin: 8px 2px 0; font-size: 14px; font-weight: 700; color: var(--c-text-b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mx-sub {
        margin: 3px 2px 0; font-size: 12px; color: var(--c-text-4); display: flex; align-items: center; gap: 4px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      /* ── 홈 섹션에 끼워 넣을 때(embedded) ──
         페이지 전용 장치(레일 sticky·블러·페이지 여백)를 끈다. 홈은 자체 헤더가 있어서
         레일까지 sticky 로 붙으면 두 겹이 되고, 우측 컬럼이 좁아 좌측 레일 2단도 안 맞는다. */
      .mx-shell.is-embedded { padding: 0; display: block; }
      .mx-shell.is-embedded .mx-rail {
        position: static; background: none; backdrop-filter: none; -webkit-backdrop-filter: none;
        border-bottom: none; padding: 0 0 6px; margin: 0;
      }
      .mx-shell.is-embedded .mx-panel {
        border: 1px solid var(--c-bg-muted-6); border-radius: 14px; margin: 0 0 10px;
      }
      .mx-shell.is-embedded .mx-main { padding: 0; }
      .mx-shell.is-embedded .mx-result-head { padding: 0 2px 10px; }
      .mx-shell.is-embedded .mx-grid { padding: 0; }
      .mx-shell.is-embedded .mx-empty { padding: 24px 0; }

      /* ── 태블릿/데스크톱: 메뉴가 좌측에 세로로 붙고, 누르면 옆으로 펼쳐진다 ── */
      @media (min-width: 744px) {
        .mx-shell:not(.is-embedded) {
          display: grid;
          grid-template-columns: 92px auto minmax(0, 1fr);
          align-items: start;
          padding: 10px 16px 40px;
        }
        .mx-shell:not(.is-embedded) .mx-rail {
          position: sticky; top: 12px;
          display: flex; flex-direction: column; align-items: stretch; gap: 2px;
          padding: 10px 6px; overflow: visible;
          background: var(--c-bg); border: 1px solid var(--c-bg-muted-5); border-radius: 20px;
          box-shadow: 0 4px 16px rgba(15,23,42,0.05);
          backdrop-filter: none; -webkit-backdrop-filter: none;
        }
        .mx-shell:not(.is-embedded) .mx-rail-item { width: 100%; padding: 7px 2px 9px; }
        .mx-shell:not(.is-embedded) .mx-rail-ico { width: 44px; height: 44px; border-radius: 14px; margin: 0 auto; }
        .mx-shell:not(.is-embedded) .mx-rail-label { font-size: 11.5px; }
        .mx-shell:not(.is-embedded) .mx-rail-reset { margin-top: 6px; padding-top: 10px; border-top: 1px solid var(--c-bg-muted-2); width: 100%; }

        .mx-shell:not(.is-embedded) .mx-panel {
          position: sticky; top: 12px; width: 216px; margin-left: 12px;
          border: 1px solid var(--c-bg-muted-5); border-radius: 20px; background: var(--c-bg);
          border-bottom: 1px solid var(--c-bg-muted-5);
          box-shadow: 0 4px 16px rgba(15,23,42,0.05);
          animation: mxPanelRight .22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .mx-shell:not(.is-embedded) .mx-panel-head { padding: 14px 16px 4px; font-size: 13.5px; }
        .mx-shell:not(.is-embedded) .mx-panel-body {
          flex-direction: column; align-items: stretch; gap: 2px; padding: 8px 10px 12px;
          max-height: calc(100vh - 160px); overflow-y: auto;
        }
        .mx-shell:not(.is-embedded) .mx-pchip { text-align: left; border: none; background: none; border-radius: 12px; padding: 10px 12px; font-size: 14px; }
        .mx-shell:not(.is-embedded) .mx-pchip:hover { background: var(--c-bg-soft-4); }
        .mx-pchip.is-on { background: var(--c-brand-soft-7); color: var(--c-brand-deep); font-weight: 800; }
        @keyframes mxPanelRight { from { opacity: 0; transform: translateX(-10px) } to { opacity: 1; transform: translateX(0) } }

        .mx-shell:not(.is-embedded) .mx-main { padding-left: 14px; }
        .mx-shell:not(.is-embedded) .mx-result-head { padding: 8px 6px 10px; }
        .mx-shell:not(.is-embedded) .mx-reset-wide {
          display: inline-block; border: none; background: none; color: var(--c-text-4b);
          font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .mx-shell:not(.is-embedded) .mx-grid { padding: 0 4px 40px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
      }
    `}</style>
  );
}
