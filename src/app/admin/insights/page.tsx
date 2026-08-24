"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChartBarIcon, ClockIcon, NavInsightsIcon } from "@/components/admin/admin-icons";

// 어드민 인사이트 화면.
// "어떤 페이지에서 얼마나 머물렀는지 / 어떤 시간에 주로 머무는지 / 주로 푸는 문제는 무엇인지"
// 세 질문에 대한 답을 한 페이지에 모았다. 기간은 쿼리스트링 ?days= 로만 바뀐다.

const DAY_OPTIONS = [7, 30, 90] as const;

interface Summary {
  activeUsers: number;
  quizSubmissions: number;
  quizUsers: number;
  dailyAnswers: number;
  dailyUsers: number;
  dailyCorrectRate: number | null;
  mockAnswers: number;
  mockUsers: number;
  studySessions: number;
  studyMinutes: number;
  avgDwellSeconds: number | null;
  pageViews: number;
}

interface HourlyRow {
  hour: number;
  quiz: number;
  ox: number;
  daily: number;
  study: number;
  pageViews: number;
  total: number;
}

interface DwellRow {
  path: string;
  views: number;
  totalMinutes: number;
  avgSeconds: number;
  users: number;
}

interface QuizTypeRow {
  quizType: string;
  label: string;
  attempts: number;
  users: number;
}

interface SetRow {
  id: string;
  title: string;
  categoryName: string;
  attempts: number;
  users: number;
  avgPct: number | null;
}

interface CategoryRow {
  name: string;
  attempts: number;
  users: number;
}

interface QuestionRow {
  id: string;
  question: string;
  setTitle: string;
  categoryName: string;
  answered: number;
  correct: number;
  correctRate: number;
}

interface MockSubjectRow {
  subject: string;
  label: string;
  groupLabel: string;
  answers: number;
  users: number;
  exams: number;
}

interface InsightsPayload {
  days: number;
  generatedAt: string;
  summary: Summary;
  hourly: HourlyRow[];
  dwell: DwellRow[];
  dwellAvailable: boolean;
  quizTypes: QuizTypeRow[];
  popularOxSets: SetRow[];
  popularVocabSets: SetRow[];
  oxCategories: CategoryRow[];
  popularQuestions: QuestionRow[];
  hardQuestions: QuestionRow[];
  mockSubjects: MockSubjectRow[];
}

