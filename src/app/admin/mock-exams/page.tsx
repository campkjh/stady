"use client";

import { useEffect, useState } from "react";
import { SUBJECT_GROUPS, EXAM_MONTHS } from "@/lib/examSubjects";

interface Exam {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrls: string[];
  solutionImageUrls?: string[];
  year: number | null;
  month: number | null;
  subject: string | null;
  createdAt: string;
}

const blank = { title: "", subtitle: "", sortOrder: 0, isActive: true, imageUrls: [] as string[], solutionImageUrls: [] as string[], year: "", month: "", subject: "" };

// 등록 폼의 연도 선택지(올해부터 8년 전까지).
const YEAR_CHOICES = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - i);

export default function AdminMockExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blank });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/mock-exams", { credentials: "include" });
    const data = await res.json();
    setExams(data.exams || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ ...blank, sortOrder: exams.length });
    setShowForm(true);
  }
  function openEdit(ex: Exam) {
    setEditingId(ex.id);
    setForm({
      title: ex.title, subtitle: ex.subtitle ?? "", sortOrder: ex.sortOrder, isActive: ex.isActive,
      imageUrls: ex.imageUrls, solutionImageUrls: ex.solutionImageUrls ?? [],
      year: ex.year != null ? String(ex.year) : "", month: ex.month != null ? String(ex.month) : "", subject: ex.subject ?? "",
    });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        imageUrls: form.imageUrls,
        solutionImageUrls: form.solutionImageUrls,
        year: form.year ? Number(form.year) : null,
        month: form.month ? Number(form.month) : null,
        subject: form.subject || null,
      };
      const res = editingId
        ? await fetch(`/api/admin/mock-exams/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) })
        : await fetch(`/api/admin/mock-exams`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "저장 실패");
        return;
      }
      setShowForm(false);
      setForm({ ...blank });
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(ex: Exam) {
    if (!window.confirm(`"${ex.title}" 모의고사를 삭제할까요?`)) return;
    await fetch(`/api/admin/mock-exams/${ex.id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  const input: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 13, border: `1px solid ${JC.soft}`, background: "var(--c-bg)", fontSize: 14, color: JC.title, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: JC.body, marginBottom: 6 };

  return (
    <div className="jc-admin" style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: JC.title, margin: 0 }}>모의고사 관리</h1>
        <button type="button" onClick={showForm ? () => { setShowForm(false); setEditingId(null); } : openAdd}
          style={{ padding: "11px 20px", background: showForm ? JC.soft : JC.accent, color: showForm ? JC.body : "#fff", border: "none", borderRadius: 13, fontSize: 14, fontWeight: showForm ? 600 : 700, cursor: "pointer", boxShadow: "none" }}>
          {showForm ? "취소" : "+ 모의고사 추가"}
        </button>
      </div>
      <p style={{ fontSize: 14, fontWeight: 400, color: JC.sub, margin: "0 0 20px" }}>시험지 이미지를 업로드하면 사용자가 태블릿에서 펜/형광펜/OCR로 풀 수 있어요.</p>

      {showForm && (
        <form onSubmit={submit} style={{ ...cardStyle, padding: 22, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={label}>제목</label><input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="2026 수능 대비 모의고사 1회" /></div>
            <div><label style={label}>부제 (선택)</label><input style={input} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="국어 · 45문항" /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={label}>시행 연도</label>
              <select style={input} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                <option value="">미분류</option>
                {YEAR_CHOICES.map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label style={label}>시행 월</label>
              <select style={input} value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
                <option value="">미분류</option>
                {EXAM_MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
            <div>
              <label style={label}>과목</label>
              <select style={input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                <option value="">미분류</option>
                {SUBJECT_GROUPS.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {g.subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <ExamImageGrid
            label="시험지 이미지 (문제 · 페이지 순서대로 · 최대 50장)"
            urls={form.imageUrls}
            onChange={(fn) => setForm((f) => ({ ...f, imageUrls: fn(f.imageUrls) }))}
          />
          <ExamImageGrid
            label="해설 이미지 (선택)"
            hint="넣으면 사용자 화면에 '해설보기' 탭이 생겨 문제/해설을 전환할 수 있어요."
            urls={form.solutionImageUrls}
            onChange={(fn) => setForm((f) => ({ ...f, solutionImageUrls: fn(f.solutionImageUrls) }))}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, alignItems: "end" }}>
            <div><label style={label}>정렬 순서(작을수록 위)</label><input type="number" style={input} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: JC.body, paddingBottom: 8 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> 노출
            </label>
          </div>
          <button type="submit" disabled={busy} style={{ padding: "11px 22px", background: JC.accent, color: "#fff", border: "none", borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, boxShadow: "none" }}>
            {busy ? "저장 중..." : editingId ? "수정 저장" : "추가"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: JC.sub, fontSize: 14 }}>불러오는 중…</p>
      ) : exams.length === 0 ? (
        <p style={{ color: JC.sub, fontSize: 14 }}>등록된 모의고사가 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exams.map((ex) => (
            <div key={ex.id} style={{ ...cardStyle, padding: 16, background: ex.isActive ? "var(--c-bg)" : JC.soft, opacity: ex.isActive ? 1 : 0.6, display: "flex", gap: 12, alignItems: "center" }}>
              {ex.imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ex.imageUrls[0]} alt="" style={{ width: 56, height: 72, objectFit: "cover", borderRadius: 13, border: `1px solid ${JC.soft}`, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: JC.title }}>{ex.title}{!ex.isActive && <span style={{ marginLeft: 8, fontSize: 11, color: JC.sub, fontWeight: 400 }}>(숨김)</span>}</div>
                {ex.subtitle && <div style={{ fontSize: 13, fontWeight: 500, color: JC.body, marginTop: 3 }}>{ex.subtitle}</div>}
                <div style={{ fontSize: 12, fontWeight: 400, color: JC.sub, marginTop: 5 }}>
                  {ex.year ? `${ex.year}년 ` : ""}{ex.month ? `${ex.month}월 · ` : ""}
                  {SUBJECT_GROUPS.flatMap((g) => g.subjects).find((sub) => sub.id === ex.subject)?.label ?? "미분류"} ·{" "}
                  문제 {ex.imageUrls.length}장{(ex.solutionImageUrls?.length ?? 0) > 0 ? ` · 해설 ${ex.solutionImageUrls!.length}장` : ""} · 순서 {ex.sortOrder}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => openEdit(ex)} style={{ padding: "7px 14px", border: "none", background: JC.accentBg, borderRadius: 13, fontSize: 13, fontWeight: 700, color: JC.accent, cursor: "pointer" }}>수정</button>
                <button type="button" onClick={() => remove(ex)} style={{ padding: "7px 14px", border: "1px solid var(--c-danger-line)", background: "var(--c-danger-soft)", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "var(--c-danger-c)", cursor: "pointer" }}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{JC_FOCUS_CSS}</style>
    </div>
  );
}

// 문제/해설 공용 이미지 업로더(썸네일·순서변경·삭제, /api/upload로 Blob 업로드).
function ExamImageGrid({ label, hint, urls, onChange }: {
  label: string;
  hint?: string;
  urls: string[];
  onChange: (updater: (prev: string[]) => string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const out: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
        const data = await res.json();
        if (res.ok && data.url) out.push(data.url);
        else alert(data.error || "이미지 업로드 실패");
      }
      if (out.length) onChange((prev) => [...prev, ...out].slice(0, 50));
    } finally {
      setUploading(false);
    }
  }
  function remove(url: string) {
    onChange((prev) => prev.filter((u) => u !== url));
  }
  function move(idx: number, dir: -1 | 1) {
    onChange((prev) => {
      const arr = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: JC.body, marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ margin: "-2px 0 8px", fontSize: 12, fontWeight: 400, color: JC.sub }}>{hint}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {urls.map((url, idx) => (
          <div key={url} style={{ position: "relative", width: 100, height: 130, borderRadius: 13, overflow: "hidden", border: `1px solid ${JC.soft}`, background: "var(--c-bg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>{idx + 1}</span>
            <button type="button" onClick={() => remove(url)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 14, lineHeight: 1, cursor: "pointer" }}>×</button>
            <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, display: "flex", justifyContent: "space-between" }}>
              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} style={{ width: 24, height: 22, border: "none", borderRadius: 13, background: "var(--c-bg-a90)", color: idx === 0 ? "#8A909C" : JC.body, fontSize: 12, cursor: "pointer" }}>◀</button>
              <button type="button" onClick={() => move(idx, 1)} disabled={idx === urls.length - 1} style={{ width: 24, height: 22, border: "none", borderRadius: 13, background: "var(--c-bg-a90)", color: idx === urls.length - 1 ? "#8A909C" : JC.body, fontSize: 12, cursor: "pointer" }}>▶</button>
            </div>
          </div>
        ))}
        {urls.length < 50 && (
          <label style={{ width: 100, height: 130, borderRadius: 13, border: "none", background: JC.soft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: uploading ? "default" : "pointer", color: JC.body, fontSize: 12, fontWeight: 600 }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>{uploading ? "…" : "+"}</span>
            {uploading ? "업로드 중" : "이미지 추가"}
            <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={upload} />
          </label>
        )}
      </div>
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
  border: `1px solid ${JC.soft}`,
  borderRadius: 18,
  boxShadow: "none",
};

/* 인라인 style 로는 :focus 를 못 준다. 포커스 테두리만 클래스로 뺀다.
   page.tsx 는 default 외 named export 가 금지라 모듈 로컬 상수로 둔다. */
const JC_FOCUS_CSS = `
  .jc-admin input:focus,
  .jc-admin textarea:focus,
  .jc-admin select:focus { border-color: #3180F7 !important; }
`;
