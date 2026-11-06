// Existing explanations stay plain text; uploaded correction images use a Blob URL.
export function explanationImageUrl(explanation: string): string | null {
  try {
    const url = new URL(explanation.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!url.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    if (!/\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
