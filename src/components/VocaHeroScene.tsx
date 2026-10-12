/**
 * 영단어 퀴즈 인트로 머리 그림 — 영어 단어장 앞으로 A·B·C 유리 카드와 과일이 떠오른다.
 *
 * 사장이 준 3D 컷(단어장·A/B/C 유리 칩·사과/바나나/코코넛)을 한 장면으로 겹친다.
 *  · 등장: 칩 셋이 단어장 뒤에서 부채처럼 펼쳐지고, 단어장이 올라오고, 과일이 톡톡 튀어 든다.
 *  · 그다음 계속: 칩·과일이 제각각 느리게 떠다니고 단어장은 숨 쉰다.
 *  · OxHeroScene 과 같은 규칙 — 등장(한 번)과 떠다님(무한)은 **칸을 나눠** 건다.
 *    한 요소에 둘 다 걸면 transform 이 서로 덮어써서 등장이 끝나는 순간 툭 튄다.
 *  · 움직임 줄이기를 켠 기기에서는 전부 멈춘다.
 */
const PIECES = [
  // [키, 파일, 자리 클래스, 이미지 가로세로]
  { key: "chip-c", src: "chip-coconut", w: 640, h: 473 },
  { key: "chip-a", src: "chip-apple", w: 640, h: 507 },
  { key: "chip-b", src: "chip-banana", w: 640, h: 527 },
] as const;

