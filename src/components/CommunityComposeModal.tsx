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
  // 게시물 옵션(고급): 투표·스포일러.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isBlinded, setIsBlinded] = useState(false);

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
    // 언마운트 시 프리뷰 objectURL 해제
    return () => imagesRef.current.forEach((im) => revokeUploadPreview(im.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // 모달 열리면 배경 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

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

  const filledPoll = pollOptions.map((o) => o.trim()).filter(Boolean);
  const canPost = !!content.trim() && !posting && !uploading;
  const selectedGroup = groups.find((g) => g.id === groupId);

  async function submit() {
    if (!canPost) return;
    if (!groupId) { setPickerOpen(true); setMessage("커뮤니티(주제)를 선택해주세요."); return; }
    if (isPoll && filledPoll.length < 2) { setOptionsOpen(true); setMessage("투표 항목을 2개 이상 입력해주세요."); return; }
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
          type: isPoll ? "poll" : "normal",
          isBlinded,
          pollOptions: isPoll ? filledPoll : [],
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
        <span className="cmp-head-right">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cmp-head-ic" src="/icons/community/compose-draft.svg" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cmp-head-ic" src="/icons/community/compose-menu.svg" alt="" />
        </span>
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

            {/* 첨부 아이콘 줄 */}
            <div className="cmp-attach">
              <button type="button" className="cmp-attach-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="사진">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/community/compose-image.svg" alt="" />
              </button>
              <button type="button" className="cmp-attach-btn" onClick={() => setMessage("준비 중이에요.")} aria-label="스티커">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/community/compose-emoji.svg" alt="" />
              </button>
              <button type="button" className="cmp-attach-btn cmp-gif" onClick={() => setMessage("준비 중이에요.")} aria-label="GIF">GIF</button>
              <button type="button" className="cmp-attach-btn" onClick={() => setMessage("준비 중이에요.")} aria-label="음악">
                {/* 폴더에 음표 아이콘이 없어 레퍼런스(음표)에 맞춰 인라인으로 그린다. */}
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 17.5V6.2l9.5-1.9v11.2" stroke="#7f858c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="6.6" cy="17.6" r="2.6" fill="#7f858c" />
                  <circle cx="16" cy="15.6" r="2.6" fill="#7f858c" />
                </svg>
              </button>
              <button type="button" className="cmp-attach-btn" onClick={() => setOptionsOpen((v) => !v)} aria-label="더보기">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/community/compose-more.svg" alt="" />
              </button>
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

        {/* 게시물 옵션(고급) */}
        {optionsOpen && (
          <div className="cmp-options">
            <label className="cmp-opt-toggle">
              <input type="checkbox" checked={isPoll} onChange={(e) => setIsPoll(e.target.checked)} />
              투표 넣기
            </label>
            {isPoll && (
              <div className="cmp-poll">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="cmp-poll-row">
                    <input
                      value={opt}
                      onChange={(e) => setPollOptions((cur) => cur.map((o, j) => (j === i ? e.target.value : o)))}
                      placeholder={`항목 ${i + 1}`}
                      maxLength={60}
                      className="cmp-poll-input"
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" className="cmp-poll-x" onClick={() => setPollOptions((cur) => cur.filter((_, j) => j !== i))} aria-label="삭제">×</button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button type="button" className="cmp-poll-add" onClick={() => setPollOptions((cur) => [...cur, ""])}>항목 추가</button>
                )}
              </div>
            )}
            <label className="cmp-opt-toggle">
              <input type="checkbox" checked={isBlinded} onChange={(e) => setIsBlinded(e.target.checked)} />
              스포일러로 표시 (사진을 가림)
            </label>
          </div>
        )}

        {message && <p className="cmp-msg">{message}</p>}
      </div>

      {/* 푸터 */}
      <div className="cmp-foot">
        <button type="button" className="cmp-foot-opt" onClick={() => setOptionsOpen((v) => !v)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/community/compose-options.svg" alt="" />
          게시물 옵션
        </button>
        <span className="cmp-foot-right">
          <span className="cmp-foot-toggle" aria-hidden="true">
            <span className="cmp-foot-knob">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/community/compose-emoji.svg" alt="" />
            </span>
          </span>
          <button type="button" className="cmp-post" disabled={!canPost} onClick={submit}>
            {posting ? "게시 중…" : "게시"}
          </button>
        </span>
      </div>

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
      .cmp-head-right { justify-self: end; display: inline-flex; align-items: center; gap: 14px; }
      /* 아이콘이 옅은 회색(#B0B8C1)이라 헤더/옵션 아이콘은 어둡게 눌러 진하게 보이게. */
      .cmp-head-ic { width: 24px; height: 24px; display: block; filter: brightness(0.45); }
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
      .cmp-options { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--c-bg-muted-6); display: grid; gap: 14px; }
      .cmp-opt-toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--c-text-2c); cursor: pointer; }
      .cmp-opt-toggle input { width: 18px; height: 18px; }
      .cmp-poll { display: grid; gap: 8px; }
      .cmp-poll-row { display: flex; gap: 6px; align-items: center; }
      .cmp-poll-input { flex: 1; height: 42px; border: 1px solid var(--c-border); border-radius: 12px; padding: 0 12px; font-size: 15px; color: var(--c-text); background: var(--c-bg); }
      .cmp-poll-x { flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text-3); font-size: 18px; cursor: pointer; }
      .cmp-poll-add { justify-self: start; border: 1px solid var(--c-border); background: transparent; color: var(--c-text-3); border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .cmp-msg { margin: 12px 0 0; color: var(--c-brand-deep-2); font-size: 13px; font-weight: 600; }
      .cmp-foot {
        flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
        gap: 12px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid var(--c-bg-muted-6);
      }
      .cmp-foot-opt { display: inline-flex; align-items: center; gap: 7px; border: none; background: none; padding: 0; font-size: 15px; font-weight: 500; color: var(--c-text-4); cursor: pointer; }
      .cmp-foot-opt img { width: 22px; height: 22px; display: block; filter: brightness(0.6); }
      .cmp-foot-right { display: inline-flex; align-items: center; gap: 12px; }
      /* 레퍼런스의 장식용 토글 알약(얼굴 노브) */
      .cmp-foot-toggle { width: 58px; height: 34px; border-radius: 999px; background: var(--c-bg-muted-6); display: inline-flex; align-items: center; padding: 3px; }
      .cmp-foot-knob { width: 28px; height: 28px; border-radius: 999px; background: var(--c-bg); box-shadow: 0 1px 3px rgba(15,23,42,0.14); display: inline-flex; align-items: center; justify-content: center; }
      .cmp-foot-knob img { width: 18px; height: 18px; display: block; filter: brightness(0.7); }
      .cmp-post {
        border: none; border-radius: 999px; padding: 9px 20px;
        background: var(--c-inverse); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
        -webkit-tap-highlight-color: transparent; transition: opacity 0.15s ease;
      }
      .cmp-post:disabled { opacity: 0.4; cursor: default; }
    `}</style>
  );
}
