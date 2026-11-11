"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

// 가입 직후 초대코드를 물어보는 시트.
// 초대 링크는 브라우저에서 열고 가입은 앱(웹뷰)에서 하는 경우가 많은데, 둘은 저장소가 달라
// 링크로 담아둔 코드가 사라진다. 그래서 "코드를 직접 넣을 자리"를 가입 직후에 한 번 띄운다.
// 대상은 서버 판정(canEnterCode = 아직 초대 미적용 + 가입 후 7일 이내)을 그대로 따른다.
//
// 초대 링크로 가입하면 코드가 자동 적용돼(ReferralApply) 입력창은 뜨지 않는다. 그런데 받았다는 말도 없어서
// "코드 넣을 창이 안 떠서 보상을 못 받았다"는 문의가 왔다(실제로는 둘 다 2주를 받은 상태). 그래서 보상이
// 살아 있는 동안 한 번은 "받았어요"를 띄운다 — 초대받은 쪽은 가입 보상, 초대한 쪽은 새로 가입한 친구 수만큼.
// 저장 키는 계정마다 따로 둔다(한 기기에서 다른 계정이 '없어요'를 누르면 이 계정 창까지 막히던 것).
const SKIP_KEY = "invite_code_gate_skipped";
const keyFor = (base: string, code: string) => `${base}_${code}`;

type Notice = { kind: "invitee" | "inviter"; count: number; until: string };

function untilText(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function InviteCodeGate() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const accountRef = useRef("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 초대 링크 코드가 아직 자동 적용 중이면(ReferralApply) 끝날 때까지 잠깐 기다렸다가 묻는다 —
    // 안 그러면 곧 적용될 계정에 입력창을 띄우거나 '받았어요'를 놓친다.
    const pendingInvite = () => {
      try { return !!localStorage.getItem("stady_pending_invite_code"); } catch { return false; }
    };
    const waitApplied = () => new Promise<void>((resolve) => {
      let waited = 0;
      const check = () => {
        if (!pendingInvite() || waited >= 8000) { resolve(); return; }
        waited += 500;
        timer = setTimeout(check, 500);
      };
      check();
    });
    waitApplied()
      .then(() => (alive ? fetch("/api/referrals", { cache: "no-store", credentials: "include" }) : null))
      .then((r) => (r?.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.inviteCode) return;
        const account = String(d.inviteCode);
        accountRef.current = account;
        const read = (k: string) => {
          try { return localStorage.getItem(k); } catch { return null; }
        };
        const rewardLive = typeof d.freePremiumUntil === "string" && new Date(d.freePremiumUntil).getTime() > Date.now();
        // 띄울 것 고르기: 입력창 > 초대받은 보상 안내 > 친구 가입 보상 안내
        let next: "gate" | Notice | null = null;
        if (d.canEnterCode === true) {
          if (read(keyFor(SKIP_KEY, account)) !== "1") next = "gate";
        } else if (rewardLive && d.alreadyInvited === true && read(keyFor("invite_reward_seen", account)) !== "1") {
          next = { kind: "invitee", count: 1, until: d.freePremiumUntil };
        } else if (rewardLive && Number(d.invitedCount) > Number(read(keyFor("invite_count_seen", account)) || 0)) {
          next = { kind: "inviter", count: Number(d.invitedCount) - Number(read(keyFor("invite_count_seen", account)) || 0), until: d.freePremiumUntil };
        }
        if (!next) return;
        // 다른 첫진입 모달(닉네임 변경·설문)이 떠 있으면 그것이 닫힐 때까지 기다렸다가 띄운다.
        // 예전엔 한 번 보고 건너뛰어서, 설문이 먼저 뜨는 신규 유저에게는 아예 보이지 않았다.
        let waited = 0;
        const tick = () => {
          if (!alive) return;
          if (!document.querySelector("[data-gate]")) {
            if (next === "gate") setOpen(true);
            else setNotice(next);
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
      localStorage.setItem(keyFor(SKIP_KEY, accountRef.current), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function closeNotice() {
    try {
      if (notice?.kind === "invitee") localStorage.setItem(keyFor("invite_reward_seen", accountRef.current), "1");
      else {
        const k = keyFor("invite_count_seen", accountRef.current);
        localStorage.setItem(k, String(Number(localStorage.getItem(k) || 0) + (notice?.count ?? 0)));
      }
    } catch {
      /* ignore */
    }
    setNotice(null);
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
        localStorage.setItem(keyFor(SKIP_KEY, accountRef.current), "1");
        // 방금 입력창에서 '받았어요'를 봤으니 다음 실행 때 같은 안내를 또 띄우지 않는다.
        localStorage.setItem(keyFor("invite_reward_seen", accountRef.current), "1");
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

  useBodyScrollLock(mounted && (open || !!notice));
  if (!mounted) return null;

  if (notice) {
    return createPortal(
      <div className="mdl-root is-sheet" data-gate="invite" style={{ zIndex: 2600 }}>
        <div className="mdl-dim" onClick={closeNotice} />
        <div className="mdl-sheet" role="dialog" aria-label="초대 보상 안내">
          <div className="mdl-handle" />
          <div className="mdl-text" style={{ textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mdl-icon" style={{ width: 48, height: 48, margin: "0 auto 12px" }} src="/icons/toss/gift.svg" alt="" />
            <h2 className="mdl-title">
              {notice.kind === "invitee"
                ? "친구 초대로 프라임 2주를 받았어요"
                : `친구 ${notice.count}명이 내 초대로 가입했어요`}
            </h2>
            <p className="mdl-body is-sm">
              {notice.kind === "invitee"
                ? "초대 링크로 가입해서 초대코드가 자동으로 적용됐어요. 초대한 친구도 같이 받았어요."
                : "나와 친구 모두 스타디 프라임 무료 이용권을 받았어요."}
              <br />
              <b>{untilText(notice.until)}까지</b> 프라임을 무료로 쓸 수 있어요.
            </p>
          </div>
          <div className="mdl-actions is-stack is-tight" style={{ gap: 0 }}>
            <button type="button" className="mdl-btn is-main" style={{ flex: "none", width: "100%" }} onClick={closeNotice}>
              확인
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!open) return null;

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
