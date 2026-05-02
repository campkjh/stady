"use client";

import { useEffect, useState } from "react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  bgColor: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "",
  bgColor: "#3787FF",
  sortOrder: 0,
  isActive: true,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/banners?includeInactive=1", { credentials: "include" });
      const data = await res.json();
      setBanners(data.banners || []);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/banners", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      if (!res.ok) throw new Error("save failed");
      resetForm();
      fetchBanners();
    } catch {
      alert("배너 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (banner: Banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      imageUrl: banner.imageUrl || "",
      linkUrl: banner.linkUrl || "",
      bgColor: banner.bgColor || "#3787FF",
      sortOrder: banner.sortOrder || 0,
      isActive: banner.isActive,
    });
  };

  const remove = async (banner: Banner) => {
    if (!confirm(`"${banner.title}" 배너를 삭제할까요?`)) return;
    try {
      const res = await fetch(`/api/banners?id=${banner.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("delete failed");
      fetchBanners();
      if (editingId === banner.id) resetForm();
    } catch {
      alert("배너 삭제에 실패했습니다.");
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>배너 관리</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: "#8A909C" }}>홈 카테고리 아래 2:1 슬라이드 배너를 관리합니다.</p>
        </div>
        {editingId && (
          <button type="button" onClick={resetForm} style={ghostButtonStyle}>새 배너</button>
        )}
      </div>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 18 }}>
          {editingId ? "배너 수정" : "배너 추가"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="제목">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} placeholder={"예: 생활과윤리 OX 1013문항"} />
          </Field>
          <Field label="부제목">
            <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} style={inputStyle} placeholder="짧은 설명" />
          </Field>
          <Field label="이미지 URL">
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} style={inputStyle} placeholder="/icons/banner-ox.svg 또는 https://..." />
          </Field>
          <Field label="클릭 이동 경로">
            <input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} style={inputStyle} placeholder="/ox-quiz-intro" />
          </Field>
          <Field label="배경색">
            <div style={{ display: "flex", gap: 8 }}>
              <input type="color" value={form.bgColor} onChange={(e) => setForm({ ...form, bgColor: e.target.value })} style={{ width: 48, height: 42, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }} />
              <input value={form.bgColor} onChange={(e) => setForm({ ...form, bgColor: e.target.value })} style={inputStyle} />
            </div>
          </Field>
          <Field label="정렬 순서">
            <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} style={inputStyle} />
          </Field>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 14, fontWeight: 700, color: "#374151" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          홈에 노출
        </label>
        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? "저장 중..." : editingId ? "수정하기" : "추가하기"}</button>
          {editingId && <button type="button" onClick={resetForm} style={ghostButtonStyle}>취소</button>}
        </div>
      </form>

      {loading ? (
        <p style={{ color: "#8A909C" }}>불러오는 중...</p>
      ) : banners.length === 0 ? (
        <div style={{ padding: 40, borderRadius: 16, background: "#fff", border: "1px solid #E5E7EB", textAlign: "center", color: "#8A909C" }}>
          등록된 배너가 없습니다.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {banners.map((banner) => (
            <div key={banner.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ position: "relative", aspectRatio: "2/1", background: banner.bgColor || "#3787FF" }}>
                {banner.imageUrl && <img src={banner.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: banner.imageUrl ? "linear-gradient(90deg, rgba(0,0,0,0.54), rgba(0,0,0,0.08))" : "rgba(0,0,0,0.08)" }} />
                <div style={{ position: "absolute", left: 18, right: 18, bottom: 16 }}>
                  <p style={{ color: "#fff", fontSize: 20, fontWeight: 900 }}>{banner.title}</p>
                  {banner.subtitle && <p style={{ color: "rgba(255,255,255,0.86)", fontSize: 13, marginTop: 4 }}>{banner.subtitle}</p>}
                </div>
                {!banner.isActive && <span style={{ position: "absolute", top: 12, right: 12, padding: "4px 8px", borderRadius: 999, background: "rgba(0,0,0,0.58)", color: "#fff", fontSize: 12, fontWeight: 800 }}>숨김</span>}
              </div>
              <div style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "#8A909C" }}>순서 {banner.sortOrder} · {banner.linkUrl || "링크 없음"}</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button type="button" onClick={() => edit(banner)} style={smallButtonStyle}>수정</button>
                  <button type="button" onClick={() => remove(banner)} style={dangerButtonStyle}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  height: 42,
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
};

const primaryButtonStyle = {
  height: 42,
  padding: "0 18px",
  borderRadius: 10,
  border: "none",
  background: "#3787FF",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
};

const ghostButtonStyle = {
  height: 42,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  background: "#fff",
  color: "#374151",
  fontSize: 14,
  fontWeight: 800,
};

const smallButtonStyle = {
  height: 34,
  padding: "0 12px",
  borderRadius: 9,
  border: "1px solid #E5E7EB",
  background: "#fff",
  color: "#374151",
  fontSize: 13,
  fontWeight: 800,
};

const dangerButtonStyle = {
  ...smallButtonStyle,
  border: "none",
  background: "#FEE2E2",
  color: "#DC2626",
};
