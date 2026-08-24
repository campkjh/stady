import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getDailyCategoryOptions,
  getDailyCategoryPref,
  setDailyCategoryPref,
} from "@/lib/daily-quiz";

// 데일리 퀴즈 과목 설정.
// 고른 과목이 없으면(빈 배열) 전체에서 뽑는다 — 기존 동작과 같다.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const options = await getDailyCategoryOptions();
    const user = await getCurrentUser();
    const selected = user ? await getDailyCategoryPref(user.id) : [];
    return NextResponse.json({ options, selected });
  } catch {
    // 설정을 못 읽어도 카드 자체는 떠야 하므로 빈 값으로 응답한다.
    return NextResponse.json({ options: [], selected: [] });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const raw = (body as { categoryIds?: unknown }).categoryIds;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "categoryIds 가 필요합니다." }, { status: 400 });
    }
    const ids = raw.filter((x): x is string => typeof x === "string");

    // 실제로 존재하는 과목만 저장한다(임의 값이 들어가면 문항이 0이 되어 전체로 폴백된다).
    const options = await getDailyCategoryOptions();
    const valid = new Set(options.map((o) => o.id));
    await setDailyCategoryPref(user.id, ids.filter((id) => valid.has(id)));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
