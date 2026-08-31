"use client";

// 프리미엄(스타디 프라임) 사용자 전용 배너 — 마이페이지 티어 뱃지 아래.
// 은은한 보라 물결이 아주 천천히 흐르고, 유리 광택이 사선으로 지나간다(고급스럽게).
export default function StadyPrimeBanner({
  expiresAt,
  autoRenew,
}: {
  expiresAt?: string | null;
  autoRenew?: boolean;
}) {
  // 만료일이 2년 이내일 때만 병기(리퍼럴 무료·결제 구독). 관리자 등 초장기 지급은 생략.
  const withinWindow =
    !!expiresAt && new Date(expiresAt).getTime() - Date.now() < 2 * 365 * 24 * 3600 * 1000;
  const meta = withinWindow
    ? `${autoRenew ? "다음 갱신일" : "이용 종료일"} ${fmtDate(expiresAt!)}`
    : "";

  return (
    <div className="prime-banner" role="img" aria-label="스타디 프라임 이용 중">
      <span className="prime-wave" aria-hidden="true" />
      <span className="prime-wave prime-wave-2" aria-hidden="true" />
      <span className="prime-shine" aria-hidden="true" />

      <div className="prime-inner">
        <div className="prime-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/stady-app-icon.svg" alt="" className="prime-icon" />
          <span className="prime-word">
            stady <b>prime</b>
          </span>
        </div>
        <p className="prime-sub">집중의 차이를 만드는 프리미엄 학습 경험</p>
        {meta && <p className="prime-meta">{meta}</p>}
      </div>

      <style>{`
        .prime-banner {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          border-radius: 20px;
          padding: 22px 22px 24px;
          border: 1px solid rgba(139, 128, 222, 0.18);
          background: linear-gradient(135deg, #eef1fd 0%, #eae8fb 46%, #f2ecfc 100%);
          box-shadow: 0 10px 30px rgba(120, 108, 200, 0.13);
        }
        /* 은은한 보라 물결 — 아주 느리게 좌우로 흐른다 */
        .prime-wave {
          position: absolute;
          inset: -45% -25%;
          z-index: -2;
          background: radial-gradient(58% 80% at 30% 50%, rgba(150, 120, 240, 0.24), transparent 70%);
          filter: blur(4px);
          animation: primeWave 10s ease-in-out infinite;
        }
        .prime-wave-2 {
          background: radial-gradient(52% 72% at 72% 42%, rgba(122, 142, 250, 0.2), transparent 70%);
          animation: primeWave2 13s ease-in-out infinite;
          animation-delay: -4s;
        }
        @keyframes primeWave {
          0%, 100% { transform: translate(-11%, 0); }
          50%      { transform: translate(11%, -4%); }
        }
        @keyframes primeWave2 {
          0%, 100% { transform: translate(9%, 2%); }
          50%      { transform: translate(-9%, -2%); }
        }
        /* 유리 광택 사선 스윕 — 아주 은은하게 한 번씩 지나간다 */
        .prime-shine {
          position: absolute;
          top: -20%;
          bottom: -20%;
          width: 45%;
          z-index: -1;
          background: linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.55) 50%, transparent 80%);
          transform: translateX(-160%) skewX(-12deg);
          animation: primeShine 8s ease-in-out infinite;
        }
        @keyframes primeShine {
          0%        { transform: translateX(-160%) skewX(-12deg); }
          60%, 100% { transform: translateX(340%) skewX(-12deg); }
        }
        .prime-inner { position: relative; z-index: 1; }
        .prime-title { display: flex; align-items: center; gap: 11px; }
        .prime-icon { width: 34px; height: 34px; border-radius: 9px; display: block; box-shadow: 0 3px 10px rgba(49, 130, 246, 0.22); }
        .prime-word {
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -0.6px;
          color: #2a2c44;
        }
        .prime-word b {
          font-weight: 900;
          background: linear-gradient(92deg, #6f74ff, #9a6ff0);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .prime-sub {
          margin: 12px 0 0;
          font-size: 13.5px;
          font-weight: 600;
          color: #5b567e;
          letter-spacing: -0.2px;
        }
        .prime-meta {
          margin: 10px 0 0;
          font-size: 12px;
          font-weight: 700;
          color: #7b76a0;
        }
        /* 다크: 깊은 인디고/퍼플로 뒤집되, 물결·광택은 그대로 은은하게 */
        [data-theme="dark"] .prime-banner {
          border-color: rgba(150, 140, 235, 0.22);
          background: linear-gradient(135deg, #1e1b33 0%, #241f3d 48%, #2b2142 100%);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }
        [data-theme="dark"] .prime-wave { background: radial-gradient(58% 80% at 30% 50%, rgba(150, 120, 240, 0.3), transparent 70%); }
        [data-theme="dark"] .prime-wave-2 { background: radial-gradient(52% 72% at 72% 42%, rgba(122, 142, 250, 0.26), transparent 70%); }
        [data-theme="dark"] .prime-shine { background: linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.14) 50%, transparent 80%); }
        [data-theme="dark"] .prime-word { color: #ecebff; }
        [data-theme="dark"] .prime-word b { background: linear-gradient(92deg, #9aa0ff, #c3a0ff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        [data-theme="dark"] .prime-sub { color: #b6b1de; }
        [data-theme="dark"] .prime-meta { color: #9b96c4; }
        @media (prefers-reduced-motion: reduce) {
          .prime-wave, .prime-wave-2, .prime-shine { animation: none; }
        }
      `}</style>
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}.${String(k.getUTCMonth() + 1).padStart(2, "0")}.${String(k.getUTCDate()).padStart(2, "0")}`;
}
