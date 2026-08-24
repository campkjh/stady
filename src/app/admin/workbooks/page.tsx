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

  // 업로드 자리는 점선 대신 보조 면(#F2F3F5)으로 표시한다.
  const imageDropStyle: React.CSSProperties = {
    border: "none",
    borderRadius: 13,
    padding: 20,
    textAlign: "center",
    cursor: "pointer",
    transition: "background 0.15s",
    background: JC.soft,
  };

  const imagePreviewStyle: React.CSSProperties = {
    position: "relative",
    borderRadius: 13,
    overflow: "hidden",
    border: `1px solid ${JC.soft}`,
  };

  // 단일 이미지 선택지 모드인지 확인
  const isSingleImageChoices = (p: Problem) => {
    return isImageUrl(p.choice1) && p.choice2 === "_" && p.choice3 === "_" && p.choice4 === "_";
  };

  return (
    <div className="jc-admin">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: JC.title }}>문제집 관리</h1>
          <p style={{ fontSize: 14, fontWeight: 400, color: JC.sub, marginTop: 6 }}>총 {workbooks.length}개의 문제집</p>
        </div>
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
          {showForm ? "취소" : "+ 문제집 추가"}
        </button>
      </div>

      {/* Create Workbook Form */}
      {showForm && (
        <form onSubmit={handleCreateWorkbook} style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: JC.title, marginBottom: 20 }}>새 문제집</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
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
          </div>

          {/* Thumbnail */}
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>썸네일 <span style={{ color: JC.sub, fontWeight: 400 }}>선택</span></label>
            {thumbnailPreview ? (
              <div style={{ position: "relative", width: 180, borderRadius: 13, overflow: "hidden", border: `1px solid ${JC.soft}` }}>
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
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--c-brand-soft-6)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--c-bg-muted-3)"; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 6px" }}>
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#8A909C" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="2" stroke="#8A909C" strokeWidth="1.5"/>
                  <path d="M3 16L8 11L13 16M13 14L16 11L21 16" stroke="#8A909C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ fontSize: 12, color: JC.body, fontWeight: 600 }}>썸네일 업로드</p>
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
              padding: "12px 24px",
              background: JC.accent,
              color: "#fff",
              border: "none",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
              boxShadow: "none",
            }}
          >
            {submitting ? "생성 중..." : "문제집 생성"}
          </button>
        </form>
      )}

      {/* Workbooks Table */}
      <div style={{ ...cardStyle, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={thStyle}>제목</th>
              <th style={thStyle}>카테고리</th>
              <th style={{ ...thStyle, textAlign: "center" }}>문제 수</th>
              <th style={{ ...thStyle, textAlign: "center" }}>인기</th>
              <th style={{ ...thStyle, textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {workbooks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 48, color: JC.sub }}>
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
                    // 줄무늬 없이 흰 면 + 구분선 하나. 편집 중인 행만 강조 면.
                    borderBottom: idx === workbooks.length - 1 ? "none" : `1px solid ${JC.soft}`,
                    background: isEditing ? JC.accentBg : "var(--c-bg)",
                    transition: "background 0.15s",
                  }}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: JC.title }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editWbData.title}
                        onChange={(e) => setEditWbData({ ...editWbData, title: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 10px" }}
                      />
                    ) : wb.title}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 500, color: JC.body }}>
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
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700, color: JC.accent }}>{wb.totalQuestions}</td>
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
                        ...chipBase, border: "none", cursor: "pointer",
                        backgroundColor: wb.isPopular ? JC.accentBg : JC.soft,
                        color: wb.isPopular ? JC.accent : JC.body,
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
                            padding: "7px 12px", borderRadius: 13, border: "none",
                            background: JC.soft, color: JC.body, fontSize: 12, fontWeight: 600, cursor: "pointer",
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
                            padding: "7px 12px", borderRadius: 13, border: "none",
                            background: JC.accent, color: "#fff",
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
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
                            padding: "7px 12px", borderRadius: 13, border: "none",
                            background: JC.soft, color: JC.body, fontSize: 12, fontWeight: 600, cursor: "pointer",
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
                            background: JC.accentBg, border: "none", borderRadius: 13,
                            color: JC.accent, fontWeight: 700, fontSize: 13,
                            cursor: "pointer", padding: "7px 14px",
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
                            background: JC.accentBg, border: "none", borderRadius: 13,
                            color: JC.accent, fontWeight: 700, fontSize: 13,
                            cursor: "pointer", padding: "7px 14px",
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
                            background: "var(--c-danger-soft)", border: "none", borderRadius: 13,
                            color: "var(--c-danger-c)", fontWeight: 600, fontSize: 13,
                            cursor: "pointer", padding: "7px 14px",
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
          position: "fixed", inset: 0, background: "rgba(43,49,61,0.32)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
        }}>
          <div style={{
            ...cardStyle, width: "100%", maxWidth: 720,
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: `1px solid ${JC.soft}`,
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: JC.title }}>
                  {selectedWorkbook.title}
                </h3>
                <p style={{ fontSize: 13, fontWeight: 400, color: JC.sub, marginTop: 4 }}>문제 관리</p>
              </div>
              <button
                onClick={() => { setSelectedWorkbook(null); setShowProblemForm(false); resetProblemForm(); }}
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
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: JC.body }}>총 <b style={{ color: JC.accent, fontWeight: 700 }}>{problems.length}</b>개 문제</p>
                <button
                  className="press"
                  onClick={() => { setShowProblemForm(!showProblemForm); if (showProblemForm) resetProblemForm(); }}
                  style={{
                    padding: "9px 18px",
                    background: showProblemForm ? JC.soft : JC.accent,
                    color: showProblemForm ? JC.body : "#fff",
                    border: "none",
                    borderRadius: 13,
                    fontSize: 13,
                    fontWeight: showProblemForm ? 600 : 700,
                    cursor: "pointer",
                  }}
                >
                  {showProblemForm ? "취소" : "+ 문제 추가"}
                </button>
              </div>

              {/* Add Problem Form */}
              {showProblemForm && (
                <form onSubmit={handleAddProblem} style={{
                  background: JC.soft, borderRadius: 13, padding: 24, marginBottom: 20,
                  border: "none",
                }}>
                  {/* 문제 이미지 */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>
                      문제 이미지 <span style={{ color: "var(--c-danger-c)" }}>*</span>
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
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--c-brand-soft-6)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--c-bg-muted-3)"; }}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px" }}>
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="#8A909C" strokeWidth="1.5"/>
                          <circle cx="8.5" cy="8.5" r="2" stroke="#8A909C" strokeWidth="1.5"/>
                          <path d="M3 16L8 11L13 16" stroke="#8A909C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M13 14L16 11L21 16" stroke="#8A909C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <p style={{ fontSize: 13, color: JC.body, fontWeight: 600 }}>클릭하여 문제 이미지를 업로드하세요</p>
                        <p style={{ fontSize: 11, color: JC.sub, fontWeight: 400, marginTop: 4 }}>PNG, JPG, WEBP (최대 10MB)</p>
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
                      선택지 이미지 <span style={{ color: "var(--c-danger-c)" }}>*</span>
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
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--c-brand-soft-6)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--c-bg-muted-3)"; }}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px" }}>
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="#8A909C" strokeWidth="1.5"/>
                          <path d="M7 8H17M7 12H17M7 16H13" stroke="#8A909C" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p style={{ fontSize: 13, color: JC.body, fontWeight: 600 }}>클릭하여 선택지 이미지를 업로드하세요</p>
                        <p style={{ fontSize: 11, color: JC.sub, fontWeight: 400, marginTop: 4 }}>1~5번 선택지가 포함된 하나의 이미지</p>
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
                    <label style={labelStyle}>정답 번호 <span style={{ color: "var(--c-danger-c)" }}>*</span></label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAnswer(n)}
                          style={{
                            width: 40, height: 40, borderRadius: 13, border: "none",
                            background: answer === n ? JC.accent : "var(--c-bg)",
                            color: answer === n ? "#fff" : JC.body,
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
                        해설 <span style={{ color: JC.sub, fontWeight: 400 }}>선택</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateAIExplanation}
                        disabled={generatingAI || !questionFile || !choicesFile}
                        className="press"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "8px 14px", borderRadius: 13, border: "none",
                          background: (generatingAI || !questionFile || !choicesFile) ? "var(--c-bg)" : JC.accent,
                          color: (generatingAI || !questionFile || !choicesFile) ? "#8A909C" : "#fff",
                          fontSize: 12, fontWeight: 700,
                          cursor: (generatingAI || !questionFile || !choicesFile) ? "not-allowed" : "pointer",
                          boxShadow: "none",
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
                      onFocus={(e) => e.currentTarget.style.borderColor = "#3180F7"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "var(--c-bg-muted-3)"}
                      placeholder="해설을 직접 입력하거나 AI 해설 자동 생성 버튼을 눌러주세요"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="press"
                    style={{
                      padding: "12px 24px",
                      background: JC.accent,
                      color: "#fff",
                      border: "none",
                      borderRadius: 13,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: uploading ? "not-allowed" : "pointer",
                      opacity: uploading ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "none",
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
                    background: "var(--c-bg)", borderRadius: 13, padding: 16,
                    border: `1px solid ${JC.soft}`, boxShadow: "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{
                        ...chipBase, fontSize: 11, color: JC.accent,
                        background: JC.accentBg, marginTop: 2,
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
                          background: "var(--c-danger-soft)", border: "none", borderRadius: 13,
                          color: "var(--c-danger-c)", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", padding: "6px 12px", marginLeft: "auto",
                          flexShrink: 0, order: 2,
                        }}
                      >
                        삭제
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 문제 이미지 */}
                        {p.questionImage && (
                          <div style={{ marginBottom: 8, borderRadius: 13, overflow: "hidden", border: "1px solid var(--c-bg-muted-3)" }}>
                            <img src={p.questionImage} alt="문제" style={{ width: "100%", display: "block", background: "var(--c-bg-muted-3)" }} />
                          </div>
                        )}
                        {/* 본문 이미지 (레거시) */}
                        {p.passageImage && !p.questionImage && (
                          <div style={{ marginBottom: 8, borderRadius: 13, overflow: "hidden", border: "1px solid var(--c-bg-muted-3)" }}>
                            <img src={p.passageImage} alt="본문" style={{ width: "100%", display: "block", background: "var(--c-bg-muted-3)" }} />
                          </div>
                        )}
                        {/* 문제 텍스트 (레거시) */}
                        {p.questionText && (
                          <p style={{ fontSize: 14, fontWeight: 700, color: JC.title, marginBottom: 8 }}>{p.questionText}</p>
                        )}
                        {/* 선택지 */}
                        {isSingleImageChoices(p) ? (
                          <div style={{ borderRadius: 13, overflow: "hidden", border: `1px solid ${JC.soft}` }}>
                            <img src={p.choice1} alt="선택지" style={{ width: "100%", display: "block", background: "var(--c-bg-muted-3)" }} />
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
                                      fontWeight: isAnswer ? 700 : 500,
                                      padding: "6px 10px",
                                      borderRadius: 13,
                                      background: isAnswer ? JC.accentBg : JC.soft,
                                      color: isAnswer ? JC.accent : JC.body,
                                      border: "none",
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
                          <div style={{ marginTop: 12, padding: 14, background: JC.soft, borderRadius: 13, border: "none" }}>
                            <label style={labelStyle}>정답 번호</label>
                            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setEditAnswer(n)}
                                  style={{
                                    width: 36, height: 36, borderRadius: 13, border: "none",
                                    background: editAnswer === n ? JC.accent : "var(--c-bg)",
                                    color: editAnswer === n ? "#fff" : JC.body,
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
                                  padding: "9px 18px", borderRadius: 13, border: "none",
                                  background: JC.accent, color: "#fff",
                                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProblemId(null)}
                                style={{
                                  padding: "9px 18px", borderRadius: 13, border: "none",
                                  background: "var(--c-bg)", color: JC.body,
                                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...chipBase, background: JC.accentBg, color: JC.accent }}>
                              정답: {p.answer}번
                            </span>
                            {p.explanation && (
                              <span style={{ fontSize: 12, fontWeight: 400, color: JC.sub }}>해설: {p.explanation}</span>
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
                                background: JC.accentBg, border: "none", borderRadius: 13,
                                color: JC.accent, fontSize: 12, fontWeight: 700,
                                cursor: "pointer", padding: "6px 12px",
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
`;
