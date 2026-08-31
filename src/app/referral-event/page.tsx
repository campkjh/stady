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
  rewardDays?: number;
  freePremiumUntil?: string | null;
  canClaimThreeMonths: boolean;
  canClaimSixMonths: boolean;
  invitees: Invitee[];
  isMasterAdmin?: boolean;
  allReferrals?: ReferralPair[];
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}.${String(k.getUTCMonth() + 1).padStart(2, "0")}.${String(k.getUTCDate()).padStart(2, "0")}`;
}

const primary = "var(--c-brand)";

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
    <div style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <BackHeader title="오픈베타 이벤트" />

      <div style={{ padding: "8px 20px 28px" }}>
        <div style={{ borderRadius: 18, overflow: "hidden", background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
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

        <section style={{ marginTop: 14, padding: 18, borderRadius: 18, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-4)", fontWeight: 700 }}>내 초대코드</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, height: 48, borderRadius: 14, background: "var(--c-brand-soft-14)", display: "flex", alignItems: "center", padding: "0 14px", color: "var(--c-text)", fontSize: 20, fontWeight: 900, letterSpacing: 0 }}>
              {loading ? "불러오는 중" : summary?.inviteCode || "-"}
            </div>
            <button
              type="button"
              onClick={copyInvite}
              disabled={!summary}
              style={{ width: 86, border: "none", borderRadius: 14, background: summary ? primary : "var(--c-border-strong)", color: "#fff", fontSize: 14, fontWeight: 900 }}
            >
              {copied ? "복사됨" : "공유"}
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--c-text-5)", lineHeight: 1.5 }}>
            친구가 처음 가입할 때 이 초대코드를 입력하면 초대한 친구 목록에 자동으로 추가돼요.
          </p>
        </section>

        {/* 리퍼럴 보상 — 친구 1명 초대할 때마다 결제 없이 무료 프리미엄 (2주) */}
        <section style={{ marginTop: 12, padding: 18, borderRadius: 18, background: "var(--c-brand)", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">🎁</span>
            <h2 style={{ fontSize: 16.5, fontWeight: 900, letterSpacing: "-0.3px" }}>
              친구 1명 초대할 때마다 {summary?.rewardDays ?? 14}일 무료 프리미엄
            </h2>
          </div>
          <p style={{ marginTop: 8, fontSize: 13, fontWeight: 700, opacity: 0.92, lineHeight: 1.5 }}>
            결제 없이, 초대한 친구가 가입을 완료하면 바로 지급돼요. 여러 명 초대하면 기간이 쌓입니다.
          </p>
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.16)", fontSize: 13.5, fontWeight: 800 }}>
            {summary?.freePremiumUntil
              ? `현재 무료 프리미엄 이용 중 · ${fmtDay(summary.freePremiumUntil)}까지`
              : "지금 친구를 초대하고 무료 프리미엄을 받아보세요!"}
          </div>
        </section>

        <section style={{ marginTop: 12, padding: 18, borderRadius: 18, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>초대한 친구</h2>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "var(--c-brand-soft-3)", color: primary, fontSize: 13, fontWeight: 900 }}>
              {summary?.invitedCount || 0}명
            </span>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && <EmptyText text="초대 목록을 불러오는 중이에요." />}
            {!loading && summary?.invitees.length === 0 && <EmptyText text="아직 가입을 완료한 친구가 없어요." />}
            {summary?.invitees.map((invitee) => (
              <div key={invitee.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 58 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "var(--c-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: primary, fontSize: 15, fontWeight: 900 }}>
                  {invitee.avatar ? <img src={invitee.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : invitee.nickname.slice(0, 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invitee.nickname}</p>
                  <p style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: "var(--c-text-5)" }}>{new Date(invitee.invitedAt).toLocaleDateString("ko-KR")} 가입 완료</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {summary?.isMasterAdmin && (
          <section style={{ marginTop: 12, padding: 18, borderRadius: 18, background: "var(--c-bg)", border: `1.5px solid ${primary}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, background: primary, color: "#fff", fontSize: 11, fontWeight: 900, marginBottom: 6 }}>
                  마스터
                </span>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>전체 초대 내역</h2>
              </div>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: "var(--c-brand-soft-3)", color: primary, fontSize: 13, fontWeight: 900 }}>
                {summary.allReferrals?.length || 0}건
              </span>
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.allReferrals && summary.allReferrals.length === 0 && (
                <EmptyText text="아직 등록된 초대 내역이 없어요." />
              )}
              {summary.allReferrals?.map((pair) => (
                <div key={pair.id} style={{ padding: 12, borderRadius: 14, background: "var(--c-bg-soft-14)", display: "flex", alignItems: "center", gap: 10 }}>
                  <ReferralAvatar nickname={pair.inviterNickname} avatar={pair.inviterAvatar} />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pair.inviterNickname}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--c-text-5)", fontWeight: 600 }}>초대한 사람</p>
                  </div>
                  <span style={{ color: primary, fontSize: 18, fontWeight: 900, flexShrink: 0 }}>→</span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pair.inviteeNickname}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--c-text-5)", fontWeight: 600 }}>{new Date(pair.invitedAt).toLocaleDateString("ko-KR")}</p>
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
    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "var(--c-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: primary, fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
      {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : nickname.slice(0, 1)}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div style={{ padding: "18px 0", textAlign: "center", color: "var(--c-text-5)", fontSize: 15, fontWeight: 600 }}>
      {text}
    </div>
  );
}
