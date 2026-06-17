import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendInquiryNotification } from "@/lib/inquiry-email";

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

    let emailDelivery: { sent: boolean; reason?: string } = { sent: false, reason: "not_attempted" };
    try {
      emailDelivery = await sendInquiryNotification({
        inquiryId: inquiry.id,
        userId: inquiry.userId,
        name: inquiry.name,
        email: inquiry.email,
        category: inquiry.category,
        title: inquiry.title,
        content: inquiry.content,
        createdAt: inquiry.createdAt,
      });
    } catch (error) {
      console.error("Inquiry notification email error:", error);
      emailDelivery = { sent: false, reason: "send_failed" };
    }

    return NextResponse.json({ ...inquiry, emailDelivery }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
