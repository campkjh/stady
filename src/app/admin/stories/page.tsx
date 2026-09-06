"use client";

import { useEffect, useState } from "react";

// 스타디 사용 후기(인스타 하이라이트형) 관리 — 커버 1장 + 후기 이미지 여러 장.
interface Slide { id: string; imageUrl: string }
interface Highlight {
  id: string; title: string; coverUrl: string; sortOrder: number; isActive: boolean; slides: Slide[];
}

const ACCENT = "#3180F7";
const MUTED = "#8A909C";
const BORDER = "var(--c-bg-muted-3)";
const blank = { title: "", coverUrl: "", imageUrls: [] as string[], sortOrder: 0 };

async function uploadOne(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || "업로드 실패");
  return data.url as string;
}

export default function AdminStoriesPage() {
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/stories", { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 403 ? "관리자 권한이 필요합니다." : "불러오지 못했습니다.");
      const d = await res.json();
      setItems(d.highlights || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ ...blank, sortOrder: items.length });
    setShowForm(true);
  }
  function openEdit(it: Highlight) {
    setEditingId(it.id);
    setForm({ title: it.title, coverUrl: it.coverUrl, imageUrls: it.slides.map((s) => s.imageUrl), sortOrder: it.sortOrder });
    setShowForm(true);
  }

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      setForm((f) => ({ ...f, coverUrl: "" }));
      const url = await uploadOne(file);
      setForm((f) => ({ ...f, coverUrl: url }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }
  async function pickSlides(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadOne(f));
      setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...urls].slice(0, 20) }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return alert("제목을 입력해 주세요.");
    if (!form.coverUrl) return alert("커버 이미지를 올려 주세요.");
    if (form.imageUrls.length === 0) return alert("후기 이미지를 1장 이상 올려 주세요.");
    setBusy(true);
    try {
      const url = editingId ? `/api/admin/stories/${editingId}` : "/api/admin/stories";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "저장 실패");
      setShowForm(false);
      setEditingId(null);
      setForm({ ...blank });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(it: Highlight) {
    await fetch(`/api/admin/stories/${it.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ isActive: !it.isActive }),
    });
    await load();
  }
  async function remove(it: Highlight) {
    if (!confirm(`"${it.title}" 후기를 삭제할까요?`)) return;
    await fetch(`/api/admin/stories/${it.id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${BORDER}`,
    fontSize: 14, color: "var(--c-text-2)", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 6 };

  return (
    <div className="sadm" style={{ maxWidth: 860, margin: "0 auto" }}>
      <style>{`@media (max-width: 768px){ .sadm{ margin-left:-16px !important; margin-right:-16px !important; padding:0 10px !important; max-width:none !important; } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--c-text-2)", margin: 0 }}>사용 후기 관리</h1>
        <button type="button" onClick={showForm ? () => { setShowForm(false); setEditingId(null); } : openAdd}
          style={{ padding: "9px 16px", background: showForm ? "var(--c-bg)" : ACCENT, color: showForm ? "var(--c-text-2)" : "#fff", border: showForm ? `1px solid ${BORDER}` : "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>
      <p style={{ fontSize: 13.5, color: MUTED, margin: "0 0 20px" }}>
        커뮤니티 주간 인기글 위에 인스타 하이라이트처럼 뜹니다. 커버를 누르면 후기 이미지가 순서대로 넘어가요.
      </p>

      {showForm && (
        <form onSubmit={submit} style={{ background: "var(--c-bg-soft)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>제목 (원 아래 표시)</label>
            <input style={input} value={form.title} maxLength={20}
              onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 고3 수험생 후기" required />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>커버 이미지 (원형)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {form.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverUrl} alt="" style={{ width: 64, height: 64, borderRadius: 999, objectFit: "cover", border: `1px solid ${BORDER}` }} />
              )}
              <label style={{ padding: "8px 14px", borderRadius: 8, border: `1px dashed ${BORDER}`, cursor: "pointer", fontSize: 13, color: "var(--c-text-3)", background: "var(--c-bg)" }}>
                {form.coverUrl ? "커버 변경" : "커버 올리기"}
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={pickCover} />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={label}>후기 이미지 (최대 20장 · 올린 순서대로 넘어감)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {form.imageUrls.map((url, i) => (
                <div key={url} style={{ position: "relative", width: 72, height: 110, borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span style={{ position: "absolute", left: 4, top: 4, fontSize: 10, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "1px 5px" }}>{i + 1}</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((u) => u !== url) }))}
                    style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 13, lineHeight: 1, cursor: "pointer" }}>×</button>
                </div>
              ))}
              <label style={{ width: 72, height: 110, borderRadius: 8, border: `1px dashed ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: uploading ? "default" : "pointer", color: MUTED, fontSize: 12, background: "var(--c-bg)" }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{uploading ? "…" : "+"}</span>
                {uploading ? "올리는 중" : "추가"}
                <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={pickSlides} />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 14, maxWidth: 200 }}>
            <label style={label}>정렬 순서(작을수록 앞)</label>
            <input type="number" style={input} value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </div>

          <button type="submit" disabled={busy || uploading}
            style={{ padding: "9px 20px", background: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy || uploading ? 0.6 : 1 }}>
            {busy ? "저장 중..." : editingId ? "수정 저장" : "추가"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: MUTED, fontSize: 14 }}>불러오는 중…</p>
      ) : error ? (
        <p style={{ color: "#D63A3A", fontSize: 14, fontWeight: 600 }}>{error}</p>
      ) : items.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>등록된 후기가 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, background: it.isActive ? "var(--c-bg)" : "var(--c-bg-soft-3)", opacity: it.isActive ? 1 : 0.6, display: "flex", gap: 12, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.coverUrl} alt="" style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-b)" }}>
                  {it.title}
                  {!it.isActive && <span style={{ marginLeft: 8, fontSize: 11, color: MUTED, fontWeight: 600 }}>(숨김)</span>}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>이미지 {it.slides.length}장 · 순서 {it.sortOrder}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => openEdit(it)} style={{ padding: "5px 12px", border: `1px solid ${BORDER}`, background: "var(--c-bg)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: ACCENT, cursor: "pointer" }}>수정</button>
                <button type="button" onClick={() => toggleActive(it)} style={{ padding: "5px 12px", border: `1px solid ${BORDER}`, background: "var(--c-bg)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--c-text-3)", cursor: "pointer" }}>{it.isActive ? "숨김" : "노출"}</button>
                <button type="button" onClick={() => remove(it)} style={{ padding: "5px 12px", border: "1px solid var(--c-danger-line)", background: "var(--c-bg)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--c-danger)", cursor: "pointer" }}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
