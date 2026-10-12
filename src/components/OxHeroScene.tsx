/**
 * OX 퀴즈 인트로 머리 그림 — 펼친 책 위로 O·X 유리판이 떠오른다.
 *
 * 사장이 준 3D 컷 세 장(책·파란 O·빨간 X)을 겹쳐 한 장면으로 만든다.
 *  · 등장: 책이 아래에서 올라오고, O·X 가 책 뒤에서 솟아 살짝 넘쳤다 제자리로(차례로).
 *  · 그다음 계속: 아주 느리게 위아래로 떠다니며 조금씩 기운다. 책은 숨 쉬듯 미세하게.
 *  · 등장(한 번)과 떠다님(무한)은 **칸을 나눠** 건다 — 한 요소에 둘 다 걸면 transform 을
 *    서로 덮어써서 등장이 끝나는 순간 툭 튄다.
 *  · 움직임 줄이기를 켠 기기에서는 전부 멈춘다.
 */
export default function OxHeroScene() {
  return (
    <div className="oxh" aria-hidden="true">
      {/* 바닥 그림자 — 책이 떠 있는 느낌 */}
      <span className="oxh-floor" />

      {/* O — 왼쪽 */}
      <span className="oxh-in oxh-in-o">
        <span className="oxh-float oxh-float-o">
          <span className="oxh-glow oxh-glow-o" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ox/disc-o.webp" alt="" width={1254} height={1254} />
        </span>
      </span>

      {/* X — 오른쪽 */}
      <span className="oxh-in oxh-in-x">
        <span className="oxh-float oxh-float-x">
          <span className="oxh-glow oxh-glow-x" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ox/disc-x.webp" alt="" width={1254} height={1254} />
        </span>
      </span>

      {/* 책 — 맨 앞(판이 책 뒤에서 솟는 것처럼 보이게) */}
      <span className="oxh-in oxh-in-book">
        <span className="oxh-float oxh-float-book">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ox/book.webp" alt="" width={1774} height={887} />
        </span>
      </span>

      <style>{`
        .oxh {
          position: relative;
          width: min(320px, 82vw);
          aspect-ratio: 320 / 212;
          margin: 0 auto;
        }
        .oxh img { width: 100%; height: auto; display: block; }
        .oxh-in { position: absolute; display: block; }
        .oxh-float { position: relative; display: block; }
        .oxh-glow {
          position: absolute; top: 6%; right: 6%; bottom: 6%; left: 6%;
          border-radius: 50%; filter: blur(16px); opacity: 0.55; z-index: -1;
        }
        .oxh-glow-o { background: #58B6FF; }
        .oxh-glow-x { background: #FF6B6B; }

        /* 자리 — 책은 아래 가운데, 판 둘은 책 위로 조금 겹쳐 올린다 */
        .oxh-in-book { left: 0; right: 0; bottom: 0; z-index: 3; }
        .oxh-in-o { left: 4%; bottom: 26%; width: 48%; z-index: 2; }
        .oxh-in-x { right: 4%; bottom: 26%; width: 48%; z-index: 1; }

        /* 바닥 그림자 */
        .oxh-floor {
          position: absolute; left: 14%; right: 14%; bottom: 2px; height: 14px;
          border-radius: 50%; background: rgba(13, 48, 66, 0.22); filter: blur(9px);
          animation: oxhFloor 4.4s ease-in-out infinite;
        }

        /* 등장 — 책 먼저, 그다음 O, X */
        .oxh-in-book { animation: oxhBookIn 0.72s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .oxh-in-o { animation: oxhDiscIn 0.86s cubic-bezier(0.22, 1.4, 0.36, 1) 0.18s both; }
        .oxh-in-x { animation: oxhDiscIn 0.86s cubic-bezier(0.22, 1.4, 0.36, 1) 0.34s both; }

        /* 그다음 계속 — 느리게 떠다닌다(등장이 끝난 뒤 시작) */
        .oxh-float-book { animation: oxhBreathe 4.4s ease-in-out 1.1s infinite; }
        .oxh-float-o { animation: oxhFloatO 4.2s ease-in-out 1.1s infinite; }
        .oxh-float-x { animation: oxhFloatX 4.2s ease-in-out 1.35s infinite; }

        @keyframes oxhBookIn {
          from { opacity: 0; transform: translateY(26px) scale(0.88); }
          to { opacity: 1; transform: none; }
        }
        @keyframes oxhDiscIn {
          0% { opacity: 0; transform: translateY(46px) scale(0.55) rotate(-16deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes oxhFloatO {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-9px) rotate(2deg); }
        }
        @keyframes oxhFloatX {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-9px) rotate(-2deg); }
        }
        @keyframes oxhBreathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(2px) scale(1.012); }
        }
        @keyframes oxhFloor {
          0%, 100% { transform: scaleX(1); opacity: 0.22; }
          50% { transform: scaleX(0.92); opacity: 0.16; }
        }
        @media (prefers-reduced-motion: reduce) {
          .oxh-in, .oxh-float, .oxh-floor { animation: none !important; }
          .oxh-in { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
