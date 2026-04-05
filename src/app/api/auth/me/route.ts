import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json(
      { error: "사용자 정보를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
