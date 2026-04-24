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
  thumbnail: string | null;
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
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [editingWorkbookId, setEditingWorkbookId] = useState<string | null>(null);
  const [editWbData, setEditWbData] = useState({ title: "", categoryId: "" });
  const [editWbThumbFile, setEditWbThumbFile] = useState<File | null>(null);
  const [editWbThumbPreview, setEditWbThumbPreview] = useState<string | null>(null);
  const editWbThumbInputRef = useRef<HTMLInputElement>(null);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState(1);
  const [editExplanation, setEditExplanation] = useState("");

  // Problem form state
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [questionPreview, setQuestionPreview] = useState<string | null>(null);
  const [questionUrl, setQuestionUrl] = useState<string | null>(null);
  const [choicesFile, setChoicesFile] = useState<File | null>(null);
  const [choicesPreview, setChoicesPreview] = useState<string | null>(null);
  const [choicesUrl, setChoicesUrl] = useState<string | null>(null);
  const [answer, setAnswer] = useState(1);
  const [explanation, setExplanation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const questionInputRef = useRef<HTMLInputElement>(null);
  const choicesInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

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
      let thumbnailUrl: string | undefined;
      if (thumbnailFile) {
        thumbnailUrl = await uploadImage(thumbnailFile);
      }
      const res = await fetch("/api/workbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, thumbnail: thumbnailUrl }),
        credentials: "include",
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: "", categoryId: "" });
        setThumbnailFile(null);
        setThumbnailPreview(null);
        fetchWorkbooks();
      } else {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("썸네일 업로드 중 오류가 발생했습니다.");
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
    setQuestionUrl(null);
    setChoicesFile(null);
    setChoicesPreview(null);
    setChoicesUrl(null);
    setAnswer(1);
    setExplanation("");
  };

  const generateAIExplanation = async () => {
    if (!questionFile || !choicesFile) {
      alert("AI 해설을 위해 먼저 문제 이미지와 선택지 이미지를 선택해주세요.");
      return;
    }
    setGeneratingAI(true);
    try {
      // 이미지를 먼저 업로드 (재사용 가능하도록 state에 저장)
      let qUrl = questionUrl;
      let cUrl = choicesUrl;
      if (!qUrl) {
        qUrl = await uploadImage(questionFile);
        setQuestionUrl(qUrl);
      }
      if (!cUrl) {
        cUrl = await uploadImage(choicesFile);
        setChoicesUrl(cUrl);
      }

      const res = await fetch("/api/admin/ai-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionImage: qUrl, choicesImage: cUrl, answer: Number(answer) }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 해설 생성 실패");
      setExplanation(data.explanation || "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "AI 해설 생성 실패");
    } finally {
      setGeneratingAI(false);
    }
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
      const qUrl = questionUrl ?? (await uploadImage(questionFile));
      const cUrl = choicesUrl ?? (await uploadImage(choicesFile));

      const res = await fetch(`/api/workbooks/${selectedWorkbook.id}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionImage: qUrl,
          choicesImage: cUrl,
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
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
          </div>

          {/* Thumbnail */}
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>썸네일 <span style={{ color: "#8A909C", fontWeight: 400 }}>선택</span></label>
            {thumbnailPreview ? (
              <div style={{ position: "relative", width: 180, borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                <img src={thumbnailPreview} alt="썸네일" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                <button
                  type="button"
                  onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
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
                style={{ ...imageDropStyle, width: 180, padding: 24 }}
                onClick={() => thumbnailInputRef.current?.click()}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3787FF"; e.currentTarget.style.background = "#EBF3FF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#FAFBFC"; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 6px" }}>
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#9CA3AF" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="2" stroke="#9CA3AF" strokeWidth="1.5"/>
                  <path d="M3 16L8 11L13 16M13 14L16 11L21 16" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ fontSize: 12, color: "#8A909C", fontWeight: 500 }}>썸네일 업로드</p>
              </div>
            )}
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFileSelect(e.target.files?.[0], setThumbnailFile, setThumbnailPreview)}
            />
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
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>인기</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#8A909C", fontSize: 13 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {workbooks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 48, color: "#8A909C" }}>
                  등록된 문제집이 없습니다.
                </td>
              </tr>
            ) : (
              workbooks.map((wb, idx) => {
                const isEditing = editingWorkbookId === wb.id;
                return (
                <tr
                  key={wb.id}
                  style={{
                    borderBottom: "1px solid #F3F4F6",
                    background: isEditing ? "#EBF3FF" : idx % 2 === 1 ? "#FAFBFC" : "#fff",
                    transition: "background 0.15s",
                  }}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#2B313D" }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editWbData.title}
                        onChange={(e) => setEditWbData({ ...editWbData, title: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 10px" }}
                      />
                    ) : wb.title}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#8A909C" }}>
                    {isEditing ? (
                      <select
                        value={editWbData.categoryId}
                        onChange={(e) => setEditWbData({ ...editWbData, categoryId: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 10px", appearance: "auto" }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <>{wb.category.icon} {wb.category.name}</>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#2B313D" }}>{wb.totalQuestions}</td>
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
                    {isEditing ? (
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => editWbThumbInputRef.current?.click()}
                          style={{
                            padding: "4px 10px", borderRadius: 6,
                            background: "#F3F4F6", border: "1px solid #E5E7EB",
                            color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          {editWbThumbFile ? "변경됨" : "썸네일"}
                        </button>
                        <button
                          onClick={async () => {
                            let thumbUrl: string | undefined;
                            if (editWbThumbFile) {
                              thumbUrl = await uploadImage(editWbThumbFile);
                            }
                            const body: Record<string, unknown> = {
                              title: editWbData.title,
                              categoryId: editWbData.categoryId,
                            };
                            if (thumbUrl) body.thumbnail = thumbUrl;
                            const res = await fetch(`/api/workbooks/${wb.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(body),
                              credentials: "include",
                            });
                            if (res.ok) {
                              setEditingWorkbookId(null);
                              setEditWbThumbFile(null);
                              setEditWbThumbPreview(null);
                              fetchWorkbooks();
                            } else alert("저장 실패");
                          }}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: "none",
                            background: "#3787FF", color: "#fff",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => {
                            setEditingWorkbookId(null);
                            setEditWbThumbFile(null);
                            setEditWbThumbPreview(null);
                          }}
                          style={{
                            padding: "4px 10px", borderRadius: 6,
                            background: "none", border: "1px solid #E5E7EB",
                            color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button
                          onClick={() => openProblems(wb)}
                          style={{
                            background: "none", border: "none",
                            color: "#3787FF", fontWeight: 600, fontSize: 13,
                            cursor: "pointer", padding: "4px 8px",
                          }}
                        >
                          문제 관리
                        </button>
                        <button
                          onClick={() => {
                            setEditingWorkbookId(wb.id);
                            setEditWbData({ title: wb.title, categoryId: wb.categoryId });
                            setEditWbThumbFile(null);
                            setEditWbThumbPreview(null);
                          }}
                          style={{
                            background: "none", border: "none",
                            color: "#3787FF", fontWeight: 600, fontSize: 13,
                            cursor: "pointer", padding: "4px 8px",
                          }}
                        >
                          편집
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`"${wb.title}" 문제집을 삭제하시겠습니까? 관련 문제와 풀이 기록도 모두 삭제됩니다.`)) return;
                            const res = await fetch(`/api/workbooks/${wb.id}`, { method: "DELETE", credentials: "include" });
                            if (res.ok) fetchWorkbooks();
                            else alert("삭제 실패");
                          }}
                          style={{
                            background: "none", border: "none",
                            color: "#EF4444", fontWeight: 600, fontSize: 13,
                            cursor: "pointer", padding: "4px 8px",
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Hidden input for workbook edit thumbnail */}
      <input
        ref={editWbThumbInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFileSelect(e.target.files?.[0], setEditWbThumbFile, setEditWbThumbPreview)}
      />

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

                  {/* 정답 */}
                  <div style={{ marginBottom: 16 }}>
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

                  {/* 해설 */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>
                        해설 <span style={{ color: "#8A909C", fontWeight: 400 }}>선택</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateAIExplanation}
                        disabled={generatingAI || !questionFile || !choicesFile}
                        className="press"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 8, border: "none",
                          background: (generatingAI || !questionFile || !choicesFile) ? "#E5E7EB" : "linear-gradient(135deg, #3787FF, #7B5BFF)",
                          color: (generatingAI || !questionFile || !choicesFile) ? "#9CA3AF" : "#fff",
                          fontSize: 12, fontWeight: 700,
                          cursor: (generatingAI || !questionFile || !choicesFile) ? "not-allowed" : "pointer",
                        }}
                      >
                        {generatingAI ? (
                          <>
                            <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "aiSpin 0.8s linear infinite" }} />
                            <style>{`@keyframes aiSpin { to { transform: rotate(360deg); } }`}</style>
                            생성 중
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 10, fontWeight: 800 }}>AI</span>
                            해설 자동 생성
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#3787FF"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                      placeholder="해설을 직접 입력하거나 AI 해설 자동 생성 버튼을 눌러주세요"
                    />
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
                      <button
                        onClick={async () => {
                          if (!selectedWorkbook) return;
                          if (!confirm(`${p.order}번 문제를 삭제하시겠습니까?`)) return;
                          const res = await fetch(`/api/workbooks/${selectedWorkbook.id}/problems/${p.id}`, { method: "DELETE", credentials: "include" });
                          if (res.ok) {
                            openProblems(selectedWorkbook);
                            fetchWorkbooks();
                          } else alert("삭제 실패");
                        }}
                        style={{
                          background: "none", border: "none",
                          color: "#EF4444", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", padding: "2px 8px", marginLeft: "auto",
                          flexShrink: 0, order: 2,
                        }}
                      >
                        삭제
                      </button>
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
                        {editingProblemId === p.id ? (
                          <div style={{ marginTop: 12, padding: 12, background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                            <label style={labelStyle}>정답 번호</label>
                            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setEditAnswer(n)}
                                  style={{
                                    width: 36, height: 36, borderRadius: 8,
                                    border: `2px solid ${editAnswer === n ? "#3787FF" : "#E5E7EB"}`,
                                    background: editAnswer === n ? "#3787FF" : "#fff",
                                    color: editAnswer === n ? "#fff" : "#2B313D",
                                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                                  }}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                            <label style={labelStyle}>해설</label>
                            <textarea
                              value={editExplanation}
                              onChange={(e) => setEditExplanation(e.target.value)}
                              rows={3}
                              style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
                              placeholder="해설 입력"
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!selectedWorkbook) return;
                                  const res = await fetch(`/api/workbooks/${selectedWorkbook.id}/problems/${p.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ answer: editAnswer, explanation: editExplanation || null }),
                                    credentials: "include",
                                  });
                                  if (res.ok) {
                                    setEditingProblemId(null);
                                    openProblems(selectedWorkbook);
                                  } else alert("저장 실패");
                                }}
                                style={{
                                  padding: "8px 16px", borderRadius: 6, border: "none",
                                  background: "#3787FF", color: "#fff",
                                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProblemId(null)}
                                style={{
                                  padding: "8px 16px", borderRadius: 6,
                                  border: "1px solid #E5E7EB", background: "#fff",
                                  color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
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
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProblemId(p.id);
                                setEditAnswer(p.answer);
                                setEditExplanation(p.explanation || "");
                              }}
                              style={{
                                marginLeft: "auto",
                                background: "none", border: "none",
                                color: "#3787FF", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", padding: "2px 8px",
                              }}
                            >
                              편집
                            </button>
                          </div>
                        )}
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
