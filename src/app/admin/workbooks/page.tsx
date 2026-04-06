"use client";

import { useEffect, useState, useRef } from "react";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Workbook {
  id: string;
  title: string;
  categoryId: string;
  totalQuestions: number;
  questionPerPage: number;
  isPopular: boolean;
  createdAt: string;
  category: Category;
}

interface Problem {
  id: string;
  order: number;
  passageImage: string | null;
  questionImage: string | null;
  questionText: string | null;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  choice5: string;
  answer: number;
  explanation: string | null;
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "업로드 실패");
  }
  const data = await res.json();
  return data.url;
}

function isImageUrl(str: string) {
  return str.startsWith("http://") || str.startsWith("https://");
}

export default function WorkbookManagement() {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    totalQuestions: 0,
    questionPerPage: 12,
  });
  const [submitting, setSubmitting] = useState(false);

  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showProblemForm, setShowProblemForm] = useState(false);

  // Problem form state
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [questionPreview, setQuestionPreview] = useState<string | null>(null);
  const [choicesFile, setChoicesFile] = useState<File | null>(null);
  const [choicesPreview, setChoicesPreview] = useState<string | null>(null);
  const [answer, setAnswer] = useState(1);
  const [explanation, setExplanation] = useState("");
  const [uploading, setUploading] = useState(false);

  const questionInputRef = useRef<HTMLInputElement>(null);
  const choicesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWorkbooks();
    fetchCategories();
  }, []);

  const fetchWorkbooks = async () => {
    const res = await fetch("/api/workbooks", { credentials: "include" });
    const data = await res.json();
    setWorkbooks(data.workbooks || []);
  };

  const fetchCategories = async () => {
    const res = await fetch("/api/categories", { credentials: "include" });
    const data = await res.json();
    setCategories((data.categories || []).filter((c: Category) => c.name !== "전체"));
  };

  const handleCreateWorkbook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/workbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: "", categoryId: "", totalQuestions: 0, questionPerPage: 12 });
        fetchWorkbooks();
      } else {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openProblems = async (wb: Workbook) => {
    setSelectedWorkbook(wb);
    const res = await fetch(`/api/workbooks/${wb.id}/problems`, { credentials: "include" });
    const data = await res.json();
    setProblems(data.problems || []);
  };

  const resetProblemForm = () => {
    setQuestionFile(null);
    setQuestionPreview(null);
    setChoicesFile(null);
    setChoicesPreview(null);
    setAnswer(1);
    setExplanation("");
  };

  const handleFileSelect = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkbook) return;

    if (!questionFile) {
      alert("문제 이미지를 등록해주세요.");
      return;
    }
    if (!choicesFile) {
      alert("선택지 이미지를 등록해주세요.");
      return;
    }

    setUploading(true);
    try {
      const [questionUrl, choicesUrl] = await Promise.all([
        uploadImage(questionFile),
        uploadImage(choicesFile),
      ]);

      const res = await fetch(`/api/workbooks/${selectedWorkbook.id}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionImage: questionUrl,
          choicesImage: choicesUrl,
          answer: Number(answer),
          explanation: explanation || null,
        }),
        credentials: "include",
      });

      if (res.ok) {
        setShowProblemForm(false);
        resetProblemForm();
        openProblems(selectedWorkbook);
        fetchWorkbooks();
      } else {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
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

  const imageDropStyle: React.CSSProperties = {
    border: "2px dashed #D1D5DB",
    borderRadius: 12,
    padding: 20,
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    background: "#FAFBFC",
  };

  const imagePreviewStyle: React.CSSProperties = {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #E5E7EB",
  };

  // 단일 이미지 선택지 모드인지 확인
  const isSingleImageChoices = (p: Problem) => {
    return isImageUrl(p.choice1) && p.choice2 === "_" && p.choice3 === "_" && p.choice4 === "_";
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#2B313D" }}>문제집 관리</h1>
          <p style={{ fontSize: 14, color: "#8A909C", marginTop: 4 }}>총 {workbooks.length}개의 문제집</p>
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
          {showForm ? "취소" : "+ 문제집 추가"}
        </button>
      </div>

      {/* Create Workbook Form */}
      {showForm && (
        <form onSubmit={handleCreateWorkbook} style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #E5E7EB",
          padding: 24,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#2B313D", marginBottom: 20 }}>새 문제집</h3>
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
            <div>
              <label style={labelStyle}>페이지당 문제 수</label>
              <input
                type="number"
                value={formData.questionPerPage}
                onChange={(e) => setFormData({ ...formData, questionPerPage: Number(e.target.value) })}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                min={1}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="press"
            style={{
              marginTop: 20,
              padding: "10px 24px",
              background: "#3787FF",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "생성 중..." : "문제집 생성"}
          </button>
        </form>
      )}

      {/* Workbooks Table */}
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #E5E7EB",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>제목</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>카테고리</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>문제 수</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>페이지당</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>인기</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {workbooks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 48, color: "#8A909C" }}>
                  등록된 문제집이 없습니다.
                </td>
              </tr>
            ) : (
              workbooks.map((wb, idx) => (
                <tr
                  key={wb.id}
                  style={{
                    borderBottom: "1px solid #F3F4F6",
                    background: idx % 2 === 1 ? "#FAFBFC" : "#fff",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F5F7FA"}
                  onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 1 ? "#FAFBFC" : "#fff"}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#2B313D" }}>{wb.title}</td>
                  <td style={{ padding: "14px 16px", color: "#8A909C" }}>
                    {wb.category.icon} {wb.category.name}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#2B313D" }}>{wb.totalQuestions}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#2B313D" }}>{wb.questionPerPage}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={async () => {
                        await fetch(`/api/workbooks/${wb.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isPopular: !wb.isPopular }),
                          credentials: "include",
                        });
                        fetchWorkbooks();
                      }}
                      style={{
                        padding: "4px 12px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        backgroundColor: wb.isPopular ? "#FF3B5C" : "#F3F4F6",
                        color: wb.isPopular ? "#fff" : "#9CA3AF",
                        transition: "all 0.15s",
                      }}
                    >
                      {wb.isPopular ? "인기" : "OFF"}
                    </button>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => openProblems(wb)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#3787FF",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "4px 8px",
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

      {/* Problem Management Modal */}
      {selectedWorkbook && (
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
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#2B313D" }}>
                  {selectedWorkbook.title}
                </h3>
                <p style={{ fontSize: 13, color: "#8A909C", marginTop: 2 }}>문제 관리</p>
              </div>
              <button
                onClick={() => { setSelectedWorkbook(null); setShowProblemForm(false); resetProblemForm(); }}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: "#8A909C" }}>총 {problems.length}개 문제</p>
                <button
                  className="press"
                  onClick={() => { setShowProblemForm(!showProblemForm); if (showProblemForm) resetProblemForm(); }}
                  style={{
                    padding: "8px 16px",
                    background: showProblemForm ? "#fff" : "#3787FF",
                    color: showProblemForm ? "#2B313D" : "#fff",
                    border: showProblemForm ? "1px solid #E5E7EB" : "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {showProblemForm ? "취소" : "+ 문제 추가"}
                </button>
              </div>

              {/* Add Problem Form */}
              {showProblemForm && (
                <form onSubmit={handleAddProblem} style={{
                  background: "#F9FAFB", borderRadius: 12, padding: 24, marginBottom: 20,
                  border: "1px solid #E5E7EB",
                }}>
                  {/* 문제 이미지 */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>
                      문제 이미지 <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    {questionPreview ? (
                      <div style={imagePreviewStyle}>
                        <img src={questionPreview} alt="문제" style={{ width: "100%", display: "block" }} />
                        <button
                          type="button"
                          onClick={() => { setQuestionFile(null); setQuestionPreview(null); }}
                          style={{
                            position: "absolute", top: 8, right: 8, width: 28, height: 28,
                            borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff",
                            border: "none", cursor: "pointer", fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <div
                        style={imageDropStyle}
                        onClick={() => questionInputRef.current?.click()}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3787FF"; e.currentTarget.style.background = "#EBF3FF"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#FAFBFC"; }}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px" }}>
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="#9CA3AF" strokeWidth="1.5"/>
                          <circle cx="8.5" cy="8.5" r="2" stroke="#9CA3AF" strokeWidth="1.5"/>
                          <path d="M3 16L8 11L13 16" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M13 14L16 11L21 16" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <p style={{ fontSize: 13, color: "#8A909C", fontWeight: 500 }}>클릭하여 문제 이미지를 업로드하세요</p>
                        <p style={{ fontSize: 11, color: "#B0B5BD", marginTop: 4 }}>PNG, JPG, WEBP (최대 10MB)</p>
                      </div>
                    )}
                    <input
                      ref={questionInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileSelect(e.target.files?.[0], setQuestionFile, setQuestionPreview)}
                    />
                  </div>

                  {/* 선택지 이미지 */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>
                      선택지 이미지 <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    {choicesPreview ? (
                      <div style={imagePreviewStyle}>
                        <img src={choicesPreview} alt="선택지" style={{ width: "100%", display: "block" }} />
                        <button
                          type="button"
                          onClick={() => { setChoicesFile(null); setChoicesPreview(null); }}
                          style={{
                            position: "absolute", top: 8, right: 8, width: 28, height: 28,
                            borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff",
                            border: "none", cursor: "pointer", fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <div
                        style={imageDropStyle}
                        onClick={() => choicesInputRef.current?.click()}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3787FF"; e.currentTarget.style.background = "#EBF3FF"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#FAFBFC"; }}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px" }}>
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="#9CA3AF" strokeWidth="1.5"/>
                          <path d="M7 8H17M7 12H17M7 16H13" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p style={{ fontSize: 13, color: "#8A909C", fontWeight: 500 }}>클릭하여 선택지 이미지를 업로드하세요</p>
                        <p style={{ fontSize: 11, color: "#B0B5BD", marginTop: 4 }}>1~5번 선택지가 포함된 하나의 이미지</p>
                      </div>
                    )}
                    <input
                      ref={choicesInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileSelect(e.target.files?.[0], setChoicesFile, setChoicesPreview)}
                    />
                  </div>

                  {/* 정답 & 해설 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>정답 번호 <span style={{ color: "#EF4444" }}>*</span></label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswer(n)}
                            style={{
                              width: 40, height: 40, borderRadius: 10,
                              border: `2px solid ${answer === n ? "#3787FF" : "#E5E7EB"}`,
                              background: answer === n ? "#3787FF" : "#fff",
                              color: answer === n ? "#fff" : "#2B313D",
                              fontSize: 15, fontWeight: 700, cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>해설 <span style={{ color: "#8A909C", fontWeight: 400 }}>선택</span></label>
                      <input
                        type="text"
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                        placeholder="해설을 입력하세요"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="press"
                    style={{
                      padding: "10px 24px",
                      background: "#3787FF",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: uploading ? "not-allowed" : "pointer",
                      opacity: uploading ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {uploading && (
                      <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    )}
                    {uploading ? "업로드 중..." : "문제 추가"}
                  </button>
                  {uploading && <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>}
                </form>
              )}

              {/* Problems List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {problems.map((p) => (
                  <div key={p.id} style={{
                    background: "#fff", borderRadius: 12, padding: 16,
                    border: "1px solid #E5E7EB",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#fff",
                        background: "#3787FF", borderRadius: 6, padding: "3px 8px", marginTop: 2,
                        flexShrink: 0,
                      }}>
                        {p.order}번
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 문제 이미지 */}
                        {p.questionImage && (
                          <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", border: "1px solid #F3F4F6" }}>
                            <img src={p.questionImage} alt="문제" style={{ width: "100%", display: "block", background: "#F9FAFB" }} />
                          </div>
                        )}
                        {/* 본문 이미지 (레거시) */}
                        {p.passageImage && !p.questionImage && (
                          <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", border: "1px solid #F3F4F6" }}>
                            <img src={p.passageImage} alt="본문" style={{ width: "100%", display: "block", background: "#F9FAFB" }} />
                          </div>
                        )}
                        {/* 문제 텍스트 (레거시) */}
                        {p.questionText && (
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#2B313D", marginBottom: 8 }}>{p.questionText}</p>
                        )}
                        {/* 선택지 */}
                        {isSingleImageChoices(p) ? (
                          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                            <img src={p.choice1} alt="선택지" style={{ width: "100%", display: "block", background: "#F9FAFB" }} />
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {[p.choice1, p.choice2, p.choice3, p.choice4, p.choice5]
                              .filter((c) => c && c !== "_")
                              .map((c, i) => {
                                const isAnswer = i + 1 === p.answer;
                                return (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: 12,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      background: isAnswer ? "#3787FF" : "#fff",
                                      color: isAnswer ? "#fff" : "#8A909C",
                                      border: isAnswer ? "none" : "1px solid #E5E7EB",
                                    }}
                                  >
                                    {i + 1}. {c}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                        {/* 정답 표시 */}
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600, color: "#3787FF",
                            background: "#EBF3FF", borderRadius: 4, padding: "2px 8px",
                          }}>
                            정답: {p.answer}번
                          </span>
                          {p.explanation && (
                            <span style={{ fontSize: 12, color: "#8A909C" }}>해설: {p.explanation}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {problems.length === 0 && (
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