export default function VocaHeroScene() {
  return (
    <div className="vch" aria-hidden="true">
      <span className="vch-floor" />
      <span className="vch-glow" />

      {/* 칩 — 단어장 뒤에서 펼쳐진다 */}
      {PIECES.map((p) => (
        <span key={p.key} className={`vch-in vch-in-${p.key}`}>
          <span className={`vch-float vch-float-${p.key}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/voca/${p.src}.webp`} alt="" width={p.w} height={p.h} />
          </span>
        </span>
      ))}

      {/* 단어장 */}
      <span className="vch-in vch-in-book">
        <span className="vch-float vch-float-book">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/voca/notebook.webp" alt="" width={900} height={778} />
        </span>
      </span>

      {/* 과일 — 맨 앞 */}
      <span className="vch-in vch-in-apple">
        <span className="vch-float vch-float-apple">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/voca/apple.webp" alt="" width={520} height={506} />
        </span>
      </span>
      <span className="vch-in vch-in-banana">
        <span className="vch-float vch-float-banana">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/voca/banana.webp" alt="" width={520} height={494} />
        </span>
      </span>
      <span className="vch-in vch-in-coconut">
        <span className="vch-float vch-float-coconut">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/voca/coconut.webp" alt="" width={520} height={474} />
        </span>
      </span>

      <style>{`
        .vch {
          position: relative;
          width: min(330px, 84vw);
          aspect-ratio: 330 / 262;
          margin: 0 auto;
        }
        .vch img { width: 100%; height: auto; display: block; }
        .vch-in { position: absolute; display: block; }
        .vch-float { position: relative; display: block; }

        /* 단어장 뒤 보랏빛 번짐 — 라이트에선 은은하게, 다크에선 더 태운다 */
        .vch-glow {
          position: absolute; left: 18%; right: 18%; top: 18%; bottom: 8%;
          border-radius: 50%; filter: blur(26px); opacity: 0.42;
          background: radial-gradient(closest-side, #A58BFF, rgba(165, 139, 255, 0));
        }
        [data-theme="dark"] .vch-glow { opacity: 0.6; }
        .vch-floor {
          position: absolute; left: 18%; right: 18%; bottom: 0; height: 14px;
          border-radius: 50%; background: rgba(60, 40, 120, 0.18); filter: blur(9px);
          animation: vchFloor 4.6s ease-in-out infinite;
        }
        [data-theme="dark"] .vch-floor { background: rgba(0, 0, 0, 0.42); }

        /* 자리 */
        .vch-in-book   { left: 23%; width: 54%; bottom: 3%; z-index: 3; }
        .vch-in-chip-c { left: 33%; width: 34%; top: 0;     z-index: 0; }
        .vch-in-chip-a { left: -2%; width: 36%; top: 7%;    z-index: 1; }
        .vch-in-chip-b { right: -2%; width: 36%; top: 4%;   z-index: 1; }
        .vch-in-apple   { left: 6%;  width: 21%; bottom: 3%; z-index: 4; }
        .vch-in-banana  { left: 38%; width: 24%; bottom: -3%; z-index: 4; }
        .vch-in-coconut { right: 4%; width: 24%; bottom: 3%; z-index: 4; }

        /* 등장 — 칩 → 단어장 → 과일 */
        .vch-in-chip-c { animation: vchChipIn 0.8s cubic-bezier(0.22, 1.3, 0.36, 1) 0.05s both; }
        .vch-in-chip-a { animation: vchChipInL 0.8s cubic-bezier(0.22, 1.3, 0.36, 1) 0.14s both; }
        .vch-in-chip-b { animation: vchChipInR 0.8s cubic-bezier(0.22, 1.3, 0.36, 1) 0.23s both; }
        .vch-in-book   { animation: vchBookIn 0.74s cubic-bezier(0.22, 1, 0.36, 1) 0.28s both; }
        .vch-in-apple   { animation: vchFruitIn 0.7s cubic-bezier(0.22, 1.5, 0.36, 1) 0.62s both; }
        .vch-in-banana  { animation: vchFruitIn 0.7s cubic-bezier(0.22, 1.5, 0.36, 1) 0.74s both; }
        .vch-in-coconut { animation: vchFruitIn 0.7s cubic-bezier(0.22, 1.5, 0.36, 1) 0.86s both; }

        /* 그다음 계속 — 제각각 느리게(등장이 끝난 뒤 시작) */
        .vch-float-book    { animation: vchBreathe 4.6s ease-in-out 1.5s infinite; }
        .vch-float-chip-c  { animation: vchFloatA 4.4s ease-in-out 1.3s infinite; }
        .vch-float-chip-a  { animation: vchFloatB 4.8s ease-in-out 1.45s infinite; }
        .vch-float-chip-b  { animation: vchFloatA 5.2s ease-in-out 1.6s infinite; }
        .vch-float-apple   { animation: vchFloatB 3.8s ease-in-out 1.7s infinite; }
        .vch-float-banana  { animation: vchFloatA 4.1s ease-in-out 1.85s infinite; }
        .vch-float-coconut { animation: vchFloatB 4.4s ease-in-out 2s infinite; }

        @keyframes vchChipIn {
          from { opacity: 0; transform: translateY(40px) scale(0.7); }
          to { opacity: 1; transform: none; }
        }
        @keyframes vchChipInL {
          from { opacity: 0; transform: translate(44px, 34px) scale(0.7) rotate(14deg); }
          to { opacity: 1; transform: none; }
        }
        @keyframes vchChipInR {
          from { opacity: 0; transform: translate(-44px, 34px) scale(0.7) rotate(-14deg); }
          to { opacity: 1; transform: none; }
        }
        @keyframes vchBookIn {
          from { opacity: 0; transform: translateY(30px) scale(0.88); }
          to { opacity: 1; transform: none; }
        }
        @keyframes vchFruitIn {
          from { opacity: 0; transform: translateY(34px) scale(0.4) rotate(-22deg); }
          to { opacity: 1; transform: none; }
        }
        @keyframes vchFloatA {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50% { transform: translateY(-8px) rotate(1.5deg); }
        }
        @keyframes vchFloatB {
          0%, 100% { transform: translateY(0) rotate(1.5deg); }
          50% { transform: translateY(-7px) rotate(-1.5deg); }
        }
        @keyframes vchBreathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(2px) scale(1.012); }
        }
        @keyframes vchFloor {
          0%, 100% { transform: scaleX(1); opacity: 0.9; }
          50% { transform: scaleX(0.92); opacity: 0.65; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vch-in, .vch-float, .vch-floor { animation: none !important; }
          .vch-in { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
