import { NextRequest, NextResponse } from "next/server";

// GIF 검색 프록시 — 인스타/스레드가 쓰는 GIPHY 를 서버에서 대신 호출한다.
// API 키(GIPHY_API_KEY)는 서버 환경변수로만 두고 클라이언트에 노출하지 않는다.
// 키가 없으면 기능이 아직 설정 안 된 상태로 조용히(빈 목록) 응답한다.

export const runtime = "nodejs";

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}
interface GiphyItem {
  id: string;
  images?: {
    fixed_height?: GiphyImage;
    fixed_height_small?: GiphyImage;
    fixed_height_downsampled?: GiphyImage;
    original?: GiphyImage;
  };
}

export async function GET(request: NextRequest) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    return NextResponse.json({ gifs: [], configured: false });
  }

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") || "").trim();
  const offset = Math.max(0, Number(params.get("offset") || "0") || 0);
  const limit = 24;

  const endpoint = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=pg-13&lang=ko&bundle=fixed_height`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=${limit}&offset=${offset}&rating=pg-13&bundle=fixed_height`;

  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ gifs: [], configured: true, error: "GIF를 불러오지 못했어요." });
    }
    const data = (await res.json()) as { data?: GiphyItem[] };
    const gifs = (data.data || [])
      .map((g) => {
        const full = g.images?.fixed_height || g.images?.original;
        const small =
          g.images?.fixed_height_small || g.images?.fixed_height_downsampled || full;
        return {
          id: g.id,
          preview: small?.url || full?.url || "",
          url: full?.url || small?.url || "",
          width: Number(full?.width || 0),
          height: Number(full?.height || 0),
        };
      })
      .filter((g) => g.url);
    return NextResponse.json({ gifs, configured: true });
  } catch {
    return NextResponse.json({ gifs: [], configured: true, error: "GIF를 불러오지 못했어요." });
  }
}
