// 모의고사 분류 체계(수능 과목 편제). 어드민 등록 폼과 사용자 목록 필터가 공유한다.
// id는 DB에 저장되는 값이라 바꾸면 기존 데이터가 끊긴다 — label만 바꿀 것.

export interface SubjectItem {
  id: string;
  label: string;
}

export interface SubjectGroup {
  key: string;
  label: string;
  // public/icons/ 아래 아이콘 파일명(확장자 제외). 공용 아이콘 세트에서 가져옴.
  icon: string;
  subjects: SubjectItem[];
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  {
    key: "korean",
    label: "국어",
    icon: "subj-korean",
    subjects: [
      { id: "kor-hwajak", label: "화법과 작문" },
      { id: "kor-eonmae", label: "언어와 매체" },
      { id: "kor-prev", label: "이전과목" },
    ],
  },
  {
    key: "math",
    label: "수학",
    icon: "subj-math",
    subjects: [
      { id: "math-prob", label: "확률과 통계" },
      { id: "math-calc", label: "미적분" },
      { id: "math-geo", label: "기하" },
      { id: "math-prev", label: "이전과목" },
    ],
  },
  {
    key: "english",
    label: "영어/한국사",
    icon: "subj-english",
    subjects: [
      { id: "eng", label: "영어" },
      { id: "korhist", label: "한국사" },
    ],
  },
  {
    key: "social",
    label: "사회탐구",
    icon: "subj-social",
    subjects: [
      { id: "soc-life-ethics", label: "생활과 윤리" },
      { id: "soc-ethics-thought", label: "윤리와 사상" },
      { id: "soc-kor-geo", label: "한국지리" },
      { id: "soc-world-geo", label: "세계지리" },
      { id: "soc-east-asia", label: "동아시아사" },
      { id: "soc-world-hist", label: "세계사" },
      { id: "soc-politics", label: "정치와 법" },
      { id: "soc-economy", label: "경제" },
      { id: "soc-culture", label: "사회·문화" },
      { id: "soc-prev", label: "이전과목" },
    ],
  },
  {
    key: "science",
    label: "과학탐구",
    icon: "subj-science",
    subjects: [
      { id: "sci-physics1", label: "물리학Ⅰ" },
      { id: "sci-physics2", label: "물리학Ⅱ" },
      { id: "sci-chem1", label: "화학Ⅰ" },
      { id: "sci-chem2", label: "화학Ⅱ" },
      { id: "sci-bio1", label: "생명과학Ⅰ" },
      { id: "sci-bio2", label: "생명과학Ⅱ" },
      { id: "sci-earth1", label: "지구과학Ⅰ" },
      { id: "sci-earth2", label: "지구과학Ⅱ" },
      { id: "sci-prev", label: "이전과목" },
    ],
  },
  {
    key: "job",
    label: "직업탐구",
    icon: "subj-job",
    subjects: [
      { id: "job-agri", label: "농업 기초 기술" },
      { id: "job-industry", label: "공업 일반" },
      { id: "job-commerce", label: "상업 경제" },
      { id: "job-fishery", label: "수산·해운 산업 기초" },
      { id: "job-human", label: "인간 발달" },
      { id: "job-life", label: "성공적인 직업 생활" },
      { id: "job-prev", label: "이전과목" },
    ],
  },
  {
    key: "lang2",
    label: "제2외/한문",
    icon: "subj-lang2",
    subjects: [
      { id: "l2-de", label: "독일어Ⅰ" },
      { id: "l2-fr", label: "프랑스어Ⅰ" },
      { id: "l2-es", label: "스페인어Ⅰ" },
      { id: "l2-zh", label: "중국어Ⅰ" },
      { id: "l2-ja", label: "일본어Ⅰ" },
      { id: "l2-ru", label: "러시아어Ⅰ" },
      { id: "l2-ar", label: "아랍어Ⅰ" },
      { id: "l2-vi", label: "베트남어Ⅰ" },
      { id: "l2-hanja", label: "한문Ⅰ" },
    ],
  },
];

// 모의고사가 시행되는 달(3월 ~ 12월).
export const EXAM_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const SUBJECT_INDEX: Record<string, { subject: SubjectItem; group: SubjectGroup }> = {};
for (const group of SUBJECT_GROUPS) {
  for (const subject of group.subjects) SUBJECT_INDEX[subject.id] = { subject, group };
}

export function findSubject(id: string | null | undefined) {
  return id ? SUBJECT_INDEX[id] ?? null : null;
}

// 과목 id → "사회탐구 · 생활과 윤리" 같은 표시용 문구.
export function subjectLabel(id: string | null | undefined): string | null {
  const hit = findSubject(id);
  return hit ? hit.subject.label : null;
}

export function subjectGroupOf(id: string | null | undefined): SubjectGroup | null {
  return findSubject(id)?.group ?? null;
}

export function isValidSubjectId(id: string | null | undefined): boolean {
  return !!findSubject(id);
}

// 필터 연도 목록: 최신 연도부터 내림차순(기본 7개 + 실제 데이터에 있는 연도).
export function yearOptions(years: number[], count = 14): number[] {
  const now = new Date().getFullYear();
  const base = Array.from({ length: count }, (_, i) => now - i);
  return [...new Set([...base, ...years])].sort((a, b) => b - a);
}

// 어드민 API가 받은 body에서 분류 값만 안전하게 뽑아낸다.
// 연도 2000~2100, 월 1~12, 과목은 위 표에 정의된 id만 통과(그 외는 null=미분류).
export function parseExamMeta(body: Record<string, unknown>) {
  const yearNum = Number(body?.year);
  const monthNum = Number(body?.month);
  const subject = String(body?.subject ?? "").trim();
  return {
    year: Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100 ? yearNum : null,
    month: Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null,
    subject: isValidSubjectId(subject) ? subject : null,
  };
}
