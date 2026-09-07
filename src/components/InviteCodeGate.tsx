"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 가입 직후 초대코드를 물어보는 시트.
// 초대 링크는 브라우저에서 열고 가입은 앱(웹뷰)에서 하는 경우가 많은데, 둘은 저장소가 달라
// 링크로 담아둔 코드가 사라진다. 그래서 "코드를 직접 넣을 자리"를 가입 직후에 한 번 띄운다.
// 대상은 서버 판정(canEnterCode = 아직 초대 미적용 + 가입 후 7일 이내)을 그대로 따른다.
const SKIP_KEY = "invite_code_gate_skipped";

export default function InviteCodeGate() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let skipped = false;
    try {
      skipped = localStorage.getItem(SKIP_KEY) === "1";
    } catch {
      /* 저장소가 막혀 있으면 그냥 노출 */
    }
    if (skipped) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    fetch("/api/referrals", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || d?.canEnterCode !== true) return;
        // 다른 첫진입 모달(닉네임 변경·설문)이 떠 있으면 그것이 닫힐 때까지 기다렸다가 띄운다.
        // 예전엔 한 번 보고 건너뛰어서, 설문이 먼저 뜨는 신규 유저에게는 아예 보이지 않았다.
        let waited = 0;
        const tick = () => {
          if (!alive) return;
          if (!document.querySelector("[data-gate]")) {
            setOpen(true);
            return;
          }
          waited += 1200;
          if (waited > 120_000) return; // 2분까지만 기다린다
          timer = setTimeout(tick, 1200);
        };
        timer = setTimeout(tick, 1500);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  function skip() {
    try {
      localStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function apply() {
    const v = code.trim();
    if (!v || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/referrals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: v }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error || "초대코드를 적용하지 못했어요.");
        return;
      }
      setDone(true);
      try {
        localStorage.setItem(SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
      setTimeout(() => setOpen(false), 1600);
    } catch {
      setError("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  const sheet = (
    <div className="icg-dim" data-gate="invite">
      <div className="icg" role="dialog" aria-label="초대코드 입력">
        {done ? (
          <>
            <img className="icg-icon" src="/icons/toss/gift.svg" alt="" />
            <h2 className="icg-title">초대코드가 적용됐어요!</h2>
            <p className="icg-desc">나와 친구 모두 스타디 프라임 2주 무료 이용권을 받았어요.</p>
          </>
        ) : (
          <>
            <img className="icg-icon" src="/icons/toss/gift.svg" alt="" />
            <h2 className="icg-title">초대코드가 있나요?</h2>
            <p className="icg-desc">
              친구에게 받은 초대코드를 넣으면 <b>나와 친구 모두</b> 프라임 2주 무료 이용권을 받아요.
            </p>
            <input
              className={`icg-input${error ? " is-err" : ""}`}
              value={code}
              maxLength={20}
              autoCapitalize="characters"
              placeholder="STADY..."
              onChange={(e) => { setCode(e.target.value); if (error) setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            />
            <div className="icg-err">{error}</div>
            <button type="button" className="icg-primary" onClick={apply} disabled={busy || !code.trim()}>
              {busy ? "적용 중…" : "초대코드 적용하기"}
            </button>
            <button type="button" className="icg-skip" onClick={skip}>초대코드가 없어요</button>
          </>
        )}
      </div>

      <style>{`
        .icg-dim {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 2600;
          background: rgba(15,23,42,0.5);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .icg {
          width: 100%; max-width: 520px;
          background: var(--c-bg);
          border-radius: 20px 20px 0 0;
          padding: 24px 20px calc(16px + env(safe-area-inset-bottom, 0px));
          box-sizing: border-box; text-align: center;
        }
        .icg-icon { width: 44px; height: 44px; display: block; margin: 0 auto 10px; }
        .icg-title { margin: 0 0 8px; font-size: 19px; font-weight: 800; color: var(--c-text-b); }
        .icg-desc { margin: 0 0 16px; font-size: 13.5px; line-height: 1.6; color: var(--c-text-2d); }
        .icg-input {
          width: 100%; height: 50px; border-radius: 12px;
          border: 1.5px solid var(--c-border); background: var(--c-bg-muted);
          padding: 0 14px; font-size: 16px; font-weight: 700; color: var(--c-text);
          outline: none; box-sizing: border-box; text-align: center;
        }
        .icg-input.is-err { border-color: #E5484D; }
        .icg-err { min-height: 18px; margin-top: 7px; font-size: 12.5px; font-weight: 700; color: #E5484D; }
        .icg-primary {
          width: 100%; height: 50px; border: none; border-radius: 12px;
          background: var(--c-brand); color: #fff; font-size: 15.5px; font-weight: 800; cursor: pointer;
        }
        .icg-primary:disabled { opacity: 0.5; }
        .icg-skip {
          width: 100%; height: 44px; margin-top: 6px; border: none; background: none;
          color: var(--c-text-4); font-size: 13.5px; font-weight: 700; cursor: pointer;
        }
      `}</style>
    </div>
  );

  return createPortal(sheet, document.body);
}
