"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/AlertModal";

const REASONS = [
  { id: "no-use", label: "서비스를 더 이상 이용하지 않아요" },
  { id: "hard-to-use", label: "사용 방법이 어려워요" },
  { id: "no-content", label: "원하는 콘텐츠가 없어요" },
  { id: "error", label: "오류나 불편사항이 많아요" },
  { id: "another-service", label: "다른 서비스를 이용하려고요" },
  { id: "privacy", label: "개인정보가 걱정돼요" },
  { id: "other", label: "기타" },
];

export default function WithdrawPage() {
  const router = useRouter();
  const [step, setStep] = useState<"reason" | "confirm" | "done">("reason");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setIsLoggedIn(true);
          setNickname(data.user.nickname);
        } else {
          setIsLoggedIn(false);
          router.replace("/login");
        }
      })
      .catch(() => {
        setIsLoggedIn(false);
        router.replace("/login");
      });
  }, [router]);

  async function handleWithdraw() {
    setLoading(true);
    try {
      const reasonLabel = REASONS.find((r) => r.id === selectedReason)?.label || selectedReason;
      const res = await fetch("/api/auth/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reasonLabel, detail }),
      });

      if (res.ok) {
        setStep("done");
      } else {
        setShowAlert(true);
      }
    } catch {
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  }

  if (isLoggedIn === null || isLoggedIn === false) return null;

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      {showAlert && (
        <AlertModal
          title="오류가 발생했습니다"
          subtitle="잠시 후 다시 시도해 주세요"
          buttons={[{ label: "확인", bgColor: "#3787FF", color: "#fff", onClick: () => setShowAlert(false) }]}
          onClose={() => setShowAlert(false)}
        />
      )}

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff",
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
      }}>
        <button
          type="button"
          onClick={() => {
            if (step === "confirm") setStep("reason");
            else router.back();
          }}
          className="press"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "none", border: "none" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>회원탈퇴</h1>
      </div>

      {/* Step: Done */}
      {step === "done" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", backgroundColor: "#F3F4F6",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>탈퇴가 완료되었습니다</h2>
          <p style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 32 }}>
            그동안 스타디를 이용해 주셔서 감사합니다.<br />
            더 나은 서비스로 다시 만나뵙겠습니다.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            style={{
              width: "100%", maxWidth: 300, height: 48, borderRadius: 12,
              backgroundColor: "#3787FF", color: "#fff", fontSize: 15,
              fontWeight: 600, border: "none", cursor: "pointer",
            }}
          >
            홈으로 돌아가기
          </button>
        </div>
      )}

      {/* Step: Reason */}
      {step === "reason" && (
        <div style={{ padding: "20px 20px 40px" }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>
              {nickname}님,<br />정말 떠나시는 건가요?
            </h2>
            <p style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>
              탈퇴 사유를 알려주시면 더 나은 서비스를 만드는 데<br />소중히 참고하겠습니다.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {REASONS.map((reason) => {
              const isSelected = selectedReason === reason.id;
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => setSelectedReason(reason.id)}
                  className="press"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px", borderRadius: 12,
                    border: isSelected ? "1.5px solid #3787FF" : "1.5px solid #E5E7EB",
                    backgroundColor: isSelected ? "#F0F6FF" : "#fff",
                    textAlign: "left", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    border: isSelected ? "6px solid #3787FF" : "2px solid #D1D5DB",
                    backgroundColor: "#fff",
                    transition: "all 0.15s ease",
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: isSelected ? "#3787FF" : "#374151" }}>
                    {reason.label}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedReason === "other" && (
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="탈퇴 사유를 자유롭게 작성해 주세요"
              style={{
                width: "100%", marginTop: 12, padding: "12px 14px",
                borderRadius: 12, border: "1.5px solid #E5E7EB",
                fontSize: 14, lineHeight: 1.6, resize: "none", height: 100,
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#3787FF"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
            />
          )}

          <button
            type="button"
            disabled={!selectedReason}
            onClick={() => setStep("confirm")}
            style={{
              width: "100%", height: 52, marginTop: 28, borderRadius: 12,
              backgroundColor: selectedReason ? "#111" : "#E5E7EB",
              color: selectedReason ? "#fff" : "#9CA3AF",
              fontSize: 16, fontWeight: 600, border: "none",
              cursor: selectedReason ? "pointer" : "default",
              transition: "all 0.2s ease",
            }}
          >
            다음
          </button>
        </div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && (
        <div style={{ padding: "20px 20px 40px" }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>
              탈퇴 전 확인해 주세요
            </h2>
            <p style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>
              회원 탈퇴 시 아래의 데이터가 모두 영구 삭제되며,<br />복구할 수 없습니다.
            </p>
          </div>

          <div style={{
            borderRadius: 16, border: "1px solid #FEE2E2", backgroundColor: "#FFF5F5",
            padding: "20px", marginBottom: 24,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { icon: "user", label: "계정 정보", desc: "이메일, 닉네임, 프로필 이미지" },
                { icon: "book", label: "학습 기록", desc: "문제집 풀이 기록, 점수, 소요 시간" },
                { icon: "bookmark", label: "북마크 · 오답 노트", desc: "저장한 모든 북마크 데이터" },
                { icon: "message", label: "문의 내역", desc: "고객센터에 남긴 모든 문의" },
              ].map((item) => (
                <div key={item.icon} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                flex: 1, height: 52, borderRadius: 12,
                backgroundColor: "#F3F4F6", color: "#374151",
                fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={loading}
              style={{
                flex: 1, height: 52, borderRadius: 12,
                backgroundColor: "#EF4444", color: "#fff",
                fontSize: 15, fontWeight: 600, border: "none",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "처리 중..." : "탈퇴하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
