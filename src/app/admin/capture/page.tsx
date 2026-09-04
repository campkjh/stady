"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 캡쳐용 전체화면 — 한 화면에 딱 맞게(스크롤 없음) 회원수와 이번달 성과를 보여준다.
// 색은 앱 브랜드 블루(#3787FF) 계열 톤으로만 쓴다(알록달록 금지).

interface Profile { id: string; nickname: string; avatar: string | null }
interface CaptureData {
  year: number;
  month: number;
  totalUsers: number;
  newUsers: { count: number; profiles: Profile[] };
}

// 쿨그레이 한 계열의 명도 변주 — 프로필 원 배경.
const TONES = ["#8B95A1", "#A7B0BA", "#6B7684", "#C2C9D1", "#9AA4AF", "#7A848F"];
function toneFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
function initialOf(nickname: string) {
  const t = (nickname || "").trim();
  return t ? Array.from(t)[0] : "?";
}

function Avatars({ profiles, rows, fill }: { profiles: Profile[]; rows?: number; fill?: boolean }) {
  return (
    <div
      className={fill ? "cap-grid cap-grid-fill" : "cap-grid"}
      style={rows ? { ["--rows" as string]: String(rows) } : undefined}
    >
      {profiles.map((p) => (
        <div key={p.id} className="cap-av" title={p.nickname} style={{ background: toneFor(p.id) }}>
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt="" className="cap-av-img" />
          ) : (
            initialOf(p.nickname)
          )}
        </div>
      ))}
    </div>
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
        <p style={{ color: "#D63A3A", fontWeight: 700 }}>{error}</p>
      ) : !data ? (
        <p style={{ color: "#8A909C", fontWeight: 700 }}>불러오는 중…</p>
      ) : (
        <div className="cap-inner">
          <div className="cap-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/stady-logo-3d.webp" alt="stady" className="cap-logo" />
            <p className="cap-kicker">스타디와 함께한 {data.year}년 {data.month}월</p>
            <p className="cap-total">{data.totalUsers.toLocaleString("ko-KR")}</p>
          </div>

          <section className="cap-sec cap-sec-fill">
            <p className="cap-sec-title">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/capture/users.svg" alt="" className="cap-ti" />
              이번달에 함께 해주신 유저님들
              <span className="cap-count">{data.newUsers.count.toLocaleString("ko-KR")}명</span>
            </p>
            <Avatars profiles={data.newUsers.profiles} fill />
          </section>

        </div>
      )}

      <style>{`
        .cap-root {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 9999;
          background: #FFFFFF;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          padding: 20px 16px; box-sizing: border-box;
        }
        .cap-close {
          position: fixed; top: 12px; right: 12px; z-index: 2;
          width: 32px; height: 32px; border-radius: 999px; border: none; cursor: pointer;
          background: rgba(25,31,40,0.08); color: #4E5968; font-size: 19px; line-height: 1;
        }
        .cap-inner {
          width: 100%; max-width: 720px; height: 100%;
          display: flex; flex-direction: column; gap: 12px; overflow: hidden;
        }
        .cap-head { text-align: center; flex-shrink: 0; }
        .cap-kicker { margin: 0; font-size: 14px; font-weight: 500; color: #6B7684; letter-spacing: -0.2px; }
        .cap-total {
          margin: 6px 0 0; font-size: 76px; line-height: 1; font-weight: 700; color: #3787FF;
          letter-spacing: -0.045em;
        }
        .cap-sec {
          padding: 0 2px;
          display: flex; flex-direction: column;
          flex: 0 0 auto; min-height: 0; overflow: hidden;
        }
        /* 남는 세로 공간을 이 섹션이 전부 차지한다(아래가 비지 않게). */
        .cap-sec-fill { flex: 1 1 auto; }
        .cap-sec-fill .cap-sec-title { flex-shrink: 0; }
        .cap-sec-title {
          margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #191F28;
          display: flex; align-items: center; gap: 7px;
        }
        .cap-ti { width: 19px; height: 19px; flex-shrink: 0; display: block; }
        /* 654x240 비율 로고 — 높이만 고정하고 폭은 비율대로. */
        .cap-logo { height: 46px; width: auto; display: block; margin: 0 auto 10px; }
        .cap-count {
          margin-left: auto; flex-shrink: 0; font-size: 13px; font-weight: 600; color: #3787FF;
          background: #EAF2FF; border-radius: 999px; padding: 4px 12px;
        }
        /* 지정한 줄 수까지만 보이고 나머지는 잘라낸다 — 스크롤이 생기지 않게. */
        .cap-grid {
          display: flex; flex-wrap: wrap; gap: 6px;
          /* 한 줄이 살짝 걸치게 두고 아래를 페이드 — 딱 잘린 느낌 대신 자연스럽게 사라진다. */
          max-height: calc(var(--rows) * 44px + 14px); overflow: hidden; align-content: flex-start;
          -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 36px), transparent 100%);
          mask-image: linear-gradient(to bottom, #000 calc(100% - 36px), transparent 100%);
        }
        .cap-grid-fill { max-height: none; flex: 1 1 auto; min-height: 0; }
        .cap-av {
          width: 38px; height: 38px; border-radius: 999px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 14.5px; font-weight: 600;
          box-sizing: border-box; flex-shrink: 0;
        }
        .cap-av-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        @media (max-width: 520px) {
          .cap-total { font-size: 60px; }
          .cap-av { width: 34px; height: 34px; font-size: 13px; }
          .cap-grid { max-height: calc(var(--rows) * 40px + 12px); }
          .cap-sec-title { font-size: 14px; }
        }
        @media (max-height: 720px) {
          .cap-total { font-size: 54px; }
        }
      `}</style>
    </div>
  );
}
