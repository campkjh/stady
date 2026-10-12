"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MockExamBrowser, { type BrowserExam } from "@/components/MockExamBrowser";

/**
 * 홈의 모의고사 섹션 — **태블릿(≥744px)에서만** 홈 맨 아래에 보인다.
 * 폰은 홈을 깔끔하게 두고 '기출 모의고사' 카드로 들어가게 하므로 목록을 아예 불러오지 않는다
 * (폭이 넓은 화면에서만 가벼운 목록 API 를 한 번 받는다).
 */
export default function HomeMockSection({ isPremiumUser }: { isPremiumUser: boolean }) {
  const [wide, setWide] = useState(false);
  const [data, setData] = useState<{ exams: BrowserExam[]; years: number[] } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 744px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!wide || data) return;
    let alive = true;
    fetch("/api/mock-exams/browse", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && Array.isArray(d.exams)) setData({ exams: d.exams, years: Array.isArray(d.years) ? d.years : [] });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [wide, data]);

  if (!wide || !data || data.exams.length === 0) return null;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: "var(--c-text-c)", margin: 0 }}>모의고사</h2>
        <Link href="/mock-exam" style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, color: "var(--c-text-4)", textDecoration: "none" }}>
          전체보기 ›
        </Link>
      </div>
      <MockExamBrowser exams={data.exams} years={data.years} embedded isPremiumUser={isPremiumUser} />
    </section>
  );
}
