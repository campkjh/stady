"use client";

import { Fragment, useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface OxQuizSet {
  id: string;
  title: string;
  categoryId: string;
  difficulty: string;
  totalQuestions: number;
  isPopular: boolean;
  createdAt: string;
  category: Category;
}

interface OxQuestion {
  id: string;
  order: number;
  section: string | null;
  question: string;
  answer: boolean;
  explanation: string | null;
  examYearMonth: string | null;
  answerRate: number | null;
}

const DIFFICULTIES = ["쉬움", "보통", "어려움"];

export default function OxQuizManagement() {
  const [quizSets, setQuizSets] = useState<OxQuizSet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [syncingOx, setSyncingOx] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    difficulty: "보통",
    totalQuestions: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const [selectedSet, setSelectedSet] = useState<OxQuizSet | null>(null);
  const [questions, setQuestions] = useState<OxQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQText, setEditQText] = useState("");
  const [editQAnswer, setEditQAnswer] = useState(true);
  const [editQExplanation, setEditQExplanation] = useState("");
  const [editQSection, setEditQSection] = useState("");
  const [editQExamYearMonth, setEditQExamYearMonth] = useState("");
  const [questionData, setQuestionData] = useState({
    question: "",
    answer: true,
    explanation: "",
    section: "",
    order: "",
    examYearMonth: "",
  });
  const [useCustomSection, setUseCustomSection] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    fetchQuizSets();
    fetchCategories();
  }, []);

  const fetchQuizSets = async () => {
    const res = await fetch("/api/ox-quiz", { credentials: "include" });
    const data = await res.json();
    setQuizSets(data.oxQuizSets || []);
  };

  // 카테고리별로 묶는다(첫 등장 순서 유지). 같은 카테고리 세트는 연속 블록.
  function groupByCategory(sets: OxQuizSet[]) {
    const groups: { catId: string; catName: string; catIcon: string; sets: OxQuizSet[] }[] = [];
    for (const s of sets) {
      const catId = s.category?.id ?? "none";
      let g = groups.find((x) => x.catId === catId);
      if (!g) {
        g = { catId, catName: s.category?.name ?? "기타", catIcon: s.category?.icon ?? "", sets: [] };
        groups.push(g);
      }
      g.sets.push(s);
    }
    return groups;
  }

  // 평탄화된 순서를 0..N 글로벌 순서로 저장(카테고리 연속 유지 + 카테고리 내 순서 반영).
  const persistOrder = async (flat: OxQuizSet[]) => {
    setReordering(true);
    try {
      const orders = flat.map((s, i) => ({ setId: s.id, sortOrder: i }));
      await fetch("/api/admin/ox-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orders }),
      });
    } finally {
      setReordering(false);
    }
  };

  // 같은 카테고리 안에서 위/아래로 이동. 즉시 저장.
  const moveSet = (catId: string, index: number, dir: "up" | "down") => {
    if (reordering) return;
    const groups = groupByCategory(quizSets);
    const g = groups.find((x) => x.catId === catId);
    if (!g) return;
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= g.sets.length) return;
    [g.sets[index], g.sets[j]] = [g.sets[j], g.sets[index]];
    const flat = groups.flatMap((x) => x.sets);
    setQuizSets(flat);
    persistOrder(flat);
  };

  const fetchCategories = async () => {
    const res = await fetch("/api/categories", { credentials: "include" });
    const data = await res.json();
    setCategories((data.categories || []).filter((c: Category) => c.name !== "전체"));
  };

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/ox-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: "", categoryId: "", difficulty: "보통", totalQuestions: 0 });
        fetchQuizSets();
      } else {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncOxData = async () => {
    if (syncingOx) return;
    if (!confirm("생활과윤리 OX 퀴즈를 1013문항 기준으로 다시 동기화할까요? 기존 풀이 기록과 책갈피는 가능한 한 보존됩니다.")) return;

    setSyncingOx(true);
    try {
      const res = await fetch("/api/admin/ox-quiz/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "동기화 중 오류가 발생했습니다.");
        return;
      }
      await fetchQuizSets();
      if (selectedSet) await openQuestions(selectedSet);
      alert(`동기화 완료: ${data.syncedSets}개 중분류, ${data.syncedQuestions}문항`);
    } finally {
      setSyncingOx(false);
    }
  };

  const openQuestions = async (set: OxQuizSet) => {
    setSelectedSet(set);
    const res = await fetch(`/api/ox-quiz/${set.id}/questions`, { credentials: "include" });
    const data = await res.json();
    setQuestions(data.questions || []);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSet) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ox-quiz/${selectedSet.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionData.question,
          answer: questionData.answer,
          explanation: questionData.explanation,
          section: questionData.section,
          examYearMonth: questionData.examYearMonth,
          // position = 선택한 소분류 내부 위치(비우면 그 소분류 맨 끝).
          position: questionData.order ? Number(questionData.order) : undefined,
        }),
        credentials: "include",
      });
      if (res.ok) {
        setShowQuestionForm(false);
        setUseCustomSection(false);
        setQuestionData({ question: "", answer: true, explanation: "", section: "", order: "", examYearMonth: "" });
        openQuestions(selectedSet);
        fetchQuizSets();
      } else {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 난이도는 상태값이라 뜻을 지키되, 모양만 알약으로 통일한다.
  const difficultyBadge = (d: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      "쉬움": { bg: JC.soft, text: JC.body },
      "보통": { bg: JC.accentBg, text: JC.accent },
      "어려움": { bg: "var(--c-danger-soft)", text: "var(--c-danger-c)" },
    };
    const c = colors[d] || colors["보통"];
    return (
      <span style={{ ...chipBase, background: c.bg, color: c.text }}>
        {d}
      </span>
    );
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 13,
    border: `1px solid ${JC.soft}`,
    background: "var(--c-bg)",
    fontSize: 14,
    color: JC.title,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: JC.body,
    marginBottom: 6,
  };

  // 현재 세트에 이미 존재하는 소분류(섹션) 목록 — 새 문제를 여기에 넣으면 새 소분류가 안 생긴다.
  const existingSections = Array.from(
    new Set(questions.map((q) => q.section).filter((s): s is string => !!s))
  );

  // 선택한 소분류에 이미 있는 문제 수 — "번호 위치"는 이 소분류 '내부' 기준이라
  // 소분류 경계를 넘지 않아 소분류가 쪼개지지(=새로 생기지) 않는다.
  const selectedSectionCount = questions.filter(
    (q) => (q.section || "") === (questionData.section || "")
  ).length;

  return (
    <div className="jc-admin">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: JC.title }}>OX 퀴즈 관리</h1>
          <p style={{ fontSize: 14, fontWeight: 400, color: JC.sub, marginTop: 6 }}>총 {quizSets.length}개의 퀴즈 세트</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="press"
            onClick={handleSyncOxData}
            disabled={syncingOx}
            style={{
              padding: "11px 18px",
              background: JC.soft,
              color: JC.body,
              border: "none",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 600,
              cursor: syncingOx ? "default" : "pointer",
              opacity: syncingOx ? 0.6 : 1,
            }}
          >
            {syncingOx ? "동기화 중..." : "1013문항 동기화"}
          </button>
          <button
            className="press"
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: "11px 22px",
              background: showForm ? JC.soft : JC.accent,
              color: showForm ? JC.body : "#fff",
              border: "none",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: showForm ? 600 : 700,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            {showForm ? "취소" : "+ 퀴즈 세트 추가"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreateSet} style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: JC.title, marginBottom: 20 }}>새 OX 퀴즈 세트</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>카테고리</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                style={{ ...inputStyle, appearance: "auto" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                required
              >
                <option value="">선택하세요</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>난이도</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                style={{ ...inputStyle, appearance: "auto" }}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>총 문제 수</label>
              <input
                type="number"
                value={formData.totalQuestions}
                onChange={(e) => setFormData({ ...formData, totalQuestions: Number(e.target.value) })}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                min={0}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="press"
            style={{
              marginTop: 20, padding: "12px 24px", background: JC.accent, color: "#fff",
              border: "none", borderRadius: 13, fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
              boxShadow: "none",
            }}
          >
            {submitting ? "생성 중..." : "퀴즈 세트 생성"}
          </button>
        </form>
      )}

      {/* 정렬 안내 */}
      <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 400, color: JC.sub }}>
        카테고리별로 화살표(▲▼)를 눌러 리스트 노출 순서를 바꿀 수 있어요. 변경 즉시 저장됩니다.
      </div>

      {/* Table — 넓어지면 가로 스크롤 */}
      <div style={{ ...cardStyle, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "center", width: 84 }}>정렬</th>
              <th style={thStyle}>제목</th>
              <th style={{ ...thStyle, textAlign: "center" }}>난이도</th>
              <th style={{ ...thStyle, textAlign: "center" }}>문제 수</th>
              <th style={{ ...thStyle, textAlign: "center" }}>인기</th>
              <th style={{ ...thStyle, textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {quizSets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 48, color: JC.sub }}>
                  등록된 OX 퀴즈 세트가 없습니다.
                </td>
              </tr>
            ) : (
              groupByCategory(quizSets).map((group) => (
                <Fragment key={group.catId}>
                  <tr>
                    <td colSpan={6} style={{ padding: "12px 16px", background: JC.accentBg, fontWeight: 700, color: JC.accent, fontSize: 13 }}>
                      {group.catIcon} {group.catName} <span style={{ color: JC.body, fontWeight: 600 }}>· {group.sets.length}개</span>
                    </td>
                  </tr>
                  {group.sets.map((set, index) => (
                    // 카테고리 안 마지막 행은 아래 구분선 없음(다음 카테고리 머리띠가 경계를 대신한다)
                    <tr key={set.id} style={{ borderBottom: index === group.sets.length - 1 ? "none" : `1px solid ${JC.soft}`, background: "var(--c-bg)" }}>
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
                          <button
                            type="button"
                            aria-label="위로"
                            disabled={index === 0 || reordering}
                            onClick={() => moveSet(group.catId, index, "up")}
                            style={{ width: 30, height: 24, borderRadius: 13, border: "none", background: JC.soft, color: index === 0 ? "#8A909C" : JC.body, cursor: index === 0 || reordering ? "default" : "pointer", lineHeight: 1, fontSize: 11 }}
                          >▲</button>
                          <button
                            type="button"
                            aria-label="아래로"
                            disabled={index === group.sets.length - 1 || reordering}
                            onClick={() => moveSet(group.catId, index, "down")}
                            style={{ width: 30, height: 24, borderRadius: 13, border: "none", background: JC.soft, color: index === group.sets.length - 1 ? "#8A909C" : JC.body, cursor: index === group.sets.length - 1 || reordering ? "default" : "pointer", lineHeight: 1, fontSize: 11 }}
                          >▼</button>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: JC.title }}>{set.title}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>{difficultyBadge(set.difficulty)}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700, color: JC.accent }}>{set.totalQuestions}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <button
                          onClick={async () => {
                            await fetch(`/api/ox-quiz/${set.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isPopular: !set.isPopular }),
                              credentials: "include",
                            });
                            fetchQuizSets();
                          }}
                          style={{
                            ...chipBase, border: "none", cursor: "pointer",
                            backgroundColor: set.isPopular ? JC.accentBg : JC.soft,
                            color: set.isPopular ? JC.accent : JC.body,
                          }}
                        >
                          {set.isPopular ? "인기" : "OFF"}
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            onClick={() => openQuestions(set)}
                            style={{ background: JC.accentBg, border: "none", borderRadius: 13, color: JC.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "7px 14px" }}
                          >
                            문제 관리
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`"${set.title}"을(를) 삭제하시겠습니까? 관련 문제와 기록도 모두 삭제됩니다.`)) return;
                              const res = await fetch(`/api/ox-quiz/${set.id}`, { method: "DELETE", credentials: "include" });
                              if (res.ok) fetchQuizSets();
                              else alert("삭제 실패");
                            }}
                            style={{ background: "var(--c-danger-soft)", border: "none", borderRadius: 13, color: "var(--c-danger-c)", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "7px 14px" }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Question Management Modal */}
      {selectedSet && (
        <div className="jc-q-overlay" style={{
          position: "fixed", inset: 0, background: "rgba(43,49,61,0.32)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
        }}>
          <div style={{
            ...cardStyle, width: "100%", maxWidth: 720,
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            {/* Modal Header */}
            <div className="jc-q-head" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: `1px solid ${JC.soft}`,
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: JC.title }}>{selectedSet.title}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: JC.sub }}>문제 관리</span>
                  {difficultyBadge(selectedSet.difficulty)}
                </div>
              </div>
              <button
                onClick={() => { setSelectedSet(null); setShowQuestionForm(false); }}
                style={{
                  background: JC.soft, border: "none", width: 32, height: 32,
                  borderRadius: 13, cursor: "pointer", fontSize: 18, color: JC.body,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="jc-q-body" style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: JC.body }}>총 <b style={{ color: JC.accent, fontWeight: 700 }}>{questions.length}</b>개 문제</p>
                <button
                  className="press"
                  onClick={() => {
                    const opening = !showQuestionForm;
                    setShowQuestionForm(opening);
                    if (opening) {
                      // 기본 섹션 = 현재 세트의 기존 소분류 → 그냥 추가하면 새 소분류가 안 생긴다.
                      setUseCustomSection(false);
                      setQuestionData({
                        question: "", answer: true, explanation: "",
                        section: existingSections[0] || "", order: "",
                        examYearMonth: "",
                      });
                    }
                  }}
                  style={{
                    padding: "9px 18px",
                    background: showQuestionForm ? JC.soft : JC.accent,
                    color: showQuestionForm ? JC.body : "#fff",
                    border: "none",
                    borderRadius: 13, fontSize: 13, fontWeight: showQuestionForm ? 600 : 700, cursor: "pointer",
                  }}
                >
                  {showQuestionForm ? "취소" : "+ 문제 추가"}
                </button>
              </div>

              {/* Add Question Form */}
              {showQuestionForm && (
                <form className="jc-q-form" onSubmit={handleAddQuestion} style={{
                  background: JC.soft, borderRadius: 13, padding: 20, marginBottom: 20,
                  border: "none",
                }}>
                  <div className="jc-q-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label style={labelStyle}>소분류(섹션)</label>
                      {useCustomSection ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            value={questionData.section}
                            onChange={(e) => setQuestionData({ ...questionData, section: e.target.value })}
                            style={inputStyle}
                            placeholder="새 소분류 이름"
                          />
                          <button
                            type="button"
                            onClick={() => { setUseCustomSection(false); setQuestionData({ ...questionData, section: existingSections[0] || "" }); }}
                            style={{ flexShrink: 0, padding: "0 14px", borderRadius: 13, border: "none", background: "var(--c-bg)", color: JC.body, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <select
                          value={questionData.section}
                          onChange={(e) => {
                            if (e.target.value === "__new__") { setUseCustomSection(true); setQuestionData({ ...questionData, section: "" }); }
                            else setQuestionData({ ...questionData, section: e.target.value });
                          }}
                          style={{ ...inputStyle, appearance: "auto" }}
                        >
                          {existingSections.map((s) => <option key={s} value={s}>{s}</option>)}
                          <option value="">(소분류 없음)</option>
                          <option value="__new__">+ 새 소분류 직접 입력</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>소분류 내 번호 위치</label>
                      <input
                        type="number"
                        min={1}
                        max={selectedSectionCount + 1}
                        value={questionData.order}
                        onChange={(e) => setQuestionData({ ...questionData, order: e.target.value })}
                        style={inputStyle}
                        placeholder={`맨 끝(${selectedSectionCount + 1}번)`}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 400, color: JC.sub, margin: "0 0 14px" }}>
                    기존 소분류를 고르면 새 소분류가 생기지 않습니다. 번호는 <b>그 소분류 안에서의 위치</b>이며, 지정한 자리에 삽입되고 그 소분류 뒤 문제들이 한 칸씩 밀립니다(비우면 그 소분류 맨 끝).
                  </p>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>질문</label>
                    <textarea
                      value={questionData.question}
                      onChange={(e) => setQuestionData({ ...questionData, question: e.target.value })}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                      rows={2}
                      required
                    />
                  </div>
                  <div className="jc-q-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>정답</label>
                      <select
                        value={questionData.answer ? "true" : "false"}
                        onChange={(e) => setQuestionData({ ...questionData, answer: e.target.value === "true" })}
                        style={{ ...inputStyle, appearance: "auto" }}
                      >
                        <option value="true">O (참)</option>
                        <option value="false">X (거짓)</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>해설</label>
                      {/* 해설은 여러 줄이 보통이라 한 줄 input 대신 넉넉한 textarea. */}
                      <textarea
                        className="jc-q-explain"
                        value={questionData.explanation}
                        onChange={(e) => setQuestionData({ ...questionData, explanation: e.target.value })}
                        rows={5}
                        placeholder="해설 입력"
                        style={{ ...inputStyle, resize: "vertical", minHeight: 130, lineHeight: 1.6 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>기출 출처 (선택)</label>
                    <input
                      type="text"
                      value={questionData.examYearMonth}
                      onChange={(e) => setQuestionData({ ...questionData, examYearMonth: e.target.value })}
                      style={inputStyle}
                      placeholder="예: 26학년도 6월"
                    />
                    <p style={{ fontSize: 12, fontWeight: 400, color: JC.sub, margin: "6px 0 0" }}>
                      정답률은 사용자 응답으로 자동 집계되어 표시됩니다(입력 불필요).
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="press"
                    style={{
                      padding: "11px 22px", background: JC.accent, color: "#fff",
                      border: "none", borderRadius: 13, fontSize: 13, fontWeight: 700,
                      cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
                      boxShadow: "none",
                    }}
                  >
                    {submitting ? "추가 중..." : "문제 추가"}
                  </button>
                </form>
              )}

              {/* Questions List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {questions.map((q, idx) => {
                  const prevSection = idx > 0 ? questions[idx - 1].section : undefined;
                  const showSectionHeader = q.section && q.section !== prevSection;
                  const sectionCount = q.section
                    ? questions.filter((x) => x.section === q.section).length
                    : 0;
                  return (
                  <div key={q.id}>
                  {showSectionHeader && (
                    <div style={{
                      marginTop: idx === 0 ? 0 : 14, marginBottom: 8,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ ...chipBase, fontSize: 13, background: JC.accentBg, color: JC.accent }}>
                        {q.section}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 400, color: JC.sub }}>{sectionCount}문항</span>
                    </div>
                  )}
                  <div style={{
                    background: "var(--c-bg)", borderRadius: 13, padding: "16px",
                    border: `1px solid ${JC.soft}`, boxShadow: "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: JC.body,
                        background: JC.soft, borderRadius: 999, padding: "3px 9px", marginTop: 2,
                      }}>
                        {q.order}
                      </span>
                      <div style={{ flex: 1 }}>
                        {editingQuestionId === q.id ? (
                          <div>
                            <label style={labelStyle}>섹션 (선택)</label>
                            <input
                              type="text"
                              value={editQSection}
                              onChange={(e) => setEditQSection(e.target.value)}
                              style={{ ...inputStyle, marginBottom: 10 }}
                              placeholder="예: 이론 윤리학"
                            />
                            <label style={labelStyle}>문제</label>
                            <textarea
                              value={editQText}
                              onChange={(e) => setEditQText(e.target.value)}
                              rows={2}
                              style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
                            />
                            <label style={labelStyle}>정답</label>
                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                              <button
                                type="button"
                                onClick={() => setEditQAnswer(true)}
                                style={{
                                  padding: "9px 22px", borderRadius: 13, border: "none",
                                  background: editQAnswer ? JC.accent : JC.soft,
                                  color: editQAnswer ? "#fff" : JC.body,
                                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                O
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditQAnswer(false)}
                                style={{
                                  padding: "9px 22px", borderRadius: 13, border: "none",
                                  background: !editQAnswer ? "var(--c-danger-c)" : JC.soft,
                                  color: !editQAnswer ? "#fff" : JC.body,
                                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                X
                              </button>
                            </div>
                            <label style={labelStyle}>해설</label>
                            <textarea
                              value={editQExplanation}
                              onChange={(e) => setEditQExplanation(e.target.value)}
                              rows={5}
                              style={{ ...inputStyle, resize: "vertical", minHeight: 130, lineHeight: 1.6, marginBottom: 10 }}
                              placeholder="해설 입력"
                            />
                            <label style={labelStyle}>기출 출처</label>
                            <input
                              type="text"
                              value={editQExamYearMonth}
                              onChange={(e) => setEditQExamYearMonth(e.target.value)}
                              style={{ ...inputStyle, marginBottom: 10 }}
                              placeholder="예: 26학년도 6월"
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!selectedSet) return;
                                  const res = await fetch(`/api/ox-quiz/${selectedSet.id}/questions/${q.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      question: editQText, answer: editQAnswer,
                                      explanation: editQExplanation || null,
                                      section: editQSection || null,
                                      examYearMonth: editQExamYearMonth || null,
                                    }),
                                    credentials: "include",
                                  });
                                  if (res.ok) {
                                    setEditingQuestionId(null);
                                    openQuestions(selectedSet);
                                  } else alert("저장 실패");
                                }}
                                style={{
                                  padding: "9px 18px", borderRadius: 13, border: "none",
                                  background: JC.accent, color: "#fff",
                                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingQuestionId(null)}
                                style={{
                                  padding: "9px 18px", borderRadius: 13, border: "none",
                                  background: JC.soft, color: JC.body,
                                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p style={{ fontSize: 14, fontWeight: 700, color: JC.title, marginBottom: 10 }}>{q.question}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {q.section && (
                                <span style={{ ...chipBase, fontSize: 11, background: JC.soft, color: JC.body }}>
                                  {q.section}
                                </span>
                              )}
                              <span style={{
                                ...chipBase,
                                background: q.answer ? JC.accentBg : "var(--c-danger-soft)",
                                color: q.answer ? JC.accent : "var(--c-danger-c)",
                              }}>
                                {q.answer ? "O (참)" : "X (거짓)"}
                              </span>
                              {q.examYearMonth && (
                                <span style={{ ...chipBase, fontSize: 11, background: JC.soft, color: JC.body }}>
                                  {q.examYearMonth}
                                </span>
                              )}
                              {q.answerRate != null && (
                                <span style={{ ...chipBase, fontSize: 11, background: JC.soft, color: JC.body }}>
                                  정답률 {q.answerRate}%
                                </span>
                              )}
                              {q.explanation && (
                                <span style={{ fontSize: 12, fontWeight: 400, color: JC.sub }}>해설: {q.explanation}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {editingQuestionId !== q.id && (
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              setEditingQuestionId(q.id);
                              setEditQText(q.question);
                              setEditQAnswer(q.answer);
                              setEditQExplanation(q.explanation || "");
                              setEditQSection(q.section || "");
                              setEditQExamYearMonth(q.examYearMonth || "");
                            }}
                            style={{
                              background: JC.accentBg, border: "none", borderRadius: 13,
                              color: JC.accent, fontSize: 12, fontWeight: 700,
                              cursor: "pointer", padding: "6px 12px",
                            }}
                          >
                            편집
                          </button>
                          <button
                            onClick={async () => {
                              if (!selectedSet) return;
                              if (!confirm(`${q.order}번 문제를 삭제하시겠습니까?`)) return;
                              const res = await fetch(`/api/ox-quiz/${selectedSet.id}/questions/${q.id}`, { method: "DELETE", credentials: "include" });
                              if (res.ok) {
                                openQuestions(selectedSet);
                                fetchQuizSets();
                              } else alert("삭제 실패");
                            }}
                            style={{
                              background: "var(--c-danger-soft)", border: "none", borderRadius: 13,
                              color: "var(--c-danger-c)", fontSize: 12, fontWeight: 600,
                              cursor: "pointer", padding: "6px 12px",
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                  );
                })}
                {questions.length === 0 && (
                  <p style={{ textAlign: "center", color: JC.sub, padding: 32, fontSize: 14 }}>등록된 문제가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{JC_FOCUS_CSS}</style>
    </div>
  );
}

/* 제이씨랩 자가견적(jaicylab.com/estimate) 톤.
   면=흰색, 보조면·경계=#F2F3F5, 강조=#EAF2FF/#3180F7, 그림자 없음. */
const JC = {
  soft: "var(--c-bg-muted-3)", // #F2F3F5
  accentBg: "var(--c-brand-soft-6)", // #EAF2FF
  title: "var(--c-text-2)", // #2B313D
  body: "var(--c-text-3c)", // #51535C
  sub: "#8A909C",
  accent: "#3180F7",
};

const cardStyle: React.CSSProperties = {
  background: "var(--c-bg)",
  borderRadius: 18,
  border: `1px solid ${JC.soft}`,
  boxShadow: "none",
};

const chipBase: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontWeight: 600,
  color: JC.sub,
  fontSize: 12,
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${JC.soft}`,
};

/* 인라인 style 로는 :focus 를 못 준다. 포커스 테두리만 클래스로 뺀다.
   page.tsx 는 default 외 named export 가 금지라 모듈 로컬 상수로 둔다. */
const JC_FOCUS_CSS = `
  .jc-admin input:focus,
  .jc-admin textarea:focus,
  .jc-admin select:focus { border-color: #3180F7 !important; }
  /* 모바일 문제 관리 모달: 여백 축소, 2열 그리드(소분류/번호·정답/해설)를 1열로, 해설칸 확대.
     인라인 style 이 기본값이라 !important 로 덮는다. 해설 16px 은 iOS 포커스 확대 방지. */
  @media (max-width: 768px) {
    .jc-admin .jc-q-overlay { padding: 6px !important; }
    .jc-admin .jc-q-head { padding: 12px 14px !important; }
    .jc-admin .jc-q-body { padding: 12px !important; }
    .jc-admin .jc-q-form { padding: 12px !important; margin-bottom: 14px !important; }
    .jc-admin .jc-q-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
    .jc-admin .jc-q-explain { min-height: 190px !important; font-size: 16px !important; }
  }
`;
