"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type WrongType = "all" | "workbook" | "ox" | "vocab";

interface WrongItem {
  id: string;
  type: "workbook" | "ox" | "vocab";
  title: string;
  subtitle: string;
  prompt: string;
  selected: number | boolean | null;
  answer: number | boolean;
  answerText?: string;
  explanation?: string | null;
  questionImage?: string | null;
  passageImage?: string | null;
  choices?: string[];
  stats?: {
    attempts: number;
    wrongCount: number;
    wrongRate: number;
    avgSeconds: number;
  };
}

interface WrongNoteResponse {
  items: WrongItem[];
  totals: {
    all: number;
    workbook: number;
    ox: number;
    vocab: number;
    avgWrongRate: number;
    avgSeconds: number;
  };
}

const TABS: { label: string; value: WrongType }[] = [
  { label: "전체", value: "all" },
  { label: "문제집", value: "workbook" },
  { label: "OX", value: "ox" },
  { label: "영단어", value: "vocab" },
];

function typeLabel(type: WrongItem["type"]) {
  if (type === "workbook") return "문제집";
  if (type === "ox") return "OX";
  return "영단어";
}

function selectedText(item: WrongItem) {
  if (item.selected === null || item.selected === undefined) return "미선택";
  if (item.type === "ox") return item.selected ? "O" : "X";
  if (item.type === "vocab" && typeof item.selected === "number") {
    return `${item.selected}. ${item.choices?.[item.selected - 1] ?? ""}`;
  }
  return `${item.selected}번`;
}

function answerText(item: WrongItem) {
  if (item.type === "ox") return item.answer ? "O" : "X";
  if (item.type === "vocab" && typeof item.answer === "number") {
    return `${item.answer}. ${item.answerText ?? item.choices?.[item.answer - 1] ?? ""}`;
  }
  return `${item.answer}번`;
}

function WrongNoteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as WrongType | null) || "all";
  const focusId = searchParams.get("id");

  const [activeType, setActiveType] = useState<WrongType>(initialType);
  const [data, setData] = useState<WrongNoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/wrong-note?type=${activeType}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("login");
          throw new Error("fetch");
        }
        return res.json();
      })
      .then((nextData) => setData(nextData))
      .catch((err) => setError(err.message === "login" ? "로그인이 필요합니다." : "오답노트를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [activeType]);

  const items = useMemo(() => {
    const raw = data?.items ?? [];
    if (!focusId) return raw;
    const focused = raw.find((item) => item.id === focusId);
    return focused ? [focused, ...raw.filter((item) => item.id !== focusId)] : raw;
  }, [data, focusId]);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #EEF2F7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
          <button
            type="button"
            onClick={() => router.back()}
            className="press"
            style={{ width: 36, height: 36, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>오답노트</h1>
            <p style={{ fontSize: 12, color: "#8A909C", marginTop: 1 }}>틀린 문제만 모아 다시 보는 공간</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 12px" }}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveType(tab.value)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 999,
                border: activeType === tab.value ? "none" : "1px solid #E5E7EB",
                background: activeType === tab.value ? "#111827" : "#fff",
                color: activeType === tab.value ? "#fff" : "#6B7280",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-[#3787FF]" />
        </div>
      ) : error ? (
        <p style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>{error}</p>
      ) : (
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={statBoxStyle}><b>{data?.totals.all ?? 0}</b><span>오답</span></div>
            <div style={statBoxStyle}><b>{data?.totals.avgWrongRate ?? 0}%</b><span>평균 오답률</span></div>
            <div style={statBoxStyle}><b>{data?.totals.avgSeconds ?? 0}초</b><span>평균 선택시간</span></div>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: "70px 20px", textAlign: "center", color: "#9CA3AF" }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>오답이 없습니다</p>
              <p style={{ fontSize: 13 }}>문제를 풀면 틀린 항목이 이곳에 자동으로 모입니다.</p>
            </div>
          ) : (
            items.map((item) => (
              <article
                key={`${item.type}-${item.id}`}
                style={{
                  border: focusId === item.id ? "2px solid #3787FF" : "1px solid #E5E7EB",
                  borderRadius: 14,
                  background: "#fff",
                  padding: 14,
                  boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "#EBF3FF", color: "#3787FF", fontSize: 11, fontWeight: 800 }}>
                      {typeLabel(item.type)}
                    </span>
                    <h2 style={{ marginTop: 7, fontSize: 15, fontWeight: 900, color: "#111827", lineHeight: 1.35 }}>
                      {item.subtitle}
                    </h2>
                    <p style={{ marginTop: 2, fontSize: 12, color: "#8A909C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <b style={{ display: "block", color: "#EF4444", fontSize: 18 }}>{item.stats?.wrongRate ?? 0}%</b>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>오답률</span>
                  </div>
                </div>

                {item.passageImage && <img src={item.passageImage} alt="지문" style={imageStyle} />}
                {item.questionImage && <img src={item.questionImage} alt="문제" style={imageStyle} />}

                <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.55, marginBottom: 10 }}>
                  {item.prompt}
                </p>

                {item.choices && (
                  <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                    {item.choices.map((choice, index) => (
                      <div
                        key={`${choice}-${index}`}
                        style={{
                          padding: "9px 10px",
                          borderRadius: 10,
                          background: index + 1 === item.answer ? "#E8F0FE" : "#F9FAFB",
                          color: index + 1 === item.answer ? "#2563EB" : "#4B5563",
                          fontSize: 13,
                          fontWeight: index + 1 === item.answer ? 800 : 600,
                        }}
                      >
                        {index + 1}. {choice}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={answerBoxStyle}><span>내 선택</span><b>{selectedText(item)}</b></div>
                  <div style={answerBoxStyle}><span>정답</span><b>{answerText(item)}</b></div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: item.explanation ? 10 : 0 }}>
                  <span style={metricPillStyle}>누적 {item.stats?.wrongCount ?? 0}/{item.stats?.attempts ?? 0}회 틀림</span>
                  <span style={metricPillStyle}>평균 {item.stats?.avgSeconds ?? 0}초</span>
                </div>

                {item.explanation && (
                  <p style={{ background: "#F9FAFB", borderRadius: 12, padding: 12, color: "#4B5563", fontSize: 13, lineHeight: 1.6 }}>
                    {item.explanation}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const statBoxStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "12px 8px",
  textAlign: "center" as const,
};

const answerBoxStyle: CSSProperties = {
  background: "#F9FAFB",
  borderRadius: 12,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 3,
  fontSize: 12,
  color: "#8A909C",
};

const metricPillStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  background: "#F3F4F6",
  color: "#6B7280",
  fontSize: 11,
  fontWeight: 800,
};

const imageStyle: CSSProperties = {
  width: "100%",
  display: "block",
  borderRadius: 12,
  border: "1px solid #EEF2F7",
  marginBottom: 10,
};

export default function WrongNotePage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#3787FF]" />
      </div>
    }>
      <WrongNoteContent />
    </Suspense>
  );
}
