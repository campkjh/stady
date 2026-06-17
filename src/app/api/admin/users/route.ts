import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminUsers } from "@/lib/user-admin-profile";

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await getAdminUsers();

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        attemptCount: toNumber(user.attemptCount),
        inquiryCount: toNumber(user.inquiryCount),
        totalStudySeconds: toNumber(user.totalStudySeconds),
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin users GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
