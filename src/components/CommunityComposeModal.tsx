"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { clientCache } from "@/lib/clientCache";
import { markWroteToday } from "@/lib/writeNudge";
import { uploadCommunityImage, revokeUploadPreview } from "@/lib/communityUpload";

// 스레드(Threads) 스타일 게시물 작성 모달. 커뮤니티 목록 위에 올라온다.
// 백엔드는 groupId·title·content 가 필수라, 제목은 본문 첫 줄에서 자동으로 뽑는다.

interface CategoryGroup {
  id: string;
  name: string;
}
interface UploadedImage {
  url: string;
  previewUrl: string;
  name: string;
}
interface GifResult {
  id: string;
  preview: string;
  url: string;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i;
function isImageFile(file: File) {
  if (file.type && file.type !== "application/octet-stream") return file.type.startsWith("image/");
  return IMAGE_EXT_RE.test(file.name || "");
}

// 본문에서 제목 뽑기: 첫 줄, 없으면 앞부분.
function deriveTitle(content: string) {
  const firstLine = content.split("\n").map((s) => s.trim()).find((s) => s.length > 0) || content.trim();
  return firstLine.slice(0, 40) || "새 글";
}

export default function CommunityComposeModal({
  onClose,
  onPosted,
}: {
  onClose: () => void;
  onPosted?: () => void;
}) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // GIF 피커 (인스타/스레드처럼 GIPHY 에서 검색해 붙인다)
  // GIF 버튼은 서버에 GIPHY 키가 설정돼 있을 때만 보인다(값싼 probe 로 확인).
  const [gifEnabled, setGifEnabled] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifConfigured, setGifConfigured] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const imagesRef = useRef<UploadedImage[]>([]);
  imagesRef.current = images;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/category-groups");
        const data = await res.json();
        const gs: CategoryGroup[] = data.groups || [];
        setGroups(gs);
      } catch {
        /* 카테고리 못 불러와도 모달은 열어둔다 */
      }
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        const d = await me.json();
        if (d?.user) {
          setNickname(d.user.nickname || "");
          setAvatar(d.user.avatar || null);
        }
      } catch {
        /* 로그인 정보 없으면 기본 아바타 */
      }
    })();
    // GIF 사용 가능 여부 확인(키 있으면 버튼 노출)
    (async () => {
      try {
        const r = await fetch("/api/gifs?probe=1");
        const d = await r.json();
        setGifEnabled(d?.configured === true);
      } catch {
        /* 실패하면 버튼 숨김 유지 */
      }
    })();
    // 언마운트 시 프리뷰 objectURL 해제
    return () => imagesRef.current.forEach((im) => revokeUploadPreview(im.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // GIF 피커가 열려 있으면 그것만 닫는다.
      if (gifOpen) setGifOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    // 모달 열리면 배경 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, gifOpen]);

  // GIF 검색 — 피커가 열려 있는 동안 질의가 바뀌면 디바운스 후 조회(빈 질의는 트렌딩).
  useEffect(() => {
    if (!gifOpen) return;
    let alive = true;
    setGifLoading(true);
    const q = gifQuery.trim();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!alive) return;
        setGifConfigured(data.configured !== false);
        setGifResults(data.gifs || []);
      } catch {
        if (alive) setGifResults([]);
      } finally {
        if (alive) setGifLoading(false);
      }
    }, q ? 350 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [gifOpen, gifQuery]);

  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  async function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (images.length + files.length > 5) {
      setMessage("이미지는 최대 5장까지 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const next: UploadedImage[] = [];
      for (const f of files) {
        if (!isImageFile(f)) throw new Error("이미지 파일만 올릴 수 있어요.");
        if (f.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하만 올릴 수 있어요.");
        next.push(await uploadCommunityImage(f));
      }
      setImages((cur) => [...cur, ...next]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "이미지 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((cur) => {
      revokeUploadPreview(cur.find((i) => i.url === url)?.previewUrl);
      return cur.filter((i) => i.url !== url);
    });
  }

  function pickGif(gif: GifResult) {
    if (images.length >= 5) {
      setMessage("이미지는 최대 5장까지 올릴 수 있어요.");
      setGifOpen(false);
      return;
    }
    // GIF 는 GIPHY CDN URL 을 그대로 붙인다(업로드 없음). previewUrl=url 이라 해제 대상 아님.
    setImages((cur) => [...cur, { url: gif.url, previewUrl: gif.url, name: "GIF" }]);
    setGifOpen(false);
    setGifQuery("");
    setMessage("");
  }

  const canPost = !!content.trim() && !posting && !uploading;
  const selectedGroup = groups.find((g) => g.id === groupId);

  async function submit() {
    if (!canPost) return;
    if (!groupId) { setPickerOpen(true); setMessage("커뮤니티(주제)를 선택해주세요."); return; }
    setPosting(true);
    setMessage("");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: deriveTitle(content),
          content: content.trim(),
          tagIds: [],
          imageUrls: images.map((i) => i.url),
          type: "normal",
          isBlinded: false,
          pollOptions: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "게시글을 저장하지 못했어요.");
      clientCache.clearPrefix("community-");
      markWroteToday();
      onPosted?.();
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "게시글을 저장하지 못했어요.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="compose-modal" role="dialog" aria-label="새로운 스레드" aria-modal="true">
      {/* 헤더 */}
      <div className="cmp-head">
        <button type="button" className="cmp-cancel" onClick={onClose}>취소</button>
        <span className="cmp-title">새로운 스레드</span>
        <span className="cmp-head-right" aria-hidden="true" />
      </div>

      {/* 본문 */}
      <div className="cmp-body">
        <div className="cmp-row">
          <div className="cmp-avatar-col">
            <span className="cmp-avatar">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                nickname.slice(0, 1) || "나"
              )}
            </span>
            <span className="cmp-thread-line" aria-hidden="true" />
          </div>

          <div className="cmp-main">
            <div className="cmp-user-line">
              <span className="cmp-nick">{nickname || "나"}</span>
              <span className="cmp-chevron">›</span>
              <button type="button" className={`cmp-cat${selectedGroup ? " is-set" : ""}`} onClick={() => setPickerOpen((v) => !v)}>
                {selectedGroup ? selectedGroup.name : "커뮤니티 또는 주제"}
              </button>
            </div>

            {pickerOpen && (
              <div className="cmp-cat-list">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`cmp-cat-item${g.id === groupId ? " is-on" : ""}`}
                    onClick={() => { setGroupId(g.id); setPickerOpen(false); setMessage(""); }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={taRef}
              className="cmp-textarea"
              placeholder="새로운 소식이 있나요?"
              value={content}
              onChange={(e) => { setContent(e.target.value); autoGrow(); }}
              rows={1}
              autoFocus
            />

            {images.length > 0 && (
              <div className="cmp-images">
                {images.map((im) => (
                  <div key={im.url} className="cmp-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.previewUrl} alt="" />
                    <button type="button" className="cmp-image-x" onClick={() => removeImage(im.url)} aria-label="이미지 삭제">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* 첨부 아이콘 줄 — 사진 · GIF */}
            <div className="cmp-attach">
              <button type="button" className="cmp-attach-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="사진">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/community/compose-image.svg" alt="" />
              </button>
              {gifEnabled && (
                <button type="button" className="cmp-attach-btn cmp-gif" onClick={() => { setGifOpen(true); setMessage(""); }} aria-label="GIF">GIF</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickImages} style={{ display: "none" }} />
          </div>
        </div>

        {/* 스레드에 추가(장식) */}
        <div className="cmp-add-row" aria-hidden="true">
          <span className="cmp-add-avatar">{avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" referrerPolicy="no-referrer" />
          ) : (nickname.slice(0, 1) || "나")}</span>
          <span className="cmp-add-text">스레드에 추가</span>
        </div>

        {message && <p className="cmp-msg">{message}</p>}
      </div>

      {/* 푸터 */}
      <div className="cmp-foot">
        <button type="button" className="cmp-post" disabled={!canPost} onClick={submit}>
          {posting ? "게시 중…" : "게시"}
        </button>
      </div>

      {/* GIF 피커 시트 */}
      {gifOpen && (
        <div className="cmp-gif-sheet">
          <div className="cmp-head">
            <button type="button" className="cmp-cancel" onClick={() => setGifOpen(false)}>취소</button>
            <span className="cmp-title">GIF</span>
            <span className="cmp-head-right" aria-hidden="true" />
          </div>
          <div className="cmp-gif-search">
            <input
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="GIF 검색"
              autoFocus
            />
          </div>
          <div className="cmp-gif-body">
            {!gifConfigured ? (
              <p className="cmp-gif-empty">GIF 기능이 아직 설정되지 않았어요.</p>
            ) : gifLoading && gifResults.length === 0 ? (
              <p className="cmp-gif-empty">불러오는 중…</p>
            ) : gifResults.length === 0 ? (
              <p className="cmp-gif-empty">결과가 없어요.</p>
            ) : (
              <div className="cmp-gif-grid">
                {gifResults.map((g) => (
                  <button key={g.id} type="button" className="cmp-gif-cell" onClick={() => pickGif(g)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.preview} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cmp-gif-powered">Powered by GIPHY</div>
        </div>
      )}

      <ComposeStyles />
    </div>
  );
}

function ComposeStyles() {
  return (
    <style>{`
      .compose-modal {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: var(--c-bg);
        display: flex;
        flex-direction: column;
        animation: cmpUp 0.24s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes cmpUp { from { transform: translateY(24px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
      .cmp-head {
        flex-shrink: 0;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 8px;
        padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
        border-bottom: 1px solid var(--c-bg-muted-6);
      }
      .cmp-cancel { justify-self: start; border: none; background: none; padding: 0; font-size: 16px; font-weight: 500; color: var(--c-text); cursor: pointer; }
      .cmp-title { justify-self: center; font-size: 16px; font-weight: 800; color: var(--c-text); }
      .cmp-head-right { justify-self: end; }
      .cmp-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px; }
      .cmp-row { display: flex; gap: 12px; }
      .cmp-avatar-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
      .cmp-avatar {
        width: 40px; height: 40px; border-radius: 999px; overflow: hidden;
        background: var(--c-bg-muted); color: var(--c-text-3);
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 15px; font-weight: 700; flex-shrink: 0;
      }
      .cmp-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cmp-thread-line { flex: 1; width: 2px; min-height: 24px; background: var(--c-bg-muted-6); margin: 6px 0; border-radius: 2px; }
      .cmp-main { flex: 1; min-width: 0; padding-bottom: 4px; }
      .cmp-user-line { display: flex; align-items: center; gap: 5px; min-height: 22px; }
      .cmp-nick { font-size: 15px; font-weight: 700; color: var(--c-text); }
      .cmp-chevron { color: var(--c-text-4); font-size: 15px; }
      .cmp-cat { border: none; background: none; padding: 0; font-size: 15px; font-weight: 500; color: var(--c-text-4); cursor: pointer; }
      .cmp-cat.is-set { color: var(--c-brand); font-weight: 600; }
      .cmp-cat-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 2px; }
      .cmp-cat-item {
        border: 1px solid var(--c-border); background: transparent; color: var(--c-text-3);
        border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .cmp-cat-item.is-on { background: var(--c-inverse); border-color: var(--c-inverse); color: #fff; }
      .cmp-textarea {
        width: 100%; border: none; outline: none; resize: none; background: transparent;
        margin-top: 4px; padding: 0; font-family: inherit; font-size: 16px; line-height: 1.5;
        color: var(--c-text); min-height: 48px; overflow: hidden;
      }
      .cmp-textarea::placeholder { color: var(--c-text-4); }
      .cmp-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 4px 0 8px; }
      .cmp-image { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid var(--c-bg-muted-6); }
      .cmp-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cmp-image-x { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 999px; border: none; background: rgba(17,24,39,0.7); color: #fff; font-size: 16px; line-height: 24px; cursor: pointer; }
      .cmp-attach { display: flex; align-items: center; gap: 20px; margin-top: 12px; }
      .cmp-attach-btn { border: none; background: none; padding: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
      .cmp-attach-btn:disabled { opacity: 0.5; }
      .cmp-attach-btn img { width: 25px; height: 25px; display: block; filter: brightness(0.72); }
      .cmp-gif { font-size: 12px; font-weight: 800; color: var(--c-text-4); border: 2px solid var(--c-text-4) !important; border-radius: 7px; width: 30px; height: 21px; opacity: 0.7; }
      .cmp-add-row { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
      .cmp-add-avatar { width: 26px; height: 26px; border-radius: 999px; overflow: hidden; background: var(--c-bg-muted); color: var(--c-text-4); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-left: 7px; }
      .cmp-add-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cmp-add-text { color: var(--c-text-4); font-size: 15px; }
      .cmp-msg { margin: 12px 0 0; color: var(--c-brand-deep-2); font-size: 13px; font-weight: 600; }
      .cmp-foot {
        flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;
        gap: 12px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid var(--c-bg-muted-6);
      }
      .cmp-post {
        border: none; border-radius: 999px; padding: 9px 20px;
        background: var(--c-inverse); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
        -webkit-tap-highlight-color: transparent; transition: opacity 0.15s ease;
      }
      .cmp-post:disabled { opacity: 0.4; cursor: default; }

      /* GIF 피커 시트 — 모달 위에 덮는다 */
      .cmp-gif-sheet {
        position: absolute; inset: 0; z-index: 10;
        background: var(--c-bg); display: flex; flex-direction: column;
        animation: cmpUp 0.2s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .cmp-gif-search { flex-shrink: 0; padding: 12px 16px; }
      .cmp-gif-search input {
        width: 100%; height: 42px; border: 1px solid var(--c-border); border-radius: 999px;
        padding: 0 16px; font-size: 15px; color: var(--c-text); background: var(--c-bg-muted);
        outline: none; font-family: inherit;
      }
      .cmp-gif-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 4px 16px 16px; }
      .cmp-gif-empty { text-align: center; color: var(--c-text-4); font-size: 14px; padding: 40px 0; }
      .cmp-gif-grid { column-count: 2; column-gap: 8px; }
      .cmp-gif-cell {
        display: block; width: 100%; margin: 0 0 8px; padding: 0; border: none; cursor: pointer;
        border-radius: 12px; overflow: hidden; background: var(--c-bg-muted); break-inside: avoid;
        -webkit-tap-highlight-color: transparent;
      }
      .cmp-gif-cell img { width: 100%; height: auto; display: block; }
      .cmp-gif-powered { flex-shrink: 0; text-align: center; color: var(--c-text-4); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0px)); }
    `}</style>
  );
}
