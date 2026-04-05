"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Notice {
  id: number;
  title: string;
  date: string;
  detail: string;
}

const NOTICES: Notice[] = [
  {
    id: 1,
    title: "서비스 업데이트 안내",
    date: "2026.04.01",
    detail:
      "안녕하세요, 스타디입니다. 더 나은 학습 경험을 위해 서비스가 업데이트되었습니다. 새로운 UI와 개선된 문제 풀이 환경을 확인해 보세요.",
  },
  {
    id: 2,
    title: "시스템 점검 안내",
    date: "2026.03.25",
    detail:
      "시스템 안정성 향상을 위한 점검이 예정되어 있습니다. 점검 시간: 4월 10일 오전 2시~6시. 해당 시간에는 서비스 이용이 제한될 수 있습니다.",
  },
  {
    id: 3,
    title: "새로운 문제집 추가",
    date: "2026.03.18",
    detail:
      "수학, 영어, 과학 등 다양한 과목의 새로운 문제집이 추가되었습니다. 지금 바로 확인하고 학습을 시작해 보세요!",
  },
  {
    id: 4,
    title: "이벤트 안내",
    date: "2026.03.10",
    detail:
      "스타디 출석 이벤트가 진행 중입니다! 7일 연속 출석 시 특별 문제집을 무료로 제공합니다. 이벤트 기간: 3월 10일~4월 10일.",
  },
  {
    id: 5,
    title: "개인정보 처리방침 변경",
    date: "2026.03.01",
    detail:
      "개인정보 처리방침이 일부 변경되었습니다. 변경된 내용은 마이페이지 > 개인정보 처리방침에서 확인하실 수 있습니다. 변경 시행일: 2026년 4월 1일.",
  },
];

export default function NoticePage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            flexShrink: 0,
            background: "none",
            border: "none",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#111"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>
          공지사항
        </h1>
      </div>

      {/* Notice List */}
      <div style={{ padding: "0 20px" }}>
        {NOTICES.map((notice) => {
          const isOpen = openId === notice.id;
          return (
            <div key={notice.id}>
              <button
                type="button"
                className="press"
                onClick={() => setOpenId(isOpen ? null : notice.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 0",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111",
                      marginBottom: 4,
                    }}
                  >
                    {notice.title}
                  </p>
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>
                    {notice.date}
                  </p>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    marginLeft: 12,
                    transition: "transform 0.2s ease",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div
                style={{
                  overflow: "hidden",
                  maxHeight: isOpen ? 200 : 0,
                  transition: "max-height 0.3s ease",
                }}
              >
                <div
                  style={{
                    padding: "0 0 16px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#4B5563",
                  }}
                >
                  {notice.detail}
                </div>
              </div>
              <div
                style={{ height: 1, backgroundColor: "#F3F4F6" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
