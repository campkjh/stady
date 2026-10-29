// OX 인트로의 유리 카드 화면 색·모양 한 벌 — OX 인트로와 수능대비자료(/csat-prep)가 같이 쓴다.
// (oxi-bg · oxi-card · oxi-fade · quizItemFadeUp · quiz-list-scroll, 라이트/[data-theme="dark"] 두 벌)
export const OXI_THEME_CSS = `
        /* 인트로 전용 색 한 벌. 카드가 유리라 테마 토큰(흰 면/검은 글씨)으로는 안 맞아
           이 화면에서만 쓰는 값을 따로 둔다. 기본=라이트, [data-theme="dark"] 에서 갈아끼운다.
           --oxi-paint 는 배경 그림 자체 — 아래쪽 페이드가 **같은 그림**을 쓰려고 변수로 뺐다
           (단색으로 덮으면 배경이 그라데이션이라 끝에 띠가 생긴다). */
        :root {
          --oxi-paint:
            radial-gradient(60% 42% at 24% 16%, rgba(90, 160, 255, 0.30) 0%, rgba(90, 160, 255, 0) 70%),
            radial-gradient(56% 40% at 78% 20%, rgba(255, 122, 122, 0.22) 0%, rgba(255, 122, 122, 0) 70%),
            radial-gradient(92% 58% at 50% 108%, rgba(176, 206, 245, 0.60) 0%, rgba(246, 249, 255, 0) 70%),
            linear-gradient(168deg, #F7FAFF 0%, #E9F1FB 46%, #F8FAFE 100%);
          --oxi-ink: #15233A;
          --oxi-ink-soft: rgba(21, 35, 58, 0.72);
          --oxi-sub: rgba(21, 35, 58, 0.56);
          --oxi-accent: #2A6FE0;
          --oxi-card-bg: rgba(255, 255, 255, 0.66);
          --oxi-card-bd: rgba(16, 38, 72, 0.10);
          --oxi-card-sh: 0 10px 28px rgba(26, 52, 94, 0.12);
          --oxi-done-bg: rgba(58, 126, 230, 0.13);
          --oxi-done-bd: rgba(58, 126, 230, 0.36);
          --oxi-chip-bg: rgba(42, 111, 224, 0.12);
          --oxi-chip-bd: rgba(42, 111, 224, 0.22);
          --oxi-chip2-bg: rgba(16, 38, 72, 0.07);
          --oxi-chip2-fg: rgba(21, 35, 58, 0.55);
          --oxi-track: rgba(16, 38, 72, 0.12);
          --oxi-prem-fg: #A9790B;
          --oxi-prem-bg: rgba(255, 196, 80, 0.20);
          --oxi-prem-bd: rgba(255, 196, 80, 0.48);
          --oxi-bar: linear-gradient(90deg, #5A9BFF 0%, #2A6FE0 100%);
        }
        [data-theme="dark"] {
          --oxi-paint:
            radial-gradient(60% 42% at 24% 16%, rgba(66, 146, 255, 0.30) 0%, rgba(66, 146, 255, 0) 70%),
            radial-gradient(56% 40% at 78% 20%, rgba(255, 86, 86, 0.22) 0%, rgba(255, 86, 86, 0) 70%),
            radial-gradient(90% 60% at 50% 108%, rgba(24, 68, 110, 0.55) 0%, rgba(10, 20, 32, 0) 70%),
            linear-gradient(168deg, #0C1A2B 0%, #12293C 46%, #0A1420 100%);
          --oxi-ink: #EEF4FB;
          --oxi-ink-soft: rgba(255, 255, 255, 0.92);
          --oxi-sub: rgba(255, 255, 255, 0.62);
          --oxi-accent: #8FC0FF;
          --oxi-card-bg: rgba(255, 255, 255, 0.07);
          --oxi-card-bd: rgba(255, 255, 255, 0.13);
          --oxi-card-sh: 0 10px 30px rgba(0, 0, 0, 0.34);
          --oxi-done-bg: rgba(104, 172, 255, 0.16);
          --oxi-done-bd: rgba(150, 198, 255, 0.46);
          --oxi-chip-bg: rgba(143, 192, 255, 0.16);
          --oxi-chip-bd: rgba(143, 192, 255, 0.28);
          --oxi-chip2-bg: rgba(255, 255, 255, 0.10);
          --oxi-chip2-fg: rgba(255, 255, 255, 0.66);
          --oxi-track: rgba(255, 255, 255, 0.14);
          --oxi-prem-fg: #FFD88A;
          --oxi-prem-bg: rgba(255, 200, 90, 0.18);
          --oxi-prem-bd: rgba(255, 200, 90, 0.36);
          --oxi-bar: linear-gradient(90deg, #8FC0FF 0%, #4A86E8 100%);
        }
        .oxi-bg { background: var(--oxi-paint); }
        /* 목록 끝 페이드 — 배경과 **같은 그림**을 같은 자리에 그린 뒤 위쪽만 깎는다.
           단색으로 덮으면 배경이 그라데이션이라 경계에 띠가 보인다.
           (이 요소는 카드의 조상이 아니라서 mask 를 걸어도 카드 유리가 안 깨진다.) */
        .oxi-fade {
          position: absolute; left: 0; right: 0; bottom: 0; height: 88px; pointer-events: none;
          background: var(--oxi-paint);
          background-size: 100% 100vh;
          background-position: 50% 100%;
          -webkit-mask-image: linear-gradient(to top, #000 45%, transparent 100%);
          mask-image: linear-gradient(to top, #000 45%, transparent 100%);
        }
        /* 유리 카드 — 뒤 배경(번짐)이 비쳐 보이게 */
        .oxi-card {
          background: var(--oxi-card-bg);
          border: 1px solid var(--oxi-card-bd);
          box-shadow: var(--oxi-card-sh);
          -webkit-backdrop-filter: blur(16px) saturate(1.15);
          backdrop-filter: blur(16px) saturate(1.15);
          color: var(--oxi-ink);
        }
        .oxi-card.is-done {
          background: var(--oxi-done-bg);
          border-color: var(--oxi-done-bd);
        }
        @keyframes quizItemFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-list-scroll::-webkit-scrollbar { display: none; }
      `;