const SERIES = [
  { key: "quiz", label: "세트 제출", color: "var(--c-brand)" },
  { key: "ox", label: "OX 문항", color: "var(--c-brand-mid)" },
  { key: "daily", label: "데일리 퀴즈", color: "var(--c-success)" },
  { key: "study", label: "공부 시작", color: "var(--c-warn)" },
  { key: "pageViews", label: "페이지 조회", color: "var(--c-purple)" },
] as const;

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatMinutes(minutes: number) {
  if (!minutes) return "0분";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${formatNumber(h)}시간 ${m}분`;
  return `${m}분`;
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function InsightsContent() {
  const searchParams = useSearchParams();
  const daysParam = Number(searchParams.get("days"));
  const days = (DAY_OPTIONS as readonly number[]).includes(daysParam) ? daysParam : 30;

  // 응답에 기간을 함께 담아 둔다. 로딩 여부를 별도 state 로 두고 effect 안에서 동기적으로
  // setState 하면 React Compiler 룰(set-state-in-effect)에 걸린다 — 담아 둔 기간과
  // 현재 기간을 비교해 파생시키면 그 문제가 없고, 탭 전환 즉시 로딩으로 바뀐다.
  const [result, setResult] = useState<{ days: number; data: InsightsPayload | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/insights?days=${days}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload: InsightsPayload) => {
        if (alive) setResult({ days, data: payload });
      })
      .catch(() => {
        if (alive) setResult({ days, data: null });
      });
    return () => {
      alive = false;
    };
  }, [days]);

  const loading = result?.days !== days;
  const data = loading ? null : result?.data ?? null;

  const maxHourTotal = useMemo(
    () => Math.max(1, ...(data?.hourly ?? []).map((row) => row.total)),
    [data]
  );
  const peakHour = useMemo(() => {
    if (!data || data.hourly.length === 0) return null;
    const peak = data.hourly.reduce((best, row) => (row.total > best.total ? row : best), data.hourly[0]);
    return peak.total > 0 ? peak : null;
  }, [data]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: "var(--c-brand-soft-2)",
            color: "var(--c-brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <NavInsightsIcon size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text-2)" }}>사용자 인사이트</h1>
            <p style={{ fontSize: 14, color: "var(--c-text-4)", marginTop: 4 }}>
              어디서 머물고, 언제 공부하고, 무엇을 푸는지 확인합니다. 시간은 모두 한국시간(KST) 기준입니다.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 4 }}>
          {DAY_OPTIONS.map((option) => {
            const active = option === days;
            return (
              <Link
                key={option}
                href={`/admin/insights?days=${option}`}
                className="press"
                style={{
                  padding: "8px 14px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                  background: active ? "var(--c-brand)" : "transparent",
                  color: active ? "#fff" : "var(--c-text-3)",
                }}
              >
                최근 {option}일
              </Link>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div style={{ width: 28, height: 28, border: "3px solid var(--c-border)", borderTopColor: "var(--c-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : !data ? (
        <SectionCard title="집계를 불러오지 못했습니다">
          <div style={{ padding: 32, textAlign: "center", color: "var(--c-text-4)", fontSize: 14 }}>
            잠시 후 다시 시도해 주세요.
          </div>
        </SectionCard>
      ) : (
        <>
          {/* ④ 요약 지표 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
            <SummaryCard
              label="활성 사용자"
              value={`${formatNumber(data.summary.activeUsers)}명`}
              hint={`최근 ${days}일 내 활동`}
            />
            <SummaryCard
              label="퀴즈 제출"
              value={`${formatNumber(data.summary.quizSubmissions)}회`}
              hint={`${formatNumber(data.summary.quizUsers)}명이 제출`}
            />
            <SummaryCard
              label="데일리 퀴즈"
              value={`${formatNumber(data.summary.dailyAnswers)}건`}
              hint={
                data.summary.dailyCorrectRate == null
                  ? `${formatNumber(data.summary.dailyUsers)}명 참여`
                  : `${formatNumber(data.summary.dailyUsers)}명 · 정답률 ${data.summary.dailyCorrectRate}%`
              }
            />
            <SummaryCard
              label="모의고사 답안"
              value={`${formatNumber(data.summary.mockAnswers)}개`}
              hint={`${formatNumber(data.summary.mockUsers)}명 응시`}
            />
            <SummaryCard
              label="공부 타이머"
              value={formatMinutes(data.summary.studyMinutes)}
              hint={`세션 ${formatNumber(data.summary.studySessions)}회`}
            />
            <SummaryCard
              label="평균 체류"
              value={data.summary.avgDwellSeconds == null ? "수집 중" : formatSeconds(data.summary.avgDwellSeconds)}
              hint={
                data.summary.avgDwellSeconds == null
                  ? "체류 로그 대기 중"
                  : `페이지 조회 ${formatNumber(data.summary.pageViews)}회`
              }
            />
          </div>

          {/* ② 시간대별 활동 */}
          <SectionCard
            title="시간대별 활동"
            icon={<ClockIcon size={18} />}
            desc="0~23시(KST) 분포입니다. 퀴즈 제출·OX 문항 풀이·데일리 퀴즈·공부 타이머 시작을 모두 더했습니다."
            right={peakHour ? <Badge>{`가장 활발한 시간 ${String(peakHour.hour).padStart(2, "0")}시`}</Badge> : null}
          >
            <div style={{ padding: "14px 18px 18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
                {SERIES.map((series) => (
                  <div key={series.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: series.color, display: "inline-block" }} />
                    <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 700 }}>{series.label}</span>
                  </div>
                ))}
              </div>

              {data.hourly.every((row) => row.total === 0) ? (
                <EmptyNote>기간 내 활동 기록이 없습니다.</EmptyNote>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {data.hourly.map((row) => (
                    <div key={row.hour} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 36, flexShrink: 0, fontSize: 12, fontWeight: 800, color: row.total === (peakHour?.total ?? -1) ? "var(--c-brand)" : "var(--c-text-4)", textAlign: "right" }}>
                        {String(row.hour).padStart(2, "0")}시
                      </span>
                      <div
                        title={`${String(row.hour).padStart(2, "0")}시 · 세트 제출 ${row.quiz} · OX 문항 ${row.ox} · 데일리 ${row.daily} · 공부 시작 ${row.study} · 페이지 조회 ${row.pageViews}`}
                        style={{ flex: 1, height: 14, borderRadius: 7, background: "var(--c-bg-muted)", overflow: "hidden", minWidth: 0 }}
                      >
                        <div style={{ display: "flex", height: "100%", width: `${(row.total / maxHourTotal) * 100}%`, transition: "width 0.4s ease" }}>
                          {SERIES.map((series) => {
                            const value = row[series.key];
                            if (!value) return null;
                            return (
                              <div
                                key={series.key}
                                style={{ width: `${(value / row.total) * 100}%`, background: series.color }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <span style={{ width: 68, flexShrink: 0, fontSize: 12, fontWeight: 800, color: "var(--c-text-2d)", textAlign: "right" }}>
                        {formatNumber(row.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* ① 페이지별 체류 */}
          <SectionCard
            title="페이지별 체류"
            icon={<ChartBarIcon size={18} />}
            desc="어떤 화면에서 얼마나 오래 머물렀는지 — 총 체류 시간 순입니다."
          >
            {!data.dwellAvailable ? (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "var(--c-text-2)" }}>아직 수집 중입니다</p>
                <p style={{ fontSize: 13, color: "var(--c-text-4)", marginTop: 6, lineHeight: 1.6 }}>
                  페이지 체류 데이터는 이 기능이 배포된 뒤부터 쌓입니다.
                  <br />
                  시간대별 활동과 아래 문제 통계는 기존 기록으로 지금 바로 볼 수 있습니다.
                </p>
              </div>
            ) : (
              <TableWrap minWidth={640}>
                <thead>
                  <tr style={{ background: "var(--c-bg-soft)" }}>
                    <Th>경로</Th>
                    <Th align="right">조회</Th>
                    <Th align="right">이용자</Th>
                    <Th align="right">총 체류</Th>
                    <Th align="right">평균 체류</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.dwell.map((row) => (
                    <tr key={row.path} style={{ borderTop: "1px solid var(--c-bg-muted)" }}>
                      <Td>
                        <span style={{ fontWeight: 800, color: "var(--c-text)" }}>{row.path}</span>
                      </Td>
                      <Td align="right">{formatNumber(row.views)}</Td>
                      <Td align="right">{formatNumber(row.users)}</Td>
                      <Td align="right">{formatMinutes(row.totalMinutes)}</Td>
                      <Td align="right">{formatSeconds(row.avgSeconds)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </SectionCard>

          {/* ③ 주로 푸는 문제 — 유형/과목 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }} className="insight-grid">
            <SectionCard title="퀴즈 유형별 제출" desc="제출 회차 기준(책갈피 복습은 제외)." flush>
              {data.quizTypes.length === 0 ? (
                <EmptyNote>기간 내 제출 기록이 없습니다.</EmptyNote>
              ) : (
                <BarList
                  rows={data.quizTypes.map((row) => ({
                    key: row.quizType,
                    label: row.label,
                    value: row.attempts,
                    caption: `${formatNumber(row.users)}명`,
                  }))}
                />
              )}
            </SectionCard>

            <SectionCard title="OX 과목별 제출" desc="어떤 과목의 OX 를 주로 푸는지." flush>
              {data.oxCategories.length === 0 ? (
                <EmptyNote>기간 내 제출 기록이 없습니다.</EmptyNote>
              ) : (
                <BarList
                  rows={data.oxCategories.map((row) => ({
                    key: row.name,
                    label: row.name,
                    value: row.attempts,
                    caption: `${formatNumber(row.users)}명`,
                  }))}
                />
              )}
            </SectionCard>
          </div>

          {/* ③ 인기 세트 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }} className="insight-grid">
            <SectionCard title="인기 OX 세트 TOP 10" desc="제출 회차가 많은 순.">
              <SetTable rows={data.popularOxSets} />
            </SectionCard>
            <SectionCard title="인기 영단어 세트 TOP 10" desc="제출 회차가 많은 순.">
              <SetTable rows={data.popularVocabSets} />
            </SectionCard>
          </div>

          {/* ③ 문항 단위 */}
          <SectionCard
            title="많이 푼 문항 TOP 15"
            desc="정답률 분모는 실제로 답을 고른 응답만 셉니다(무응답 제외)."
          >
            <QuestionTable rows={data.popularQuestions} emptyText="기간 내 OX 응답이 없습니다." />
          </SectionCard>

          <SectionCard
            title="어려워하는 문항 TOP 15"
            desc="정답률이 낮은 순. 표본이 20건 이상인 문항만 뽑았습니다."
          >
            <QuestionTable rows={data.hardQuestions} emptyText="표본 20건 이상인 문항이 아직 없습니다." />
          </SectionCard>

          {/* ③ 모의고사 */}
          <SectionCard title="모의고사 과목별 응시" desc="제출된 답안 수 기준. 과목 미지정 시험지는 미분류로 묶입니다.">
            {data.mockSubjects.length === 0 ? (
              <EmptyNote>기간 내 모의고사 답안이 없습니다.</EmptyNote>
            ) : (
              <TableWrap minWidth={560}>
                <thead>
                  <tr style={{ background: "var(--c-bg-soft)" }}>
                    <Th>과목</Th>
                    <Th>영역</Th>
                    <Th align="right">답안</Th>
                    <Th align="right">응시자</Th>
                    <Th align="right">시험지</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.mockSubjects.map((row) => (
                    <tr key={row.subject || "unclassified"} style={{ borderTop: "1px solid var(--c-bg-muted)" }}>
                      <Td>
                        <span style={{ fontWeight: 800, color: "var(--c-text)" }}>{row.label}</span>
                      </Td>
                      <Td>{row.groupLabel}</Td>
                      <Td align="right">{formatNumber(row.answers)}</Td>
                      <Td align="right">{formatNumber(row.users)}</Td>
                      <Td align="right">{formatNumber(row.exams)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </SectionCard>

          <p style={{ marginTop: 16, fontSize: 12, color: "var(--c-text-4c)" }}>
            집계 시각 {formatDateTime(data.generatedAt)} · 최근 {days}일
          </p>
        </>
      )}

      <style>{`
        @media (max-width: 900px) {
          .insight-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--c-border)", background: "var(--c-bg)", padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <p style={{ fontSize: 12, color: "var(--c-text-4)", fontWeight: 800 }}>{label}</p>
      <p style={{ marginTop: 8, fontSize: 22, color: "var(--c-text)", fontWeight: 900, lineHeight: 1.2 }}>{value}</p>
      <p style={{ marginTop: 6, fontSize: 12, color: "var(--c-text-4c)" }}>{hint}</p>
    </div>
  );
}

