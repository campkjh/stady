"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 캡쳐용 전체화면 — 프로필이 배경에서 무한히 흐르고, 그 위 가운데에 수치를 얹는다.
// 스크롤 없음(고정 오버레이), 색은 쿨그레이 + 브랜드 블루 포인트.

interface Profile { id: string; nickname: string; avatar: string | null }
interface CaptureData {
  year: number;
  month: number;
  totalUsers: number;
  newUsers: { count: number; profiles: Profile[] };
}

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

// 화면을 덮을 줄 수와 줄당 개수. 프로필 수가 모자라면 순환해서 채운다(배경이라 중복 무방).
const ROWS = 16;
const PER_ROW = 32;

function buildRow(all: Profile[], row: number): Profile[] {
  const out: Profile[] = [];
  if (all.length === 0) return out;
  for (let i = 0; i < PER_ROW; i++) out.push(all[(row * 7 + i * 3) % all.length]);
  return out;
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

  const profiles = data?.newUsers.profiles ?? [];

  return (
    <div className="cap-root">
      <button type="button" className="cap-close" onClick={() => router.back()} aria-label="닫기">×</button>

      {/* 배경: 줄마다 반대 방향으로 무한히 흐르는 프로필 */}
      <div className="cap-bg" aria-hidden="true">
        {Array.from({ length: ROWS }).map((_, row) => {
          const items = buildRow(profiles, row);
          if (items.length === 0) return null;
          return (
            <div className="cap-row" key={row}>
              {/* 같은 묶음을 두 벌 이어 붙이고 -50% 로 이동시켜 이음매 없이 반복. */}
              <div
                className={row % 2 ? "cap-track cap-track-rev" : "cap-track"}
                style={{ animationDuration: `${46 + (row % 5) * 7}s` }}
              >
                {[...items, ...items].map((p, i) => (
                  <div key={`${row}-${i}`} className="cap-av" style={{ background: toneFor(p.id) }}>
                    {p.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar} alt="" className="cap-av-img" />
                    ) : (
                      initialOf(p.nickname)
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 가운데를 밝게 덮어 수치가 또렷하게 */}
      <div className="cap-scrim" aria-hidden="true" />

      <div className="cap-center">
        {error ? (
          <p style={{ color: "#D63A3A", fontWeight: 600 }}>{error}</p>
        ) : !data ? (
          <p style={{ color: "#8A909C", fontWeight: 600 }}>불러오는 중…</p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/stady-logo-3d.webp" alt="stady" className="cap-logo" />
            <p className="cap-kicker">스타디와 함께한 {data.year}년 {data.month}월</p>
            <p className="cap-total">{data.totalUsers.toLocaleString("ko-KR")}</p>
            <p className="cap-sub">
              이번달에 함께 해주신 유저님들
              <span className="cap-count">{data.newUsers.count.toLocaleString("ko-KR")}명</span>
            </p>
          </>
        )}
      </div>

      <style>{`
        .cap-root {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 9999;
          background: #FFFFFF; overflow: hidden;
        }
        .cap-close {
          position: fixed; top: 12px; right: 12px; z-index: 3;
          width: 32px; height: 32px; border-radius: 999px; border: none; cursor: pointer;
          background: rgba(25,31,40,0.08); color: #4E5968; font-size: 19px; line-height: 1;
        }
        .cap-bg {
          position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 0;
          display: flex; flex-direction: column; justify-content: center; gap: 10px;
        }
        .cap-row { overflow: hidden; flex-shrink: 0; }
        .cap-track {
          display: flex; gap: 10px; width: max-content;
          animation-name: cap-marquee; animation-timing-function: linear; animation-iteration-count: infinite;
        }
        .cap-track-rev { animation-name: cap-marquee-rev; }
        /* 두 벌을 이어 붙였으므로 -50% 지점이 곧 시작점 — 이음매 없이 무한 반복된다. */
        @keyframes cap-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes cap-marquee-rev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .cap-av {
          width: 44px; height: 44px; border-radius: 999px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 16px; font-weight: 600;
          box-sizing: border-box; flex-shrink: 0;
        }
        .cap-av-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cap-scrim {
          position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 1;
          background: radial-gradient(ellipse at center,
            rgba(255,255,255,0.97) 0%,
            rgba(255,255,255,0.92) 32%,
            rgba(255,255,255,0.72) 58%,
            rgba(255,255,255,0.45) 100%);
        }
        .cap-center {
          position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 2;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 20px;
        }
        .cap-logo { height: 46px; width: auto; display: block; margin: 0 0 12px; }
        .cap-kicker { margin: 0; font-size: 14px; font-weight: 500; color: #6B7684; letter-spacing: -0.2px; }
        .cap-total {
          margin: 6px 0 0; font-size: 96px; line-height: 1; font-weight: 700; color: #3787FF;
          letter-spacing: -0.045em;
        }
        .cap-sub {
          margin: 14px 0 0; font-size: 15px; font-weight: 500; color: #4E5968;
          display: flex; align-items: center; gap: 8px;
        }
        .cap-count {
          font-size: 13px; font-weight: 600; color: #3787FF;
          background: #EAF2FF; border-radius: 999px; padding: 4px 12px;
        }
        @media (max-width: 520px) {
          .cap-total { font-size: 68px; }
          .cap-av { width: 38px; height: 38px; font-size: 14px; }
          .cap-logo { height: 38px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cap-track, .cap-track-rev { animation: none; }
        }
      `}</style>
    </div>
  );
}
