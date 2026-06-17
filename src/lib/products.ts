// Paid downloadable products (workbooks, etc.).
// Prices are in KRW. Files live outside /public and are streamed only after a
// verified purchase via /api/downloads/[...]. Never expose filePath to clients.

export interface StoreProduct {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  /** filename presented to the user on download */
  downloadName: string;
  /** path relative to the project root (process.cwd()) */
  filePath: string;
  /** route that streams the file after a purchase check */
  downloadPath: string;
}

export const STORE_PRODUCTS: Record<string, StoreProduct> = {
  "korean-history-2026": {
    id: "korean-history-2026",
    title: "2026 한국사",
    subtitle: "한국사 문제집 PDF",
    description: "2026 대비 한국사 문제집입니다. 결제 후 PDF로 바로 다운로드할 수 있습니다.",
    price: 3900,
    downloadName: "2026 한국사 문제집.pdf",
    filePath: "private/2026-korean-history.pdf",
    downloadPath: "/api/downloads/korean-history",
  },
};

export function getProduct(id: string): StoreProduct | null {
  return STORE_PRODUCTS[id] ?? null;
}
