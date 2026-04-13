"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface VocabQuizSet {
  id: string;
  title: string;
  categoryId: string;
  difficulty: string;
  totalQuestions: number;
  isPopular: boolean;
  createdAt: string;
  category: Category;
}

interface VocabQuestion {
  id: string;
  order: number;
  word: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  answer: number;
  explanation: string | null;
}

const DIFFICULTIES = ["쉬움", "보통", "어려움"];

export default function VocabQuizManagement() {
  const [quizSets, setQuizSets] = useState<VocabQuizSet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    difficulty: "보통",
    totalQuestions: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const [selectedSet, setSelectedSet] = useState<VocabQuizSet | null>(null);
  const [questions, setQuestions] = useState<VocabQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ word: string; correct: string; wrong1: string; wrong2: string; wrong3: string }[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [questionData, setQuestionData] = useState({
    word: "",
    choice1: "",
    choice2: "",
    choice3: "",
    choice4: "",
    answer: 1,
    explanation: "",
  });

  useEffect(() => {
    fetchQuizSets();
    fetchCategories();
  }, []);

  const fetchQuizSets = async () => {
    const res = await fetch("/api/vocab-quiz", { credentials: "include" });
    const data = await res.json();
    setQuizSets(data.vocabQuizSets || []);
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
      const res = await fetch("/api/vocab-quiz", {
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

  const openQuestions = async (set: VocabQuizSet) => {
    setSelectedSet(set);
    const res = await fetch(`/api/vocab-quiz/${set.id}/questions`, { credentials: "include" });
    const data = await res.json();
    setQuestions(data.questions || []);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSet) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vocab-quiz/${selectedSet.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...questionData,
          answer: Number(questionData.answer),
        }),
        credentials: "include",
      });
      if (res.ok) {
        setShowQuestionForm(false);
        setQuestionData({
          word: "",
          choice1: "",
          choice2: "",
          choice3: "",
          choice4: "",
          answer: 1,
          explanation: "",
        });
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];

        // 헤더 행(첫 번째 행) 제외, 빈 행 제거
        const words = rows
          .slice(1)
          .filter((row) => row[1] && row[2])
          .map((row) => ({
            word: String(row[1] ?? "").trim(),
            correct: String(row[2] ?? "").trim(),
            wrong1: String(row[3] ?? "").trim(),
            wrong2: String(row[4] ?? "").trim(),
            wrong3: String(row[5] ?? "").trim(),
          }))
          .filter((w) => w.word && w.correct && w.wrong1 && w.wrong2 && w.wrong3);

        setImportPreview(words);
      } catch {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkImport = async () => {
    if (!selectedSet || !importPreview) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/vocab-quiz/${selectedSet.id}/bulk-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: importPreview }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.inserted}개의 단어를 성공적으로 가져왔습니다.`);
        setImportPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        openQuestions(selectedSet);
        fetchQuizSets();
      } else {
        alert(data.error || "오류가 발생했습니다.");
      }
    } finally {
      setImporting(false);
    }
  };

  const difficultyBadge = (d: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      "쉬움": { bg: "#ECFDF5", text: "#059669" },
      "보통": { bg: "#FFFBEB", text: "#D97706" },
      "어려움": { bg: "#FEF2F2", text: "#DC2626" },
    };
    const c = colors[d] || colors["보통"];
    return (
      <span style={{
        display: "inline-block", padding: "3px 10px", borderRadius: 20,
        fontSize: 12, fontWeight: 600, background: c.bg, color: c.text,
      }}>
        {d}
      </span>
    );
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #E5E7EB",
    fontSize: 14,
    color: "#2B313D",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#2B313D",
    marginBottom: 6,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#2B313D" }}>영단어 퀴즈 관리</h1>
          <p style={{ fontSize: 14, color: "#8A909C", marginTop: 4 }}>총 {quizSets.length}개의 퀴즈 세트</p>
        </div>
        <button
          className="press"
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 20px",
            background: showForm ? "#fff" : "#3787FF",
            color: showForm ? "#2B313D" : "#fff",
            border: showForm ? "1px solid #E5E7EB" : "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showForm ? "취소" : "+ 퀴즈 세트 추가"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreateSet} style={{
          background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB",
          padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#2B313D", marginBottom: 20 }}>새 영단어 퀴즈 세트</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>카테고리</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                style={{ ...inputStyle, appearance: "auto" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
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
                onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                min={0}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="press"
            style={{
              marginTop: 20, padding: "10px 24px", background: "#3787FF", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "생성 중..." : "퀴즈 세트 생성"}
          </button>
        </form>
      )}

      {/* Table */}
      <div style={{
        background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB",
        overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>제목</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>카테고리</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>난이도</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>문제 수</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>인기</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {quizSets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 48, color: "#8A909C" }}>
                  등록된 영단어 퀴즈 세트가 없습니다.
                </td>
              </tr>
            ) : (
              quizSets.map((set, idx) => (
                <tr
                  key={set.id}
                  style={{
                    borderBottom: "1px solid #F3F4F6",
                    background: idx % 2 === 1 ? "#FAFBFC" : "#fff",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F5F7FA"}
                  onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 1 ? "#FAFBFC" : "#fff"}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#2B313D" }}>{set.title}</td>
                  <td style={{ padding: "14px 16px", color: "#8A909C" }}>
                    {set.category.icon} {set.category.name}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>{difficultyBadge(set.difficulty)}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#2B313D" }}>{set.totalQuestions}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={async () => {
                        await fetch(`/api/vocab-quiz/${set.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isPopular: !set.isPopular }),
                          credentials: "include",
                        });
                        fetchQuizSets();
                      }}
                      style={{
                        padding: "4px 12px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        backgroundColor: set.isPopular ? "#FF3B5C" : "#F3F4F6",
                        color: set.isPopular ? "#fff" : "#9CA3AF",
                        transition: "all 0.15s",
                      }}
                    >
                      {set.isPopular ? "인기" : "OFF"}
                    </button>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => openQuestions(set)}
                      style={{
                        background: "none", border: "none", color: "#3787FF",
                        fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "4px 8px",
                      }}
                    >
                      문제 관리
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Question Management Modal */}
      {selectedSet && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720,
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: "1px solid #E5E7EB",
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#2B313D" }}>{selectedSet.title}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "#8A909C" }}>문제 관리</span>
                  {difficultyBadge(selectedSet.difficulty)}
                </div>
              </div>
              <button
                onClick={() => { setSelectedSet(null); setShowQuestionForm(false); }}
                style={{
                  background: "#F3F4F6", border: "none", width: 32, height: 32,
                  borderRadius: 8, cursor: "pointer", fontSize: 18, color: "#8A909C",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <p style={{ fontSize: 14, color: "#8A909C" }}>총 {questions.length}개 문제</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* Excel 일괄 가져오기 */}
                  <label
                    style={{
                      padding: "8px 16px",
                      background: "#10B981",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      display: "inline-block",
                    }}
                  >
                    📥 Excel 가져오기
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button
                    className="press"
                    onClick={() => setShowQuestionForm(!showQuestionForm)}
                    style={{
                      padding: "8px 16px",
                      background: showQuestionForm ? "#fff" : "#3787FF",
                      color: showQuestionForm ? "#2B313D" : "#fff",
                      border: showQuestionForm ? "1px solid #E5E7EB" : "none",
                      borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {showQuestionForm ? "취소" : "+ 문제 추가"}
                  </button>
                </div>
              </div>

              {/* Excel 미리보기 */}
              {importPreview && (
                <div style={{
                  background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: 12,
                  padding: 16, marginBottom: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#065F46" }}>
                      📊 {importPreview.length}개 단어 감지됨 — 가져오기 전 확인하세요
                    </p>
                    <button
                      onClick={() => { setImportPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 18 }}
                    >
                      &times;
                    </button>
                  </div>
                  {/* 미리보기 최대 5개 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {importPreview.slice(0, 5).map((w, i) => (
                      <div key={i} style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, border: "1px solid #D1FAE5" }}>
                        <span style={{ fontWeight: 700, color: "#2B313D" }}>{w.word}</span>
                        <span style={{ color: "#10B981", marginLeft: 8 }}>{w.correct}</span>
                        <span style={{ color: "#9CA3AF", marginLeft: 8 }}>/ {w.wrong1} / {w.wrong2} / {w.wrong3}</span>
                      </div>
                    ))}
                    {importPreview.length > 5 && (
                      <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>... 외 {importPreview.length - 5}개</p>
                    )}
                  </div>
                  <button
                    onClick={handleBulkImport}
                    disabled={importing}
                    className="press"
                    style={{
                      padding: "9px 20px", background: "#10B981", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1,
                    }}
                  >
                    {importing ? "가져오는 중..." : `${importPreview.length}개 단어 일괄 추가`}
                  </button>
                </div>
              )}

              {/* Add Question Form */}
              {showQuestionForm && (
                <form onSubmit={handleAddQuestion} style={{
                  background: "#F9FAFB", borderRadius: 12, padding: 20, marginBottom: 20,
                  border: "1px solid #E5E7EB",
                }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>단어</label>
                    <input
                      type="text"
                      value={questionData.word}
                      onChange={(e) => setQuestionData({ ...questionData, word: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                      required
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n}>
                        <label style={labelStyle}>선택지 {n}</label>
                        <input
                          type="text"
                          value={questionData[`choice${n}` as keyof typeof questionData] as string}
                          onChange={(e) => setQuestionData({ ...questionData, [`choice${n}`]: e.target.value })}
                          style={inputStyle}
                          onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                          required
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>정답 (1-4)</label>
                      <select
                        value={questionData.answer}
                        onChange={(e) => setQuestionData({ ...questionData, answer: Number(e.target.value) })}
                        style={{ ...inputStyle, appearance: "auto" }}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n}번</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>해설</label>
                      <input
                        type="text"
                        value={questionData.explanation}
                        onChange={(e) => setQuestionData({ ...questionData, explanation: e.target.value })}
                        style={inputStyle}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="press"
                    style={{
                      padding: "9px 20px", background: "#3787FF", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? "추가 중..." : "문제 추가"}
                  </button>
                </form>
              )}

              {/* Questions List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {questions.map((q) => (
                  <div key={q.id} style={{
                    background: "#F9FAFB", borderRadius: 10, padding: "14px 16px",
                    border: "1px solid #F3F4F6",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#8A909C",
                        background: "#E5E7EB", borderRadius: 4, padding: "2px 6px", marginTop: 2,
                      }}>
                        {q.order}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#2B313D", marginBottom: 8 }}>{q.word}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                          {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 12,
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: i + 1 === q.answer ? "#3787FF" : "#fff",
                                color: i + 1 === q.answer ? "#fff" : "#8A909C",
                                border: i + 1 === q.answer ? "none" : "1px solid #E5E7EB",
                              }}
                            >
                              {i + 1}. {c}
                            </span>
                          ))}
                        </div>
                        {q.explanation && (
                          <p style={{ fontSize: 12, color: "#8A909C", marginTop: 8 }}>해설: {q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p style={{ textAlign: "center", color: "#8A909C", padding: 32, fontSize: 14 }}>등록된 문제가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
