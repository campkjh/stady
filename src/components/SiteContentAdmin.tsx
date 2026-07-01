"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string;
  kind: string;
  title: string;
  body: string;
  dateLabel: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrls?: string[];
  createdAt: string;
}

interface Props {
  kind: "notice" | "faq";
  heading: string;
  titleLabel: string;
  bodyLabel: string;
  withDate: boolean;
  withImages?: boolean;
}

const blank = { title: "", body: "", dateLabel: "", sortOrder: 0, isActive: true, imageUrls: [] as string[] };

export default function SiteContentAdmin({ kind, heading, titleLabel, bodyLabel, withDate, withImages }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blank });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/site-content?kind=${kind}`, { credentials: "include" });
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...blank, sortOrder: items.length });
    setShowForm(true);
  }
  function openEdit(it: Item) {
    setEditingId(it.id);
    setForm({ title: it.title, body: it.body, dateLabel: it.dateLabel ?? "", sortOrder: it.sortOrder, isActive: it.isActive, imageUrls: it.imageUrls ?? [] });
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
      if (urls.length) setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...urls].slice(0, 10) }));
    } finally {
      setUploading(false);
    }
  }
  function removeImage(url: string) {
    setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((u) => u !== url) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const payload = {
        kind,
        title: form.title,
        body: form.body,
        dateLabel: withDate ? form.dateLabel : null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        imageUrls: withImages ? form.imageUrls : [],
      };
      const res = editingId
        ? await fetch(`/api/admin/site-content/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/site-content`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
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

  async function remove(it: Item) {
    if (!window.confirm(`"${it.title}"을(를) 삭제할까요?`)) return;
    await fetch(`/api/admin/site-content/${it.id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  async function toggleActive(it: Item) {
    await fetch(`/api/admin/site-content/${it.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !it.isActive }),
    });
    await load();
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
    fontSize: 14, color: "#2B313D", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#2B313D", marginBottom: 6 };

  return (
    <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{heading}</h1>
        <button
          type="button"
          onClick={showForm ? () => { setShowForm(false); setEditingId(null); } : openAdd}
          style={{ padding: "9px 16px", background: showForm ? "#fff" : "#3787FF", color: showForm ? "#2B313D" : "#fff", border: showForm ? "1px solid #E5E7EB" : "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{titleLabel}</label>
            <input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{bodyLabel}</label>
            <textarea style={{ ...input, minHeight: 90, resize: "vertical" }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>

          {withImages && (
            <div style={{ marginBottom: 14 }}>
              <label style={label}>사진 (선택 · 최대 10장)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                {form.imageUrls.map((url) => (
                  <div key={url} style={{ position: "relative", width: 92, height: 92, borderRadius: 10, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 14, lineHeight: 1, cursor: "pointer" }}
                    >×</button>
                  </div>
                ))}
                {form.imageUrls.length < 10 && (
                  <label style={{ width: 92, height: 92, borderRadius: 10, border: "1px dashed #C4CDD8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: uploading ? "default" : "pointer", color: "#8A909C", fontSize: 12, background: "#fff" }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{uploading ? "…" : "+"}</span>
                    {uploading ? "업로드 중" : "사진 추가"}
                    <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={uploadImages} />
                  </label>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: withDate ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12, marginBottom: 14, alignItems: "end" }}>
            {withDate && (
              <div>
                <label style={label}>표시 날짜</label>
                <input style={input} value={form.dateLabel} onChange={(e) => setForm({ ...form, dateLabel: e.target.value })} placeholder="2026.04.01" />
              </div>
            )}
            <div>
              <label style={label}>정렬 순서(작을수록 위)</label>
              <input type="number" style={input} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#2B313D", paddingBottom: 8 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              노출
            </label>
          </div>
          <button type="submit" disabled={busy} style={{ padding: "9px 20px", background: "#3787FF", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "저장 중..." : editingId ? "수정 저장" : "추가"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: "#8A909C", fontSize: 14 }}>불러오는 중…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#8A909C", fontSize: 14 }}>등록된 항목이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, background: it.isActive ? "#fff" : "#FAFAFA", opacity: it.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#191F28" }}>
                    {it.title}
                    {!it.isActive && <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>(숨김)</span>}
                  </div>
                  {withDate && it.dateLabel && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{it.dateLabel}</div>}
                  <div style={{ fontSize: 13.5, color: "#4B5563", marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{it.body}</div>
                  {withImages && it.imageUrls && it.imageUrls.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {it.imageUrls.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB" }} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#B0B8C1", marginTop: 6 }}>순서 {it.sortOrder}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => openEdit(it)} style={{ padding: "5px 12px", border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#3787FF", cursor: "pointer" }}>수정</button>
                  <button type="button" onClick={() => toggleActive(it)} style={{ padding: "5px 12px", border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#6B7280", cursor: "pointer" }}>{it.isActive ? "숨김" : "노출"}</button>
                  <button type="button" onClick={() => remove(it)} style={{ padding: "5px 12px", border: "1px solid #FECACA", background: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
