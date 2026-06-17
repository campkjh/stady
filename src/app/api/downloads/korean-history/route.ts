import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProduct } from "@/lib/products";
import { hasPurchased } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_ID = "korean-history-2026";

// Streams the paid PDF only to a logged-in user who has a DONE payment.
// The file lives outside /public so it is never publicly reachable.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const product = getProduct(PRODUCT_ID);
  if (!product) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const purchased = await hasPurchased(user.id, product.id);
  if (!purchased) {
    return NextResponse.json({ error: "결제 후 다운로드할 수 있습니다." }, { status: 403 });
  }

  try {
    const filePath = path.join(process.cwd(), product.filePath);
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(product.downloadName)}`,
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("download error:", error);
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 500 });
  }
}
