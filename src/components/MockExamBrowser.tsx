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
}

const ALL = "all";

export default function MockExamBrowser({ exams, years }: { exams: BrowserExam[]; years: number[] }) {
  const [year, setYear] = useState<number | typeof ALL>(ALL);
  const [month, setMonth] = useState<number | typeof ALL>(ALL);
  const [subject, setSubject] = useState<string>(ALL);
  // 연도 칩은 기본 7개만 보여주고 "+"로 나머지를 펼친다(첨부 UI와 동일).
  const [allYears, setAllYears] = useState(false);
  // 모바일 컴팩트 바에서 여는 시트: null이면 닫힘.
  const [sheet, setSheet] = useState<null | "year" | "month" | "subject">(null);

  const shownYears = allYears ? years : years.slice(0, 7);
  const hasMoreYears = years.length > shownYears.length;

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

  const activeCount = (year !== ALL ? 1 : 0) + (month !== ALL ? 1 : 0) + (subject !== ALL ? 1 : 0);
  const subjectHit = findSubject(subject === ALL ? null : subject);

  function reset() {
    setYear(ALL);
    setMonth(ALL);
    setSubject(ALL);
  }

  return (
    <div className="mx-wrap">
      {/* ───── 모바일: 헤더 바로 아래 컴팩트 필터 바 ───── */}
      <div className="mx-compact">
        <div className="mx-compact-row">
          <CompactPill label="연도" value={year === ALL ? "전체" : `${year}년`} active={year !== ALL} onClick={() => setSheet("year")} />
          <CompactPill label="월" value={month === ALL ? "전체" : `${month}월`} active={month !== ALL} onClick={() => setSheet("month")} />
          <CompactPill
            label="과목"
            value={subjectHit ? subjectHit.subject.label : "전체"}
            icon={subjectHit ? subjectHit.group.icon : undefined}
            active={subject !== ALL}
            onClick={() => setSheet("subject")}
          />
          {activeCount > 0 && (
            <button type="button" className="mx-reset" onClick={reset} aria-label="필터 초기화">
              초기화
            </button>
          )}
        </div>
      </div>

      {/* ───── 태블릿/데스크톱: 펼쳐진 분류 패널 ───── */}
      <div className="mx-panels">
        <section className="mx-card">
          <div className="mx-row">
            <span className="mx-row-label">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/filter-year.svg" alt="" width={18} height={18} />
              시행 연도
            </span>
            <div className="mx-chips">
              <Chip active={year === ALL} onClick={() => setYear(ALL)}>전체</Chip>
              {shownYears.map((y) => (
                <Chip key={y} active={year === y} onClick={() => setYear(y)}>{y}</Chip>
              ))}
              {hasMoreYears && (
                <button type="button" className="mx-more" onClick={() => setAllYears(true)} aria-label="연도 더 보기">＋</button>
              )}
            </div>
          </div>
        </section>

        <section className="mx-card">
          <div className="mx-row">
            <span className="mx-row-label">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/filter-month.svg" alt="" width={18} height={18} />
              시행 월
            </span>
            <div className="mx-chips">
              <Chip active={month === ALL} onClick={() => setMonth(ALL)}>전체</Chip>
              {EXAM_MONTHS.map((m) => (
                <Chip key={m} active={month === m} onClick={() => setMonth(m)}>{m}월</Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-card">
          <div className="mx-row">
            <span className="mx-row-label">과목</span>
            <div className="mx-chips">
              <Chip active={subject === ALL} onClick={() => setSubject(ALL)}>전체</Chip>
            </div>
          </div>
          {SUBJECT_GROUPS.map((g) => (
            <div key={g.key} className="mx-row mx-row-sub">
              <span className="mx-row-label">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/${g.icon}.svg`} alt="" width={18} height={18} />
                {g.label}
              </span>
              <div className="mx-chips">
                {g.subjects.map((s) => (
                  <Chip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>{s.label}</Chip>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* ───── 결과 ───── */}
      <div className="mx-result-head">
        <span className="mx-count">
          모의고사 <b>{filtered.length}</b>개
        </span>
        {activeCount > 0 && (
          <button type="button" className="mx-reset-wide" onClick={reset}>필터 초기화</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mx-empty">{exams.length === 0 ? "등록된 모의고사가 없습니다." : "조건에 맞는 모의고사가 없어요."}</p>
      ) : (
        <div className="mx-grid">
          {filtered.map((ex) => {
            const hit = findSubject(ex.subject);
            return (
              <Link key={ex.id} href={`/mock-exam/${ex.id}`} className="hover-lift mx-item">
                <div className="mx-thumb">
                  {ex.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ex.coverUrl} alt="" />
                  ) : (
                    <span className="mx-thumb-empty">📄</span>
                  )}
                  {ex.solutionCount > 0 && <span className="mx-badge">해설</span>}
                </div>
                <p className="mx-title">{ex.title}</p>
                <p className="mx-sub">
                  {hit && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/icons/${hit.group.icon}.svg`} alt="" width={13} height={13} />
                      {hit.subject.label}
                    </>
                  )}
                  {!hit && (ex.subtitle || `${ex.pageCount}페이지`)}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {/* ───── 모바일 바텀시트 ───── */}
      {sheet && (
        <div className="mx-sheet-dim" onClick={() => setSheet(null)} role="presentation">
          <div className="mx-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mx-sheet-grab" />
            <div className="mx-sheet-head">
              {sheet === "year" ? "시행 연도" : sheet === "month" ? "시행 월" : "과목"}
            </div>
            <div className="mx-sheet-body">
              {sheet === "year" && (
                <div className="mx-sheet-grid">
                  <SheetChip active={year === ALL} onClick={() => { setYear(ALL); setSheet(null); }}>전체</SheetChip>
                  {years.map((y) => (
                    <SheetChip key={y} active={year === y} onClick={() => { setYear(y); setSheet(null); }}>{y}</SheetChip>
                  ))}
                </div>
              )}
              {sheet === "month" && (
                <div className="mx-sheet-grid">
                  <SheetChip active={month === ALL} onClick={() => { setMonth(ALL); setSheet(null); }}>전체</SheetChip>
                  {EXAM_MONTHS.map((m) => (
                    <SheetChip key={m} active={month === m} onClick={() => { setMonth(m); setSheet(null); }}>{m}월</SheetChip>
                  ))}
                </div>
              )}
              {sheet === "subject" && (
                <>
                  <button type="button" className={`mx-sheet-item${subject === ALL ? " is-on" : ""}`} onClick={() => { setSubject(ALL); setSheet(null); }}>
                    전체 과목
                    {subject === ALL && <CheckMark />}
                  </button>
                  {SUBJECT_GROUPS.map((g) => (
                    <div key={g.key} className="mx-sheet-group">
                      <div className="mx-sheet-group-head">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/icons/${g.icon}.svg`} alt="" width={17} height={17} />
                        {g.label}
                      </div>
                      {g.subjects.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`mx-sheet-item${subject === s.id ? " is-on" : ""}`}
                          onClick={() => { setSubject(s.id); setSheet(null); }}
                        >
                          {s.label}
                          {subject === s.id && <CheckMark />}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <BrowserStyles />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`mx-chip${active ? " is-on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function SheetChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`mx-sheet-chip${active ? " is-on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function CompactPill({ label, value, icon, active, onClick }: { label: string; value: string; icon?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`mx-pill${active ? " is-on" : ""}`} onClick={onClick}>
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/icons/${icon}.svg`} alt="" width={15} height={15} />
      )}
      <span className="mx-pill-label">{label}</span>
      <span className="mx-pill-value">{value}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

function CheckMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3787FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BrowserStyles() {
  return (
    <style>{`
      .mx-wrap { padding-bottom: 40px; }

      /* ── 모바일 컴팩트 바(기본). 헤더 바로 아래 붙어 스크롤에도 따라온다. ── */
      .mx-compact {
        position: sticky; top: 0; z-index: 20;
        background: rgba(255,255,255,0.94);
        backdrop-filter: saturate(180%) blur(10px);
        -webkit-backdrop-filter: saturate(180%) blur(10px);
        border-bottom: 1px solid #F2F4F6;
      }
      .mx-compact-row {
        display: flex; align-items: center; gap: 6px;
        padding: 9px 14px; overflow-x: auto; scrollbar-width: none;
      }
      .mx-pill {
        display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
        max-width: 46vw;
        padding: 7px 11px; border-radius: 999px;
        border: 1px solid #E9EDF3; background: #fff; color: #4E5968;
        font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: border-color .15s ease, background .15s ease, color .15s ease;
      }
      .mx-pill:active { transform: scale(0.97); }
      .mx-pill.is-on { border-color: #3787FF; background: #F2F7FF; color: #1F5EDC; }
      .mx-pill-label { color: #B0B8C1; font-weight: 600; font-size: 12px; }
      .mx-pill.is-on .mx-pill-label { color: #7DAAF5; }
      .mx-pill-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mx-reset {
        flex-shrink: 0; border: none; background: none; color: #8B95A1;
        font-size: 12.5px; font-weight: 700; padding: 6px 4px; cursor: pointer; font-family: inherit;
      }
      .mx-panels { display: none; }

      /* ── 결과 ── */
      .mx-result-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px 8px;
      }
      .mx-count { font-size: 13px; color: #8B95A1; font-weight: 600; }
      .mx-count b { color: #191F28; font-weight: 800; }
      .mx-reset-wide { display: none; }
      .mx-empty { padding: 48px 20px; text-align: center; color: #9CA3AF; font-size: 14px; margin: 0; }
      .mx-grid {
        padding: 4px 16px 40px; display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px;
      }
      .mx-item { text-decoration: none; display: block; }
      .mx-thumb {
        position: relative; aspect-ratio: 3 / 4; border-radius: 14px; overflow: hidden;
        border: 1px solid #EEF0F3; background: #F3F4F6; box-shadow: 0 4px 14px rgba(15,23,42,0.06);
      }
      .mx-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mx-thumb-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #B0B8C1; font-size: 30px; }
      .mx-badge {
        position: absolute; left: 8px; top: 8px; padding: 3px 7px; border-radius: 999px;
        background: rgba(17,24,39,0.72); color: #fff; font-size: 10.5px; font-weight: 800;
      }
      .mx-title {
        margin: 8px 2px 0; font-size: 14px; font-weight: 700; color: #191F28;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .mx-sub {
        margin: 3px 2px 0; font-size: 12px; color: #8A909C;
        display: flex; align-items: center; gap: 4px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      /* ── 바텀시트(모바일) ── */
      .mx-sheet-dim {
        position: fixed; inset: 0; z-index: 200; background: rgba(15,23,42,0.42);
        display: flex; align-items: flex-end; animation: mxDim .18s ease both;
      }
      .mx-sheet {
        width: 100%; max-height: 76vh; background: #fff;
        border-radius: 20px 20px 0 0; display: flex; flex-direction: column;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        animation: mxSheetUp .26s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .mx-sheet-grab { width: 40px; height: 4px; border-radius: 999px; background: #E5E8EB; margin: 9px auto 2px; }
      .mx-sheet-head { padding: 8px 20px 10px; font-size: 16px; font-weight: 800; color: #191F28; }
      .mx-sheet-body { overflow-y: auto; padding: 0 14px 18px; }
      .mx-sheet-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 4px 6px; }
      .mx-sheet-chip {
        padding: 12px 4px; border-radius: 12px; border: 1px solid #EEF0F3; background: #F9FAFB;
        font-size: 14px; font-weight: 700; color: #4E5968; cursor: pointer; font-family: inherit;
      }
      .mx-sheet-chip.is-on { border-color: #3787FF; background: #F2F7FF; color: #1F5EDC; }
      .mx-sheet-group { margin-top: 6px; }
      .mx-sheet-group-head {
        display: flex; align-items: center; gap: 6px;
        padding: 12px 10px 6px; font-size: 12.5px; font-weight: 800; color: #8B95A1;
      }
      .mx-sheet-item {
        display: flex; align-items: center; justify-content: space-between; width: 100%;
        padding: 12px 10px; border: none; background: none; border-radius: 12px;
        font-size: 15px; font-weight: 600; color: #333D4B; cursor: pointer; font-family: inherit; text-align: left;
      }
      .mx-sheet-item.is-on { background: #F2F7FF; color: #1F5EDC; font-weight: 800; }
      @keyframes mxDim { from { opacity: 0 } to { opacity: 1 } }
      @keyframes mxSheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      @media (prefers-reduced-motion: reduce) {
        .mx-sheet-dim, .mx-sheet { animation: none; }
      }

      /* ── 태블릿/데스크톱: 펼친 패널로 교체 ── */
      @media (min-width: 744px) {
        .mx-compact { display: none; }
        .mx-panels { display: block; padding: 16px 20px 4px; background: #F4F7FC; }
        .mx-card {
          background: #fff; border: 1px solid #EDF1F7; border-radius: 16px;
          box-shadow: 0 2px 10px rgba(15,23,42,0.04);
          padding: 14px 18px; margin-bottom: 12px;
        }
        .mx-row { display: flex; align-items: flex-start; gap: 14px; padding: 4px 0; }
        .mx-row-sub { border-top: 1px solid #F4F6FA; padding-top: 10px; margin-top: 6px; }
        .mx-row-label {
          display: inline-flex; align-items: center; gap: 6px; flex: 0 0 116px;
          font-size: 14px; font-weight: 800; color: #1F5EDC; padding-top: 7px;
        }
        .mx-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 0; flex: 1; min-width: 0; }
        .mx-chip {
          position: relative; padding: 7px 15px; border: 1.5px solid transparent; border-radius: 999px;
          background: none; color: #4E5968; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: color .15s ease, border-color .15s ease, background .15s ease;
        }
        .mx-chip + .mx-chip::before {
          content: ""; position: absolute; left: -1px; top: 50%; transform: translateY(-50%);
          width: 1px; height: 12px; background: #E5E8EB;
        }
        .mx-chip:hover { color: #191F28; }
        .mx-chip.is-on {
          border-color: #3787FF; background: #fff; color: #1F5EDC; font-weight: 800;
        }
        .mx-chip.is-on::before, .mx-chip.is-on + .mx-chip::before { display: none; }
        .mx-more {
          margin-left: auto; width: 34px; height: 34px; border-radius: 10px;
          border: 1.5px solid #3787FF; background: #fff; color: #3787FF;
          font-size: 17px; font-weight: 700; cursor: pointer; line-height: 1; font-family: inherit;
        }
        .mx-result-head { padding: 18px 22px 10px; }
        .mx-reset-wide {
          display: inline-block; border: none; background: none; color: #8B95A1;
          font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .mx-grid { padding: 4px 20px 40px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
      }
    `}</style>
  );
}
