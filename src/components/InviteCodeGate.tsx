"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

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

  useBodyScrollLock(mounted && open);
  if (!mounted || !open) return null;

  const sheet = (
    <div className="mdl-root is-sheet" data-gate="invite" style={{ zIndex: 2600 }}>
      <div className="mdl-dim" />
      <div className="mdl-sheet" role="dialog" aria-label="초대코드 입력">
        <div className="mdl-handle" />
        {done ? (
          <div className="mdl-text" style={{ textAlign: "center", paddingBottom: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mdl-icon" style={{ width: 48, height: 48, margin: "0 auto 12px" }} src="/icons/toss/gift.svg" alt="" />
            <h2 className="mdl-title">초대코드가 적용됐어요!</h2>
            <p className="mdl-body is-sm">나와 친구 모두 스타디 프라임 2주 무료 이용권을 받았어요.</p>
          </div>
        ) : (
          <>
            <div className="mdl-text" style={{ textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="mdl-icon" style={{ width: 48, height: 48, margin: "0 auto 12px" }} src="/icons/toss/gift.svg" alt="" />
              <h2 className="mdl-title">초대코드가 있나요?</h2>
              <p className="mdl-body is-sm">
                친구에게 받은 초대코드를 넣으면 <b>나와 친구 모두</b> 프라임 2주 무료 이용권을 받아요.
              </p>
              <input
                className={`mdl-field${error ? " is-error" : ""}`}
                style={{ marginTop: 18, textAlign: "center", fontWeight: 700 }}
                value={code}
                maxLength={20}
                autoCapitalize="characters"
                placeholder="STADY..."
                onChange={(e) => { setCode(e.target.value); if (error) setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
              />
              <div style={{ minHeight: 22 }}>{error && <span className="mdl-error">{error}</span>}</div>
            </div>
            <div className="mdl-actions is-stack is-tight" style={{ gap: 0 }}>
              <button type="button" className="mdl-btn is-main" style={{ flex: "none", width: "100%" }} onClick={apply} disabled={busy || !code.trim()}>
                {busy ? "적용 중…" : "초대코드 적용하기"}
              </button>
              <button type="button" className="mdl-textbtn is-muted" style={{ alignSelf: "center", marginTop: 4 }} onClick={skip}>
                초대코드가 없어요
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
