"use client";

import { useEffect } from "react";

// 친구초대 코드 자동 적용.
// 초대 링크(/login?invite=CODE) → 로그인 페이지가 localStorage 에 코드를 저장 → (카카오/애플 OAuth 가입)
// → 앱에 들어오면 여기서 그 코드를 서버(/api/auth/signup-source)로 보내 초대를 등록한다.
// 예전엔 '가입 설문'이 이 전송을 맡았는데 설문이 제거되면서 전송도 사라져 초대가 한 건도 등록되지
// 않았다(코드 입력창도 없어 사용자가 손으로 넣을 방법도 없었음). 루트 레이아웃에 두어 어느 화면으로
// 들어와도 한 번은 실행되게 한다.
//
// 성공(2xx)하면 코드를 지운다(적용 여부와 무관 — 서버가 '처음 가입한 계정만' 판정). 비로그인(401)이나
// 네트워크 오류면 남겨 두었다가 다음 로드에 다시 시도한다.
const KEY = "stady_pending_invite_code";

export default function ReferralApply() {
  useEffect(() => {
    let code = "";
    try {
      code = localStorage.getItem(KEY) || "";
    } catch {
      return;
    }
    if (!code) return;

    let alive = true;
    fetch("/api/auth/signup-source", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ inviteCode: code }),
    })
      .then((res) => {
        if (!alive) return;
        if (res.ok) {
          try {
            localStorage.removeItem(KEY);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return null;
}