function SectionCard({
  title,
  desc,
  icon,
  right,
  children,
  flush,
}: {
  title: string;
  desc?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: flush ? 0 : 16,
        background: "var(--c-bg)",
        borderRadius: 14,
        border: "1px solid var(--c-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--c-bg-muted)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {icon ? <span style={{ color: "var(--c-brand)", display: "flex", flexShrink: 0 }}>{icon}</span> : null}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--c-text-2)" }}>{title}</h2>
            {desc ? <p style={{ fontSize: 12, color: "var(--c-text-4)", marginTop: 3, lineHeight: 1.5 }}>{desc}</p> : null}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 999, background: "var(--c-brand-soft-2)", color: "var(--c-brand)", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 32, textAlign: "center", color: "var(--c-text-4)", fontSize: 14 }}>{children}</div>
  );
}

function BarList({ rows }: { rows: { key: string; label: string; value: number; caption: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div style={{ padding: 18 }}>
      {rows.map((row, index) => (
        <div key={row.key} style={{ marginBottom: index < rows.length - 1 ? 14 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--c-brand)", flexShrink: 0 }}>
              {formatNumber(row.value)}회 <span style={{ color: "var(--c-text-4)", fontWeight: 700 }}>· {row.caption}</span>
            </span>
          </div>
          <div style={{ height: 8, background: "var(--c-bg-muted)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(row.value / max) * 100}%`, background: "var(--c-brand)", borderRadius: 4, transition: "width 0.4s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SetTable({ rows }: { rows: SetRow[] }) {
  if (rows.length === 0) return <EmptyNote>기간 내 제출 기록이 없습니다.</EmptyNote>;
  return (
    <TableWrap minWidth={520}>
      <thead>
        <tr style={{ background: "var(--c-bg-soft)" }}>
          <Th>세트</Th>
          <Th align="right">제출</Th>
          <Th align="right">응시자</Th>
          <Th align="right">평균 점수</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} style={{ borderTop: "1px solid var(--c-bg-muted)" }}>
            <Td>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 20, flexShrink: 0, fontSize: 12, fontWeight: 900, color: "var(--c-text-4c)" }}>{index + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 800, color: "var(--c-text)", whiteSpace: "normal" }}>{row.title}</p>
                  <p style={{ marginTop: 3, fontSize: 11, color: "var(--c-text-4)" }}>{row.categoryName}</p>
                </div>
              </div>
            </Td>
            <Td align="right">{formatNumber(row.attempts)}회</Td>
            <Td align="right">{formatNumber(row.users)}명</Td>
            <Td align="right">{row.avgPct == null ? "-" : `${row.avgPct}점`}</Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function QuestionTable({ rows, emptyText }: { rows: QuestionRow[]; emptyText: string }) {
  if (rows.length === 0) return <EmptyNote>{emptyText}</EmptyNote>;
  return (
    <TableWrap minWidth={760}>
      <thead>
        <tr style={{ background: "var(--c-bg-soft)" }}>
          <Th>문항</Th>
          <Th>세트</Th>
          <Th align="right">응답</Th>
          <Th align="right">정답</Th>
          <Th align="right">정답률</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} style={{ borderTop: "1px solid var(--c-bg-muted)" }}>
            <Td>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ width: 20, flexShrink: 0, fontSize: 12, fontWeight: 900, color: "var(--c-text-4c)" }}>{index + 1}</span>
                <p style={{ maxWidth: 420, whiteSpace: "normal", color: "var(--c-text)", fontWeight: 700, lineHeight: 1.5 }}>{row.question}</p>
              </div>
            </Td>
            <Td>
              <p style={{ whiteSpace: "normal", maxWidth: 200 }}>{row.setTitle}</p>
              <p style={{ marginTop: 3, fontSize: 11, color: "var(--c-text-4)" }}>{row.categoryName}</p>
            </Td>
            <Td align="right">{formatNumber(row.answered)}</Td>
            <Td align="right">{formatNumber(row.correct)}</Td>
            <Td align="right">
              <span style={{
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: row.correctRate >= 70 ? "var(--c-success-line)" : row.correctRate >= 40 ? "var(--c-warn-soft-2)" : "var(--c-danger-soft-3)",
                color: row.correctRate >= 70 ? "var(--c-success-b)" : row.correctRate >= 40 ? "var(--c-warn-b)" : "var(--c-danger-c)",
              }}>
                {row.correctRate}%
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function TableWrap({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontSize: 13 }}>{children}</table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ textAlign: align, padding: "11px 14px", color: "var(--c-text-4)", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ padding: "12px 14px", color: "var(--c-text-2d)", lineHeight: 1.45, whiteSpace: "nowrap", textAlign: align, verticalAlign: "top" }}>
      {children}
    </td>
  );
}

export default function AdminInsightsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div style={{ width: 28, height: 28, border: "3px solid var(--c-border)", borderTopColor: "var(--c-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <InsightsContent />
    </Suspense>
  );
}
