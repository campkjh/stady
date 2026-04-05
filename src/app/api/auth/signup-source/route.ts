import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const { source } = await request.json();

    if (!source || typeof source !== "string") {
      return NextResponse.json({ error: "source is required" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { signupSource: source },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
