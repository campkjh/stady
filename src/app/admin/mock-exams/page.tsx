"use client";

import { useEffect, useState } from "react";

interface Exam {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrls: string[];
  createdAt: string;
}

const blank = { title: "", subtitle: "", sortOrder: 0, isActive: true, imageUrls: [] as string[] };

export default function AdminMockExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blank });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    setForm({ title: ex.title, subtitle: ex.subtitle ?? "", sortOrder: ex.sortOrder, isActive: ex.isActive, imageUrls: ex.imageUrls });
    setShowForm(true);
  }

  async function uploadImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
        const data = await res.json();
        if (res.ok && data.url) urls.push(data.url);
        else alert(data.error || "이미지 업로드 실패");
      }
      if (urls.length) setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...urls].slice(0, 50) }));
    } finally {
      setUploading(false);
    }
  }
  function removeImage(url: string) {
    setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((u) => u !== url) }));
  }
  function moveImage(idx: number, dir: -1 | 1) {
    setForm((f) => {
      const arr = [...f.imageUrls];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return f;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...f, imageUrls: arr };
    });
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

  const input: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14, color: "#2B313D", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#2B313D", marginBottom: 6 };

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>모의고사 관리</h1>
        <button type="button" onClick={showForm ? () => { setShowForm(false); setEditingId(null); } : openAdd}
          style={{ padding: "9px 16px", background: showForm ? "#fff" : "#3787FF", color: showForm ? "#2B313D" : "#fff", border: showForm ? "1px solid #E5E7EB" : "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {showForm ? "취소" : "+ 모의고사 추가"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#8A909C", margin: "0 0 18px" }}>시험지 이미지를 업로드하면 사용자가 태블릿에서 펜/형광펜/OCR로 풀 수 있어요.</p>

      {showForm && (
        <form onSubmit={submit} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={label}>제목</label><input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="2026 수능 대비 모의고사 1회" /></div>
            <div><label style={label}>부제 (선택)</label><input style={input} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="국어 · 45문항" /></div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={label}>시험지 이미지 (페이지 순서대로 · 최대 50장)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {form.imageUrls.map((url, idx) => (
                <div key={url} style={{ position: "relative", width: 100, height: 130, borderRadius: 10, overflow: "hidden", border: "1px solid #E5E7EB", background: "#fff" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "1px 6px" }}>{idx + 1}</span>
                  <button type="button" onClick={() => removeImage(url)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 14, lineHeight: 1, cursor: "pointer" }}>×</button>
                  <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, display: "flex", justifyContent: "space-between" }}>
                    <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} style={{ width: 24, height: 22, border: "none", borderRadius: 6, background: "rgba(255,255,255,0.9)", color: idx === 0 ? "#ccc" : "#333", fontSize: 12, cursor: "pointer" }}>◀</button>
                    <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === form.imageUrls.length - 1} style={{ width: 24, height: 22, border: "none", borderRadius: 6, background: "rgba(255,255,255,0.9)", color: idx === form.imageUrls.length - 1 ? "#ccc" : "#333", fontSize: 12, cursor: "pointer" }}>▶</button>
                  </div>
                </div>
              ))}
              {form.imageUrls.length < 50 && (
                <label style={{ width: 100, height: 130, borderRadius: 10, border: "1px dashed #C4CDD8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: uploading ? "default" : "pointer", color: "#8A909C", fontSize: 12, background: "#fff" }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{uploading ? "…" : "+"}</span>
                  {uploading ? "업로드 중" : "이미지 추가"}
                  <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={uploadImages} />
                </label>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, alignItems: "end" }}>
            <div><label style={label}>정렬 순서(작을수록 위)</label><input type="number" style={input} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#2B313D", paddingBottom: 8 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> 노출
            </label>
          </div>
          <button type="submit" disabled={busy || uploading} style={{ padding: "9px 20px", background: "#3787FF", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "저장 중..." : editingId ? "수정 저장" : "추가"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: "#8A909C", fontSize: 14 }}>불러오는 중…</p>
      ) : exams.length === 0 ? (
        <p style={{ color: "#8A909C", fontSize: 14 }}>등록된 모의고사가 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exams.map((ex) => (
            <div key={ex.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, background: ex.isActive ? "#fff" : "#FAFAFA", opacity: ex.isActive ? 1 : 0.6, display: "flex", gap: 12, alignItems: "center" }}>
              {ex.imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ex.imageUrls[0]} alt="" style={{ width: 56, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#191F28" }}>{ex.title}{!ex.isActive && <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>(숨김)</span>}</div>
                {ex.subtitle && <div style={{ fontSize: 13, color: "#8A909C", marginTop: 2 }}>{ex.subtitle}</div>}
                <div style={{ fontSize: 12, color: "#B0B8C1", marginTop: 4 }}>이미지 {ex.imageUrls.length}장 · 순서 {ex.sortOrder}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => openEdit(ex)} style={{ padding: "5px 12px", border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#3787FF", cursor: "pointer" }}>수정</button>
                <button type="button" onClick={() => remove(ex)} style={{ padding: "5px 12px", border: "1px solid #FECACA", background: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
