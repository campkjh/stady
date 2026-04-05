import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const inquiry = await prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(inquiry);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { status, reply } = body;

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(reply !== undefined && { reply }),
      },
    });

    return NextResponse.json(inquiry);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
