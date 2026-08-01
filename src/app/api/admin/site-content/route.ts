import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listSiteContent, createSiteContent, type ContentKind } from "@/lib/siteContent";
import { syncNoticeToCommunity } from "@/lib/noticeMirror";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Admin site-content error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function parseKind(value: string | null): ContentKind | null {
  return value === "notice" || value === "faq" ? value : null;
}

// 어드민: 공지/FAQ 목록(비활성 포함).
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const kind = parseKind(new URL(request.url).searchParams.get("kind"));
    if (!kind) return NextResponse.json({ error: "kind가 올바르지 않습니다." }, { status: 400 });
    const items = await listSiteContent(kind);
    return NextResponse.json({ items });
  } catch (error) {
    return adminError(error);
  }
}

// 어드민: 공지/FAQ 추가.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const kind = parseKind(body?.kind);
    if (!kind) return NextResponse.json({ error: "kind가 올바르지 않습니다." }, { status: 400 });
    const title = String(body?.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    const imageUrls: string[] = Array.isArray(body?.imageUrls)
      ? body.imageUrls.map((u: unknown) => String(u || "").trim()).filter((u: string) => /^https?:\/\//.test(u)).slice(0, 10)
      : [];
    await createSiteContent({
      kind,
      title,
      body: String(body?.body ?? "").trim(),
      dateLabel: body?.dateLabel ? String(body.dateLabel).trim() : null,
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
      isActive: body?.isActive !== false,
      imageUrls,
      popupEnabled: body?.popupEnabled === true,
      popupHideDays: Number.isFinite(Number(body?.popupHideDays)) ? Number(body.popupHideDays) : 7,
    });
    // 공지는 커뮤니티 '공지' 게시판에도 올려 사용자가 공감/댓글을 달 수 있게 한다.
    if (kind === "notice") {
      const items = await listSiteContent("notice");
      const created = items.find((it) => it.title === title && !it.postId);
      if (created) {
        await syncNoticeToCommunity({
          contentId: created.id,
          title: created.title,
          body: created.body,
          imageUrls: created.imageUrls,
          authorId: admin.id,
          isActive: created.isActive,
        });
      }
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return adminError(error);
  }
}
