"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";

// 큰 분류 아래에 세부 분류를 하나 더 고르게 한다. 접수되는 글이
// "문의 > 버그·오류"처럼 저장돼서 관리자 목록·알림 메일에서 바로 갈린다.
const CATEGORIES = [
  {
    value: "문의",
    icon: "/icons/toss/chat.svg",
    label: "문의",
    subs: ["버그·오류", "결제·이용권", "계정·로그인", "문제·콘텐츠", "이용 방법"],
  },
  {
    value: "신고",
    icon: "/icons/toss/siren.svg",
    label: "신고",
    subs: ["게시글", "댓글", "사용자", "도배·광고", "욕설·비방"],
  },
  {
    value: "건의",
    icon: "/icons/toss/bulb.svg",
    label: "건의",
    subs: ["기능 건의", "콘텐츠 요청", "문제 오류 제보", "화면·사용성"],
  },
];

// 분류별로 "이렇게 적어주시면 빨리 해결돼요" 안내. 기기 오류는 기기명과
// 재현 순서가 없으면 손도 못 대기 때문에 맨 위에 둔다.
const NOTICES: Record<string, string[]> = {
  문의: [
    "기기에서 생긴 오류라면 기기명(예: 갤럭시탭 S9 FE, 아이폰 15)과 앱·웹 중 어디인지 적어주세요.",
    "언제, 어떤 화면에서, 무엇을 눌렀을 때 생겼는지 순서대로 적어주시면 훨씬 빨리 찾을 수 있어요.",
    "화면 캡처가 있다면 본문에 함께 올려주세요.",
  ],
  신고: [
    "신고할 글·댓글의 작성자 닉네임과 내용을 함께 적어주세요.",
    "해당 화면 캡처를 올려주시면 확인이 빨라요.",
  ],
  건의: [
    "어떤 화면의 어떤 기능인지 적어주세요.",
    "문제 오류 제보는 과목·문제집 이름과 문제 번호(또는 문제 문장)를 함께 적어주세요.",
  ],
};

function subsOf(value: string): string[] {
  return CATEGORIES.find((c) => c.value === value)?.subs ?? [];
}

export default function CustomerCenterPage() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<any>(null);
  const [category, setCategory] = useState("문의");
  const [subCategory, setSubCategory] = useState(CATEGORIES[0].subs[0]);
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
        body: JSON.stringify({
          name,
          email,
          category: `${category} > ${subCategory}`,
          title,
          content,
        }),
      });
      if (res.ok) {
        setName("");
        setEmail("");
        setTitle("");
        setCategory("문의");
        setSubCategory(CATEGORIES[0].subs[0]);
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
    <div style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <BackHeader title="고객센터" />

      <div style={{ padding: "8px 20px 40px" }}>
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
              background: "var(--c-brand-soft-2)",
              borderRadius: 18,
              border: "none",
            }}
          >
            <img src="/icons/faq.svg" alt="" style={{ width: 44, height: 44 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-brand)" }}>자주묻는 질문</span>
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
              background: "var(--c-bg-soft)",
              borderRadius: 18,
              border: "none",
            }}
          >
            <img src="/icons/customer-center.svg" alt="" style={{ width: 44, height: 44 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>1:1 문의하기</span>
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ animation: "fadeInUp 0.3s ease" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text-c)", marginBottom: 20 }}>1:1 문의하기</h2>

            {/* Category Chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCategory(c.value);
                    setSubCategory(c.subs[0]);
                  }}
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
                    background: category === c.value ? "var(--c-brand)" : "var(--c-bg-muted)",
                    color: category === c.value ? "#fff" : "var(--c-text-3)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span><img src={c.icon} alt="" style={{ width: 22, height: 22, display: "block" }} /></span> {c.label}
                </button>
              ))}
            </div>

            {/* 세부 분류 — 큰 분류를 바꾸면 첫 항목으로 초기화된다 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {subsOf(category).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubCategory(sub)}
                  className="press"
                  style={{
                    padding: "7px 13px",
                    borderRadius: 18,
                    fontSize: 13,
                    fontWeight: 600,
                    background: subCategory === sub ? "var(--c-brand-soft-2)" : "var(--c-bg-soft)",
                    color: subCategory === sub ? "var(--c-brand)" : "var(--c-text-4)",
                    border: subCategory === sub ? "1px solid var(--c-brand)" : "1px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* 주의 문구 */}
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "14px 16px",
                borderRadius: 14,
                background: "var(--c-warn-soft)",
                border: "1px solid var(--c-warn-line)",
                marginBottom: 18,
              }}
            >
              <img
                src="/icons/toss/warning.svg"
                alt=""
                style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-warn-deep)", marginBottom: 6 }}>
                  이렇게 적어주시면 더 빨리 해결돼요
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {(NOTICES[category] ?? []).map((line) => (
                    <li
                      key={line}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "var(--c-warn-deep)",
                        paddingLeft: 10,
                        position: "relative",
                      }}
                    >
                      <span style={{ position: "absolute", left: 0, top: 0 }}>·</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
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
                  background: "var(--c-bg-muted)",
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
                  background: "var(--c-bg-muted)",
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
                  background: "var(--c-bg-muted)",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {/* Toast UI Editor */}
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--c-border)" }}>
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
                  background: "var(--c-brand)",
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
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-5)" }}>
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
          문의가 접수되었습니다 <img src="/icons/toss/check-circle.svg" alt="" style={{ width: 16, height: 16, verticalAlign: "middle", display: "inline-block", marginLeft: 4 }} />
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
