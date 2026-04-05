import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      const inquiries = await prisma.inquiry.findMany({
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(inquiries);
    }

    const inquiries = await prisma.inquiry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(inquiries);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { name, email, category, title, content } = body;

    if (!name || !email || !category || !title || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: user?.id ?? null,
        name,
        email,
        category,
        title,
        content,
      },
    });

    return NextResponse.json(inquiry, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
