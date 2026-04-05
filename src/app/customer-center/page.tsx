"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "문의", icon: "💬", label: "문의" },
  { value: "신고", icon: "🚨", label: "신고" },
  { value: "건의", icon: "💡", label: "건의" },
  { value: "기타", icon: "📝", label: "기타" },
];

export default function CustomerCenterPage() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<any>(null);
  const [category, setCategory] = useState("문의");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (showForm && editorRef.current && !editorInstanceRef.current) {
      import("@toast-ui/editor").then((mod) => {
        import("@toast-ui/editor/dist/toastui-editor.css");
        if (editorRef.current && !editorInstanceRef.current) {
          editorInstanceRef.current = new mod.default({
            el: editorRef.current,
            height: "250px",
            initialEditType: "wysiwyg",
            placeholder: "문의 내용을 입력해주세요",
            hideModeSwitch: true,
            toolbarItems: [
              ["bold", "italic", "strike"],
              ["ul", "ol"],
              ["image"],
            ],
          });
        }
      });
    }
  }, [showForm]);

  async function handleSubmit() {
    const content = editorInstanceRef.current?.getHTML() || "";
    if (!name || !email || !title || !content.replace(/<[^>]*>/g, "").trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, title, content }),
      });
      if (res.ok) {
        setName("");
        setEmail("");
        setTitle("");
        setCategory("문의");
        editorInstanceRef.current?.setHTML("");
        setShowForm(false);
        setToast(true);
        setTimeout(() => setToast(false), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header - Fixed */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 10px",
        background: "#fff",
      }}>
        <button
          className="press"
          onClick={() => router.back()}
          style={{ background: "none", border: "none", padding: 4 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>고객센터</h1>
      </div>

      <div style={{ padding: "0 10px 40px" }}>
        {/* Quick Links */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <button
            className="press"
            onClick={() => router.push("/faq")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "20px 0",
              background: "#F0F5FF",
              borderRadius: 16,
              border: "none",
            }}
          >
            <img src="/icons/faq.svg" alt="" style={{ width: 44, height: 44 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#3787FF" }}>자주묻는 질문</span>
          </button>
          <button
            className="press"
            onClick={() => setShowForm(true)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "20px 0",
              background: "#F9FAFB",
              borderRadius: 16,
              border: "none",
            }}
          >
            <img src="/icons/customer-center.svg" alt="" style={{ width: 44, height: 44 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>1:1 문의하기</span>
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ animation: "fadeInUp 0.3s ease" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 20 }}>1:1 문의하기</h2>

            {/* Category Chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className="press"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    background: category === c.value ? "#3787FF" : "#F3F4F6",
                    color: category === c.value ? "#fff" : "#6B7280",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "#F3F4F6",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "#F3F4F6",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "#F3F4F6",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {/* Toast UI Editor */}
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                <div ref={editorRef} />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="press"
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 14,
                  border: "none",
                  background: "#3787FF",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  opacity: submitting ? 0.6 : 1,
                  marginTop: 4,
                }}
              >
                {submitting ? "제출 중..." : "문의하기"}
              </button>
            </div>
          </div>
        )}

        {/* Default state when form is hidden */}
        {!showForm && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              궁금하신 점이 있으시면<br />
              자주묻는 질문을 확인하시거나<br />
              1:1 문의를 남겨주세요.
            </p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "14px 28px",
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 9999,
          animation: "fadeInUp 0.3s ease",
        }}>
          문의가 접수되었습니다 ✓
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
