"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import BackHeader from "@/components/BackHeader";
import LoginRequired from "@/components/LoginRequired";

interface Invitee {
  id: string;
  nickname: string;
  avatar: string | null;
  joinedAt: string;
  invitedAt: string;
}

interface ReferralPair {
  id: string;
  invitedAt: string;
  inviterId: string;
  inviterNickname: string;
  inviterAvatar: string | null;
  inviteeId: string;
  inviteeNickname: string;
  inviteeAvatar: string | null;
  inviteCode: string;
}

interface ReferralSummary {
  inviteCode: string;
  invitedCount: number;
  canClaimThreeMonths: boolean;
  canClaimSixMonths: boolean;
  invitees: Invitee[];
  isMasterAdmin?: boolean;
  allReferrals?: ReferralPair[];
}

const primary = "#3787FF";

export default function ReferralEventPage() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then(async (res) => {
        if (res.status === 401) {
          setUnauthorized(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined" || !summary?.inviteCode) return "";
    return `${window.location.origin}/login?invite=${summary.inviteCode}`;
  }, [summary?.inviteCode]);

  const copyInvite = async () => {
    if (!summary) return;
    const text = inviteUrl || summary.inviteCode;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (unauthorized) {
    return <LoginRequired />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F8FF" }}>
      <BackHeader title="오픈베타 이벤트" />

      <div style={{ padding: "12px 12px 28px" }}>
        <div style={{ borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 10px 26px rgba(55,135,255,0.14)" }}>
          <Image
            src="/banners/referral-detail.png"
            alt="스타디 오픈베타 이벤트"
            width={768}
            height={2048}
            priority
            unoptimized
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>

        <section style={{ marginTop: 14, padding: 18, borderRadius: 18, background: "#fff", boxShadow: "0 8px 22px rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>내 초대코드</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, height: 48, borderRadius: 14, background: "#F3F7FF", display: "flex", alignItems: "center", padding: "0 14px", color: "#111827", fontSize: 20, fontWeight: 900, letterSpacing: 0 }}>
              {loading ? "불러오는 중" : summary?.inviteCode || "-"}
            </div>
            <button
              type="button"
              onClick={copyInvite}
              disabled={!summary}
              style={{ width: 86, border: "none", borderRadius: 14, background: summary ? primary : "#D1D5DB", color: "#fff", fontSize: 14, fontWeight: 900 }}
            >
              {copied ? "복사됨" : "공유"}
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, color: "#8A909C", lineHeight: 1.5 }}>
            친구가 처음 가입할 때 이 초대코드를 입력하면 초대한 친구 목록에 자동으로 추가돼요.
          </p>
        </section>

        <section style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <RewardCard title="3개월 무료권 받기" count="5명" active={!!summary?.canClaimThreeMonths} />
          <RewardCard title="6개월 무료권 받기" count="10명" active={!!summary?.canClaimSixMonths} />
        </section>

        <section style={{ marginTop: 12, padding: 18, borderRadius: 18, background: "#fff", boxShadow: "0 8px 22px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>초대한 친구</h2>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#EEF5FF", color: primary, fontSize: 13, fontWeight: 900 }}>
              {summary?.invitedCount || 0}명
            </span>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && <EmptyText text="초대 목록을 불러오는 중이에요." />}
            {!loading && summary?.invitees.length === 0 && <EmptyText text="아직 가입을 완료한 친구가 없어요." />}
            {summary?.invitees.map((invitee) => (
              <div key={invitee.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center", color: primary, fontSize: 15, fontWeight: 900 }}>
                  {invitee.avatar ? <img src={invitee.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : invitee.nickname.slice(0, 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invitee.nickname}</p>
                  <p style={{ marginTop: 2, fontSize: 12, color: "#9CA3AF" }}>{new Date(invitee.invitedAt).toLocaleDateString("ko-KR")} 가입 완료</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {summary?.isMasterAdmin && (
          <section style={{ marginTop: 12, padding: 18, borderRadius: 18, background: "#fff", boxShadow: "0 8px 22px rgba(15,23,42,0.06)", border: `1.5px solid ${primary}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, background: primary, color: "#fff", fontSize: 11, fontWeight: 900, marginBottom: 6 }}>
                  마스터
                </span>
                <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>전체 초대 내역</h2>
              </div>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: "#EEF5FF", color: primary, fontSize: 13, fontWeight: 900 }}>
                {summary.allReferrals?.length || 0}건
              </span>
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.allReferrals && summary.allReferrals.length === 0 && (
                <EmptyText text="아직 등록된 초대 내역이 없어요." />
              )}
              {summary.allReferrals?.map((pair) => (
                <div key={pair.id} style={{ padding: 12, borderRadius: 14, background: "#F9FBFF", display: "flex", alignItems: "center", gap: 10 }}>
                  <ReferralAvatar nickname={pair.inviterNickname} avatar={pair.inviterAvatar} />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pair.inviterNickname}
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>초대한 사람</p>
                  </div>
                  <span style={{ color: primary, fontSize: 18, fontWeight: 900, flexShrink: 0 }}>→</span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pair.inviteeNickname}
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>{new Date(pair.invitedAt).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <ReferralAvatar nickname={pair.inviteeNickname} avatar={pair.inviteeAvatar} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ReferralAvatar({ nickname, avatar }: { nickname: string; avatar: string | null }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center", color: primary, fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
      {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : nickname.slice(0, 1)}
    </div>
  );
}

function RewardCard({ title, count, active }: { title: string; count: string; active: boolean }) {
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => active && alert("혜택 신청이 접수되었습니다.")}
      style={{
        minHeight: 108,
        padding: 14,
        border: "none",
        borderRadius: 18,
        background: active ? "linear-gradient(135deg, #3787FF, #2ED3A6)" : "#fff",
        color: active ? "#fff" : "#9CA3AF",
        boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
        textAlign: "left",
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 900, opacity: active ? 0.9 : 1 }}>{count} 초대 시</p>
      <p style={{ marginTop: 10, fontSize: 17, lineHeight: 1.25, fontWeight: 900 }}>{title}</p>
      <p style={{ marginTop: 8, fontSize: 12, fontWeight: 800 }}>{active ? "활성화됨" : "아직 비활성화"}</p>
    </button>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div style={{ padding: "18px 0", textAlign: "center", color: "#9CA3AF", fontSize: 14, fontWeight: 700 }}>
      {text}
    </div>
  );
}
