"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// 모의고사 문항 풀이(모바일). 시험지를 문항 단위로 잘라 한 문항씩 보고 답을 고른다.
// 태블릿 필기 뷰어(MockExamViewer)와는 별개 화면이다 — 그쪽은 시험지 위에 펜으로 쓰는 용도.

interface Question {
  number: number;
  imageUrl: string;
  /** 5 = 오지선다, 0 = 단답형(수학 16~22 등) */
  choiceCount: number;
  /** 발문 첫 문장("1. 윗글의 내용과 일치하지 않는 것은?"). 헤더 제목으로 쓴다. */
  title: string | null;
  /** 여러 문항이 공유하는 지문 이미지(국어 [1~3] 등). 없으면 빈 배열. */
  passageUrls: string[];
  /** 발문만 잘라낸 이미지. choiceUrls 와 함께 있을 때만 사용. */
  stemUrl: string | null;
  /** 선택지 ①~⑤ 이미지. 있으면 이 이미지를 직접 탭해 고른다. */
  choiceUrls: string[] | null;
}
interface Graded extends Question {
  answer: number;
  selected: number | null;
  isCorrect: boolean;
}
interface Result {
  total: number;
  correct: number;
  answered: number;
  questions: Graded[];
}

const CIRCLE = ["①", "②", "③", "④", "⑤"];

