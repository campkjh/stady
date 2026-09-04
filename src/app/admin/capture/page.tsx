"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 캡쳐용 전체화면 — 회원수를 크게 보여주고 이번달 가입/구독 회원 프로필을 촘촘히 깐다.
// 어드민 레이아웃(사이드바·패딩) 위를 덮어야 하므로 fixed 오버레이로 띄운다.

interface Profile { id: string; nickname: string; avatar: string | null }
interface CaptureData {
  year: number;
  month: number;
  totalUsers: number;
  newUsers: { count: number; profiles: Profile[] };
  subscribers: { count: number; profiles: Profile[] };
}

// 아바타가 없는 사용자가 대부분이라, 닉네임 첫 글자 + 고정 색으로 채운다.
const PALETTE = ["#6C8BFF", "#8B5CFF", "#FF6FA5", "#FF9245", "#2BC0A8", "#3AA9F5", "#F5B723", "#EF6B6B"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initialOf(nickname: string) {
  const t = (nickname || "").trim();
  return t ? Array.from(t)[0] : "?";
}

function Avatars({ profiles, total }: { profiles: Profile[]; total: number }) {
  const rest = total - profiles.length;
  return (
    <>
      <div className="cap-grid">
        {profiles.map((p) => (
          <div key={p.id} className="cap-av" title={p.nickname} style={{ background: colorFor(p.id) }}>
            {p.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar} alt="" className="cap-av-img" />
            ) : (
              initialOf(p.nickname)
            )}
          </div>
        ))}
        {rest > 0 && <div className="cap-av cap-av-rest">+{rest.toLocaleString("ko-KR")}</div>}
      </div>
    </>
  );
}

export default function AdminCapturePage() {
  const router = useRouter();
  const [data, setData] = useState<CaptureData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/capture", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "관리자 권한이 필요합니다." : "불러오지 못했습니다.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "오류가 발생했습니다."));
  }, []);

  return (
    <div className="cap-root">
      <button type="button" className="cap-close" onClick={() => router.back()} aria-label="닫기">×</button>

      {error ? (
        <p style={{ color: "#fff", fontWeight: 700 }}>{error}</p>
      ) : !data ? (
        <p style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>불러오는 중…</p>
      ) : (
        <div className="cap-inner">
          <div className="cap-head">
            <p className="cap-kicker">스타디와 함께한 {data.year}년 {data.month}월</p>
            <p className="cap-total">{data.totalUsers.toLocaleString("ko-KR")}</p>
            <p className="cap-total-sub">명의 학습자와 함께하고 있어요</p>
          </div>

          <section className="cap-sec">
            <p className="cap-sec-title">
              이번달에 함께 해주신 유저님들
              <span className="cap-count">{data.newUsers.count.toLocaleString("ko-KR")}명</span>
            </p>
            <Avatars profiles={data.newUsers.profiles} total={data.newUsers.count} />
          </section>

          <section className="cap-sec">
            <p className="cap-sec-title">
              이번달에 구독해주신 회원님들
              <span className="cap-count">{data.subscribers.count.toLocaleString("ko-KR")}명</span>
            </p>
            <Avatars profiles={data.subscribers.profiles} total={data.subscribers.count} />
          </section>

          <p className="cap-foot">stady</p>
        </div>
      )}

      <style>{`
        .cap-root {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 9999;
          background: linear-gradient(160deg, #4B5BD7 0%, #7B5CE0 42%, #B96BD8 100%);
          overflow-y: auto; -webkit-overflow-scrolling: touch;
          display: flex; align-items: flex-start; justify-content: center;
          padding: 28px 18px 34px; box-sizing: border-box;
        }
        .cap-close {
          position: fixed; top: 14px; right: 14px; z-index: 2;
          width: 34px; height: 34px; border-radius: 999px; border: none; cursor: pointer;
          background: rgba(255,255,255,0.22); color: #fff; font-size: 20px; line-height: 1;
        }
        .cap-inner { width: 100%; max-width: 900px; }
        .cap-head { text-align: center; margin-bottom: 30px; }
        .cap-kicker { margin: 0; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.86); letter-spacing: -0.2px; }
        .cap-total {
          margin: 10px 0 0; font-size: 92px; line-height: 1; font-weight: 900; color: #fff;
          letter-spacing: -0.045em; text-shadow: 0 6px 26px rgba(0,0,0,0.18);
        }
        .cap-total-sub { margin: 12px 0 0; font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.9); }
        .cap-sec {
          background: rgba(255,255,255,0.13); border: 1px solid rgba(255,255,255,0.22);
          border-radius: 22px; padding: 18px 16px; margin-bottom: 16px;
        }
        .cap-sec-title {
          margin: 0 0 14px; font-size: 16px; font-weight: 800; color: #fff;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .cap-count {
          flex-shrink: 0; font-size: 13.5px; font-weight: 800; color: #fff;
          background: rgba(255,255,255,0.25); border-radius: 999px; padding: 4px 12px;
        }
        .cap-grid { display: flex; flex-wrap: wrap; gap: 7px; }
        .cap-av {
          width: 44px; height: 44px; border-radius: 999px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 16px; font-weight: 800;
          border: 2px solid rgba(255,255,255,0.5); box-sizing: border-box; flex-shrink: 0;
        }
        .cap-av-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cap-av-rest { background: rgba(255,255,255,0.28); font-size: 12.5px; }
        .cap-foot {
          text-align: center; margin: 22px 0 0; font-size: 15px; font-weight: 800;
          color: rgba(255,255,255,0.72); letter-spacing: 0.02em;
        }
        @media (max-width: 520px) {
          .cap-total { font-size: 68px; }
          .cap-av { width: 38px; height: 38px; font-size: 14px; }
          .cap-sec-title { font-size: 14.5px; }
        }
      `}</style>
    </div>
  );
}
