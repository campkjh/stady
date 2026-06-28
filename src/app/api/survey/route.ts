import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasSurvey, recordSurvey } from "@/lib/survey";

// 온보딩 설문 응답 여부. 비로그인은 노출하지 않도록 answered=true로 응답.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ answered: true });
    const answered = await hasSurvey(user.id);
    return NextResponse.json({ answered });
  } catch (error) {
    console.error("Survey GET error:", error);
    // 오류 시엔 설문을 띄우지 않는다(사용자 방해 방지).
    return NextResponse.json({ answered: true });
  }
}

// 설문 제출(또는 건너뛰기). 평생 1회만 기록.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const skipped = body?.skipped === true;
    let satisfaction: number | null = null;
    if (!skipped) {
      const s = Number(body?.satisfaction);
      if (!Number.isInteger(s) || s < 1 || s > 5) {
        return NextResponse.json({ error: "만족도를 선택해주세요." }, { status: 400 });
      }
      satisfaction = s;
    }
    const desiredFeature = String(body?.desiredFeature ?? "").trim().slice(0, 2000);
    await recordSurvey(user.id, satisfaction, desiredFeature, skipped);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Survey POST error:", error);
    return NextResponse.json({ error: "설문 제출 중 오류가 발생했습니다." }, { status: 500 });
  }
}