export default function MockExamSolver({
  examId,
  title,
  subtitle,
}: {
  examId: string;
  title: string;
  subtitle: string | null;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [grading, setGrading] = useState(false);
  const [message, setMessage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shortInput, setShortInput] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/mock-exams/${encodeURIComponent(examId)}/questions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setQuestions(Array.isArray(d.questions) ? d.questions : []);
        setAnswers(d.myAnswers ?? {});
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [examId]);

  const current = questions[index];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.number] != null).length,
    [questions, answers]
  );

  // 문항이 바뀌면 맨 위로. 지문·선택지 때문에 화면이 길어져, 답을 고른 지점(하단)에
  // 스크롤이 남은 채 다음 문항이 뜨면 발문부터 보이지 않는다.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index]);

  // 단답형 입력칸은 문항이 바뀌면 그 문항의 기존 답으로 되돌린다.
  useEffect(() => {
    if (!current) return;
    setShortInput(current.choiceCount === 0 && answers[current.number] != null ? String(answers[current.number]) : "");
  }, [current, answers]);

  const pick = useCallback(
    (value: number) => {
      if (!current || result) return;
      setAnswers((prev) => ({ ...prev, [current.number]: value }));
      // 저장은 백그라운드로. 실패해도 풀이를 막지 않는다(채점 때 다시 보낸다).
      fetch(`/api/mock-exams/${encodeURIComponent(examId)}/questions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: current.number, selected: value }),
      }).catch(() => {});
      if (current.choiceCount > 0) {
        // 객관식은 고르면 자동으로 다음 문항(마지막이면 그대로).
        setTimeout(() => setIndex((i) => Math.min(i + 1, questions.length - 1)), 180);
      }
    },
    [current, examId, questions.length, result]
  );

  async function submit() {
    if (grading) return;
    setGrading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/mock-exams/${encodeURIComponent(examId)}/grade`, {
        method: "POST",
        credentials: "include",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "채점하지 못했습니다.");
      setResult(d);
      setSheetOpen(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "채점하지 못했습니다.");
    } finally {
      setGrading(false);
    }
  }

  async function retry() {
    await fetch(`/api/mock-exams/${encodeURIComponent(examId)}/grade`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
    setAnswers({});
    setResult(null);
    setIndex(0);
  }

  if (loading) {
    return (
      <div className="solver-wrap">
        <div className="solver-skel" />
        <Styles />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="solver-wrap">
        <p className="solver-empty">이 시험지는 아직 문항별 풀이가 준비되지 않았어요.</p>
        <Styles />
      </div>
    );
  }

  // ───────── 채점 결과 ─────────
  if (result) {
    const wrong = result.questions.filter((q) => !q.isCorrect);
    return (
      <div className="solver-wrap">
        <div className="solver-score">
          <p className="solver-score-label">{subtitle ?? title}</p>
          <p className="solver-score-main">
            <b>{result.correct}</b> / {result.total}
          </p>
          <p className="solver-score-sub">
            {result.answered < result.total
              ? `${result.total - result.answered}문항은 답을 고르지 않았어요`
              : "모든 문항을 풀었어요"}
          </p>
          <button type="button" className="solver-retry" onClick={retry}>
            다시 풀기
          </button>
        </div>

        <div className="solver-grid">
          {result.questions.map((q) => (
            <button
              key={q.number}
              type="button"
              className={`solver-cell${q.isCorrect ? " is-ok" : q.selected == null ? " is-skip" : " is-bad"}`}
              onClick={() => {
                setResult(null);
                setIndex(result.questions.findIndex((x) => x.number === q.number));
              }}
            >
              {q.number}
            </button>
          ))}
        </div>

        {wrong.length > 0 && (
          <div className="solver-review">
            <h2 className="solver-review-title">틀리거나 안 푼 문항 {wrong.length}개</h2>
            {wrong.map((q) => (
              <div key={q.number} className="solver-review-item">
                <div className="solver-review-head">
                  <span className="solver-review-num">{q.number}번</span>
                  <span className="solver-review-ans">
                    내 답 {fmtAnswer(q.selected, q.choiceCount) ?? "—"} · 정답{" "}
                    <b>{q.answer === 0 ? "전항 정답" : fmtAnswer(q.answer, q.choiceCount)}</b>
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.imageUrl} alt={`${q.number}번 문항`} loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        )}
        <Styles />
      </div>
    );
  }

  // ───────── 풀이 ─────────
  const picked = answers[current.number];
  return (
    <div className="solver-wrap">
      <div className="solver-top">
        <button type="button" className="solver-back" onClick={() => router.back()} aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="solver-progress">
          <div className="solver-progress-bar" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
        <button type="button" className="solver-sheet-btn" onClick={() => setSheetOpen(true)}>
          {answeredCount}/{questions.length}
        </button>
      </div>

      {/* 발문 텍스트가 있으면 그게 곧 제목("1. 윗글의 내용과 일치하지 않는 것은?").
          없으면(수학 등 수식 문항) "N번 과목명"으로 폴백. */}
      <div className="solver-qhead">
        {current.title ? (
          <span className="solver-qtitle-main">{current.title}</span>
        ) : (
          <>
            <span className="solver-qnum">{current.number}번</span>
            <span className="solver-qtitle">{subtitle ?? title}</span>
          </>
        )}
      </div>

      {/* 공유 지문(국어 [1~3] 등) — 문항 위에 접을 수 있게 둔다.
          passageUrls 는 구버전 응답 캐시에 없을 수 있어 옵셔널로 다룬다. */}
      {(current.passageUrls?.length ?? 0) > 0 && (
        <PassageBlock key={`p-${current.passageUrls[0]}`} urls={current.passageUrls} />
      )}

      <div className="solver-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.stemUrl ?? current.imageUrl}
          src={current.choiceUrls ? current.stemUrl! : current.imageUrl}
          alt={`${current.number}번 문항`}
          decoding="async"
        />
      </div>

      {/* 선택지가 분리된 문항: 실제 선택지 문장을 탭해서 고른다 */}
      {current.choiceUrls && (
        <div className="solver-choice-list">
          {current.choiceUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`solver-choice-row${picked === i + 1 ? " is-on" : ""}`}
              onClick={() => pick(i + 1)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${CIRCLE[i]}번 선택지`} decoding="async" />
            </button>
          ))}
        </div>
      )}

      <div className="solver-answer">
        {current.choiceUrls ? null : current.choiceCount > 0 ? (
          <div className="solver-choices">
            {CIRCLE.slice(0, current.choiceCount).map((c, i) => (
              <button
                key={c}
                type="button"
                className={`solver-choice${picked === i + 1 ? " is-on" : ""}`}
                onClick={() => pick(i + 1)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="solver-short">
            <input
              type="number"
              inputMode="numeric"
              placeholder="답 입력"
              value={shortInput}
              onChange={(e) => setShortInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            />
            <button
              type="button"
              onClick={() => {
                const v = Number(shortInput);
                if (Number.isInteger(v) && shortInput !== "") pick(v);
              }}
              disabled={shortInput === ""}
            >
              입력
            </button>
          </div>
        )}

        <div className="solver-nav">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            이전
          </button>
          {index === questions.length - 1 ? (
            <button type="button" className="solver-submit" onClick={submit} disabled={grading}>
              {grading ? "채점 중…" : "채점하기"}
            </button>
          ) : (
            <button type="button" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}>
              다음
            </button>
          )}
        </div>
        {message && <p className="solver-msg">{message}</p>}
      </div>

      {/* 문항 이동 시트 */}
      {sheetOpen && (
        <div className="solver-sheet-dim" onClick={() => setSheetOpen(false)}>
          <div className="solver-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="solver-sheet-title">문항 이동</p>
            <div className="solver-grid">
              {questions.map((q, i) => (
                <button
                  key={q.number}
                  type="button"
                  className={`solver-cell${answers[q.number] != null ? " is-done" : ""}${i === index ? " is-cur" : ""}`}
                  onClick={() => {
                    setIndex(i);
                    setSheetOpen(false);
                  }}
                >
                  {q.number}
                </button>
              ))}
            </div>
            <button type="button" className="solver-submit wide" onClick={submit} disabled={grading}>
              {grading ? "채점 중…" : `채점하기 (${answeredCount}/${questions.length})`}
            </button>
          </div>
        </div>
      )}
      <Styles />
    </div>
  );
}

// 공유 지문. 길어서 기본은 펼침이되 접을 수 있게 한다(같은 지문의 다음 문항으로 넘어가면
// 이미 읽었으니 접힌 채로 시작하는 게 편하다 — 지문이 바뀌면 key 가 바뀌어 다시 펼쳐진다).
function PassageBlock({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="solver-passage">
      <button type="button" className="solver-passage-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        지문 {open ? "접기" : "보기"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && urls.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="지문" decoding="async" />
      ))}
    </div>
  );
}

function fmtAnswer(v: number | null, choiceCount: number): string | null {
  if (v == null) return null;
  if (choiceCount > 0 && v >= 1 && v <= 5) return CIRCLE[v - 1];
  return String(v);
}

function Styles() {
  return (
    <style>{`
      .solver-wrap { min-height: 100vh; background: #fff; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
      .solver-skel { height: 60vh; margin: 16px; border-radius: 16px; background: #F3F4F6; }
      .solver-empty { padding: 60px 24px; text-align: center; color: #9CA3AF; font-size: 14px; }

      .solver-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; background: #fff; border-bottom: 1px solid #F2F4F6; }
      .solver-back { width: 34px; height: 34px; border: none; background: none; cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center; }
      .solver-progress { flex: 1; height: 6px; border-radius: 999px; background: #EEF1F5; overflow: hidden; }
      .solver-progress-bar { height: 100%; background: linear-gradient(90deg, #7DC4FF, #3787FF); border-radius: 999px;
        transition: width .25s ease; }
      .solver-sheet-btn { flex-shrink: 0; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid #E5E7EB;
        background: #fff; color: #4E5968; font-size: 12.5px; font-weight: 800; cursor: pointer; }

      .solver-qhead { display: flex; align-items: baseline; gap: 8px; padding: 14px 16px 8px; }
      .solver-qnum { font-size: 20px; font-weight: 900; color: #191F28; }
      .solver-qtitle { font-size: 13px; color: #8B95A1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .solver-qtitle-main { font-size: 16.5px; font-weight: 800; color: #191F28; line-height: 1.4; }

      /* 문항 이미지는 가로 폭을 꽉 채운다. 세로가 길면 스크롤해서 본다. */
      .solver-image { padding: 0 12px; }
      .solver-image img { width: 100%; height: auto; display: block; border-radius: 12px; border: 1px solid #EEF0F3; }

      /* 공유 지문 */
      .solver-passage { margin: 0 12px 10px; border: 1px solid #EEF0F3; border-radius: 12px; overflow: hidden; background: #FBFCFE; }
      .solver-passage-toggle { display: flex; align-items: center; gap: 5px; width: 100%; padding: 10px 14px;
        border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 800; color: #4E5968; font-family: inherit; }
      .solver-passage img { width: 100%; height: auto; display: block; border-top: 1px solid #F2F4F6; background: #fff; }

      /* 분리된 선택지 — 실제 문장을 탭해서 고른다 */
      .solver-choice-list { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 0; }
      .solver-choice-row { display: block; width: 100%; padding: 6px 10px; border-radius: 12px;
        border: 1.5px solid #E5E7EB; background: #fff; cursor: pointer; text-align: left;
        transition: transform .1s ease, border-color .12s ease, background .12s ease; }
      .solver-choice-row:active { transform: scale(0.985); }
      .solver-choice-row.is-on { border-color: #3787FF; background: #F2F7FF; box-shadow: 0 0 0 1px #3787FF inset; }
      .solver-choice-row img { width: 100%; height: auto; display: block; mix-blend-mode: multiply; }

      .solver-answer { position: sticky; bottom: 0; background: #fff; padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid #F2F4F6; margin-top: 14px; }
      .solver-choices { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
      .solver-choice { height: 52px; border-radius: 14px; border: 1.5px solid #E5E7EB; background: #fff;
        font-size: 21px; color: #4E5968; cursor: pointer; transition: transform .12s ease, background .12s ease, border-color .12s ease; }
      .solver-choice:active { transform: scale(0.94); }
      .solver-choice.is-on { background: #3787FF; border-color: #3787FF; color: #fff; }

      .solver-short { display: flex; gap: 8px; }
      .solver-short input { flex: 1; height: 52px; border-radius: 14px; border: 1.5px solid #E5E7EB; padding: 0 14px;
        font-size: 16px; font-weight: 700; color: #191F28; }
      .solver-short button { flex-shrink: 0; padding: 0 20px; height: 52px; border-radius: 14px; border: none;
        background: #3787FF; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; }
      .solver-short button:disabled { background: #C9D3DF; }

      .solver-nav { display: flex; gap: 8px; margin-top: 10px; }
      .solver-nav button { flex: 1; height: 46px; border-radius: 12px; border: 1px solid #E5E7EB; background: #fff;
        color: #4E5968; font-size: 15px; font-weight: 800; cursor: pointer; }
      .solver-nav button:disabled { color: #C9D3DF; }
      .solver-submit { background: #191F28 !important; border-color: #191F28 !important; color: #fff !important; }
      .solver-submit.wide { width: 100%; height: 50px; margin-top: 12px; border-radius: 14px; border: none; font-size: 15.5px; font-weight: 900; cursor: pointer; }
      .solver-msg { margin: 8px 2px 0; font-size: 13px; color: #E11D48; font-weight: 600; }

      .solver-sheet-dim { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 60;
        background: rgba(15,23,42,0.5); display: flex; align-items: flex-end; }
      .solver-sheet { width: 100%; background: #fff; border-radius: 20px 20px 0 0; padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px)); max-height: 76vh; overflow-y: auto; }
      .solver-sheet-title { margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #191F28; }

      .solver-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 8px; padding: 0 16px; }
      .solver-cell { height: 44px; border-radius: 12px; border: 1.5px solid #E5E7EB; background: #fff;
        font-size: 14px; font-weight: 800; color: #8B95A1; cursor: pointer; }
      .solver-cell.is-done { background: #EEF5FF; border-color: #BFDBFE; color: #1F5EDC; }
      .solver-cell.is-cur { outline: 2px solid #3787FF; outline-offset: 1px; }
      .solver-cell.is-ok { background: #ECFDF5; border-color: #A7F3D0; color: #059669; }
      .solver-cell.is-bad { background: #FEF2F2; border-color: #FECACA; color: #E11D48; }
      .solver-cell.is-skip { background: #F9FAFB; }

      .solver-score { padding: 30px 20px 22px; text-align: center; }
      .solver-score-label { margin: 0; font-size: 13.5px; color: #8B95A1; font-weight: 700; }
      .solver-score-main { margin: 8px 0 0; font-size: 40px; font-weight: 900; color: #191F28; }
      .solver-score-main b { color: #3787FF; }
      .solver-score-sub { margin: 6px 0 0; font-size: 13.5px; color: #8B95A1; font-weight: 600; }
      .solver-retry { margin-top: 16px; height: 44px; padding: 0 22px; border-radius: 999px; border: 1px solid #E5E7EB;
        background: #fff; color: #4E5968; font-size: 14px; font-weight: 800; cursor: pointer; }

      .solver-review { padding: 26px 16px 0; }
      .solver-review-title { font-size: 15px; font-weight: 800; color: #191F28; margin: 0 0 12px; }
      .solver-review-item { margin-bottom: 18px; }
      .solver-review-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
      .solver-review-num { font-size: 15px; font-weight: 900; color: #191F28; }
      .solver-review-ans { font-size: 12.5px; color: #8B95A1; font-weight: 600; }
      .solver-review-ans b { color: #059669; }
      .solver-review-item img { width: 100%; height: auto; display: block; border-radius: 12px; border: 1px solid #EEF0F3; }

      /* 태블릿: 문항 이미지가 너무 커지지 않게 가운데 정렬로 폭을 제한 */
      @media (min-width: 744px) {
        .solver-image, .solver-review-item img { max-width: 620px; margin-left: auto; margin-right: auto; }
        .solver-answer, .solver-choice-list, .solver-passage { max-width: 620px; margin-left: auto; margin-right: auto; }
        .solver-passage { margin-bottom: 10px; }
      }
    `}</style>
  );
}
