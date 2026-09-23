"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clientCache } from "@/lib/clientCache";
import { markWroteToday } from "@/lib/writeNudge";
import { uploadCommunityImage, revokeUploadPreview } from "@/lib/communityUpload";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

// 스레드(Threads) 스타일 게시물 작성 모달. 커뮤니티 목록 위에 올라온다.
// 백엔드는 groupId·title·content 가 필수라, 제목은 본문 첫 줄에서 자동으로 뽑는다.

// OX 퀴즈 상한 — src/lib/community.ts 의 QUIZ_MAX_* 와 같은 값.
// 서버 상수를 그대로 가져오면 prisma 까지 번들에 딸려와서 여기서 다시 적는다.
const QUIZ_MAX_QUESTIONS_PER_POST = 5;
const QUIZ_MAX_POSTS_PER_DAY = 3;

interface CategoryGroup {
  id: string;
  name: string;
  slug?: string;
}
interface PickCategory { id: string; name: string; icon: string; sets: number }
interface PickSet { id: string; title: string; total: number }
interface PickQuestion {
  id: string;
  question: string;
  answer: boolean;
  setId: string;
  setTitle: string;
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

// 정답 고르는 O / X 도 읽는 쪽(퀴즈 카드)과 같은 도형으로 그린다.
function OXMark({ o, size = 18 }: { o: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {o ? (
        <circle cx="12" cy="12" r="7.6" stroke="currentColor" strokeWidth="3.2" />
      ) : (
        <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <line x1="6.2" y1="6.2" x2="17.8" y2="17.8" />
          <line x1="17.8" y1="6.2" x2="6.2" y2="17.8" />
        </g>
      )}
    </svg>
  );
}

export default function CommunityComposeModal({
  onClose,
  onPosted,
  initialContent,
  initialGroupSlug,
}: {
  onClose: () => void;
  onPosted?: () => void;
  /** 다른 화면에서 넘어올 때 미리 채워둘 본문(문제 오류 건의 등) */
  initialContent?: string;
  /** 미리 골라둘 카테고리(slug) */
  initialGroupSlug?: string;
}) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [content, setContent] = useState(initialContent ?? "");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 문제 오류 건의 — 문제를 골라 본문에 발췌 + 딥링크로 붙인다.
  const [qPickOpen, setQPickOpen] = useState(false);
  const [qQuery, setQQuery] = useState("");
  const [qList, setQList] = useState<PickQuestion[]>([]);
  const [qLoading, setQLoading] = useState(false);
  // 카테고리 목록이 아직 안 왔을 때 고른 주제를 기억해 뒀다가, 오면 그때 적용한다.
  const [pendingGroupSlug, setPendingGroupSlug] = useState("");
  // 단계별 고르기(과목 → 문제집 → 문제). 검색어가 있으면 검색 결과가 우선.
  const [qCats, setQCats] = useState<PickCategory[]>([]);
  const [qSets, setQSets] = useState<PickSet[]>([]);
  const [qCat, setQCat] = useState<PickCategory | null>(null);
  const [qSet, setQSet] = useState<PickSet | null>(null);

  // GIF 피커 (인스타/스레드처럼 GIPHY 에서 검색해 붙인다)
  // GIF 버튼은 서버에 GIPHY 키가 설정돼 있을 때만 보인다(값싼 probe 로 확인).
  const [gifEnabled, setGifEnabled] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifConfigured, setGifConfigured] = useState(true);
  // 투표 / 블라인드 — 예전엔 안 쓰이는 작성 페이지에만 있어서 모달로 쓰면 만들 수 없었다.
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  // OX 퀴즈 — 문제 여러 개(문장 + 정답 O/X). 투표와는 동시에 못 켠다.
  const [quizOn, setQuizOn] = useState(false);
  const [quizItems, setQuizItems] = useState<{ text: string; answer: boolean }[]>([{ text: "", answer: true }]);
  // 오늘 더 올릴 수 있는 퀴즈 글 수. null 은 아직 안 물어본 상태.
  const [quizLeft, setQuizLeft] = useState<number | null>(null);
  const [isBlinded, setIsBlinded] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 안드로이드 WebView 는 키보드가 떠도 fixed 기준 화면(레이아웃 뷰포트)을 줄이지 않는다.
  // 그대로 두면 모달 아래쪽(입력칸·'게시' 버튼)이 키보드 뒤로 숨는데, 가로모드는 화면이
  // 낮아서 본문까지 통째로 가린다 → 덮인 높이만큼 모달을 줄여 항상 보이는 영역 안에 둔다.
  const rootRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset(true, rootRef);
  const imagesRef = useRef<UploadedImage[]>([]);
  imagesRef.current = images;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/category-groups");
        const data = await res.json();
        const gs: CategoryGroup[] = data.groups || [];
        setGroups(gs);
        // 넘겨받은 카테고리(건의게시판 등)가 있으면 미리 골라둔다.
        if (initialGroupSlug) {
          const hit = gs.find((g) => g.slug === initialGroupSlug);
          if (hit) setGroupId(hit.id);
        }
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
    setPollOn(false);
    setPollOptions(["", ""]);
    setQuizOn(false);
    setQuizItems([{ text: "", answer: true }]);
    setIsBlinded(false);
  }

  useEffect(() => {
    if (!qPickOpen) return;
    let alive = true;
    setQLoading(true);
    const search = qQuery.trim();
    // 검색어 > 문제집 선택 > 과목 선택 > (기본) 최근 푼 문제 + 과목 목록
    const url = search
      ? `/api/ox-questions/pick?q=${encodeURIComponent(search)}`
      : qSet
        ? `/api/ox-questions/pick?level=questions&setId=${encodeURIComponent(qSet.id)}`
        : qCat
          ? `/api/ox-questions/pick?level=sets&categoryId=${encodeURIComponent(qCat.id)}`
          : `/api/ox-questions/pick`;
    const timer = setTimeout(() => {
      fetch(url, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setQList(d.questions || []);
          setQSets(d.sets || []);
        })
        .catch(() => {
          if (alive) {
            setQList([]);
            setQSets([]);
          }
        })
        .finally(() => {
          if (alive) setQLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [qPickOpen, qQuery, qCat, qSet]);

  // 과목 목록은 시트를 열 때 한 번만
  useEffect(() => {
    if (!qPickOpen || qCats.length > 0) return;
    let alive = true;
    fetch("/api/ox-questions/pick?level=categories")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setQCats(d.categories || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [qPickOpen, qCats.length]);

  useEffect(() => {
    if (!pendingGroupSlug || groups.length === 0) return;
    const hit = groups.find((g) => g.slug === pendingGroupSlug);
    if (!hit) return;
    const t = setTimeout(() => {
      setGroupId(hit.id);
      setPendingGroupSlug("");
    }, 0);
    return () => clearTimeout(t);
  }, [pendingGroupSlug, groups]);

  // 주제를 slug 로 고른다. 목록이 아직이면 기억해 뒀다 적용.
  function chooseGroup(slug: string) {
    const hit = groups.find((g) => g.slug === slug);
    if (hit) setGroupId(hit.id);
    else setPendingGroupSlug(slug);
  }

  // 고른 문제를 본문에 붙이고 카테고리를 건의게시판으로
  function attachQuestion(q: PickQuestion) {
    const origin = typeof window === "undefined" ? "https://stady.kr" : window.location.origin;
    const block = [
      "[문제 오류 건의]",
      `문제집: ${q.setTitle}`,
      `문제: ${q.question}`,
      `표시된 정답: ${q.answer ? "O" : "X"}`,
      `바로가기: ${origin}/ox-quiz/${q.setId}?q=${q.id}`,
      "",
      "",
    ].join("\n");
    setContent((cur) => (cur.trim() ? `${cur.replace(/\s+$/, "")}\n\n${block}` : block));
    chooseGroup("suggestion");
    setQPickOpen(false);
    setQQuery("");
    setQCat(null);
    setQSet(null);
  }

  // 투표·OX퀴즈 글은 주제가 따로 없으니 '자유'로 자동 지정한다(사용자가 다시 바꿀 수 있다).
  function pickFree() {
    chooseGroup("free");
  }

  // OX 퀴즈 켜기/끄기. 켤 때 오늘 남은 개수를 확인해서, 다 썼으면 아예 못 켜게 한다.
  // (진짜 상한은 저장할 때 서버가 잡는다 — 여기 확인은 헛수고를 막기 위한 것.)
  function toggleQuiz() {
    setPollOn(false);
    setMessage("");
    if (quizOn) {
      setQuizOn(false);
      return;
    }
    setQuizOn(true);
    pickFree();
    fetch("/api/community/quiz-quota", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || typeof data.remaining !== "number") return;
        setQuizLeft(data.remaining);
        if (data.remaining <= 0) {
          setQuizOn(false);
          setMessage(`OX 퀴즈는 하루에 ${QUIZ_MAX_POSTS_PER_DAY}개까지 올릴 수 있어요. 내일 다시 올려주세요.`);
        }
      })
      .catch(() => {});
  }

  const filledPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const filledQuizItems = quizItems
    .map((q) => ({ text: q.text.trim(), answer: q.answer }))
    .filter((q) => q.text.length > 0);
  const canPost =
    !!content.trim() && !posting && !uploading
    && (!pollOn || filledPollOptions.length >= 2)
    && (!quizOn || filledQuizItems.length >= 1);
  const selectedGroup = groups.find((g) => g.id === groupId);

  async function submit() {
    if (!canPost) return;
    if (!groupId) { setPickerOpen(true); setMessage("커뮤니티(주제)를 선택해주세요."); return; }
    if (pollOn && filledPollOptions.length < 2) { setMessage("투표 항목을 2개 이상 입력해주세요."); return; }
    if (quizOn && filledQuizItems.length < 1) { setMessage("OX 퀴즈 문제를 1개 이상 입력해주세요."); return; }
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
          type: quizOn ? "quiz" : pollOn ? "poll" : "normal",
          isBlinded,
          pollOptions: pollOn ? filledPollOptions : [],
          quizItems: quizOn ? filledQuizItems : [],
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

  // 하단 네비게이션은 페이지 바깥(문서 루트)에 fixed 로 떠 있다. 글쓰기 화면을 페이지
  // 안에 그리면 상위에 쌓임 맥락이 생기는 순간 z-index 와 무관하게 네비가 위로 올라와
  // 가려버린다 → body 포털로 띄운다.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      className="compose-modal"
      role="dialog"
      aria-label="새로운 스레드"
      aria-modal="true"
      /* 높이(bottom)를 줄이면 이 요소를 재서 덮인 높이를 구하는 훅이 0 을 보고 되돌려
         진동한다 → 테두리 상자는 그대로 두고 padding 으로만 안쪽을 좁힌다. */
      style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
    >
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

            {/* 투표 항목 (2~4개) */}
            {pollOn && (
              <div className="cmp-poll">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="cmp-poll-row">
                    <input
                      className="cmp-poll-input"
                      value={opt}
                      maxLength={40}
                      placeholder={`항목 ${i + 1}`}
                      onChange={(e) => setPollOptions((cur) => cur.map((v, idx) => (idx === i ? e.target.value : v)))}
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" className="cmp-poll-x" aria-label="항목 삭제"
                        onClick={() => setPollOptions((cur) => cur.filter((_, idx) => idx !== i))}>×</button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button type="button" className="cmp-poll-add" onClick={() => setPollOptions((cur) => [...cur, ""])}>
                    + 항목 추가
                  </button>
                )}
                <p className="cmp-poll-hint">2~4개 항목을 입력하세요. 1인 1표로 투표됩니다.</p>
              </div>
            )}

            {quizOn && (
              <div className="cmp-quiz">
                {quizItems.map((q, i) => (
                  <div key={i} className="cmp-quiz-row">
                    <div className="cmp-quiz-top">
                      <input
                        className="cmp-quiz-input"
                        value={q.text}
                        onChange={(e) => {
                          const v = e.target.value;
                          setQuizItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, text: v } : it)));
                        }}
                        placeholder={`문제 ${i + 1}`}
                        maxLength={200}
                      />
                      {quizItems.length > 1 && (
                        <button
                          type="button"
                          className="cmp-poll-x"
                          aria-label="문제 삭제"
                          onClick={() => setQuizItems((cur) => cur.filter((_, idx) => idx !== i))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="cmp-quiz-ox">
                      {([true, false] as const).map((val) => (
                        <button
                          key={String(val)}
                          type="button"
                          className={`cmp-quiz-ox-btn${q.answer === val ? " is-on" : ""}${val ? " is-o" : " is-x"}`}
                          aria-pressed={q.answer === val}
                          onClick={() => setQuizItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, answer: val } : it)))}
                        >
                          <OXMark o={val} size={20} />
                        </button>
                      ))}
                      <span className="cmp-quiz-label">정답을 골라주세요</span>
                    </div>
                  </div>
                ))}
                {quizItems.length < QUIZ_MAX_QUESTIONS_PER_POST && (
                  <button
                    type="button"
                    className="cmp-poll-add"
                    onClick={() => setQuizItems((cur) => [...cur, { text: "", answer: true }])}
                  >
                    + 문제 추가
                  </button>
                )}
                <p className="cmp-poll-hint">
                  문제마다 정답을 O 또는 X로 고르세요. 한 글에 최대 {QUIZ_MAX_QUESTIONS_PER_POST}문제까지 낼 수 있어요.
                  {quizLeft === null
                    ? ` OX 퀴즈는 하루에 ${QUIZ_MAX_POSTS_PER_DAY}개까지 올릴 수 있어요.`
                    : ` 오늘은 ${quizLeft}개 더 올릴 수 있어요.`}
                </p>
              </div>
            )}

            {/* 첨부 아이콘 줄 — 사진 · GIF · 투표 · OX퀴즈 · 블라인드 */}
            <div className="cmp-attach">
              <button type="button" className="cmp-attach-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="사진">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/toss/picture.svg" alt="" />
              </button>
              {gifEnabled && (
                <button type="button" className="cmp-attach-btn cmp-gif" onClick={() => { setGifOpen(true); setMessage(""); }} aria-label="GIF">GIF</button>
              )}
              <button
                type="button"
                className={`cmp-chip${pollOn ? " is-on" : ""}`}
                onClick={() => { setPollOn((v) => { const next = !v; if (next) pickFree(); return next; }); setQuizOn(false); setMessage(""); }}
                aria-pressed={pollOn}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/compose/vote.svg" alt="" width={20} height={20} />
                투표
              </button>
              <button
                type="button"
                className={`cmp-chip${quizOn ? " is-on" : ""}`}
                onClick={() => { toggleQuiz(); }}
                aria-pressed={quizOn}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/compose/ox.svg" alt="" width={20} height={20} />
                OX퀴즈
              </button>
              <button
                type="button"
                className="cmp-chip"
                onClick={() => { setQPickOpen(true); setMessage(""); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/compose/report.svg" alt="" width={20} height={20} />
                문제 오류
              </button>
              <button
                type="button"
                className={`cmp-chip${isBlinded ? " is-on" : ""}`}
                onClick={() => setIsBlinded((v) => !v)}
                aria-pressed={isBlinded}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/compose/blind.svg" alt="" width={20} height={20} />
                블라인드
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

        {message && <p className="cmp-msg">{message}</p>}
      </div>

      {/* 푸터 */}
      <div className="cmp-foot">
        <button type="button" className="cmp-post" disabled={!canPost} onClick={submit}>
          {posting ? "게시 중…" : "게시"}
        </button>
      </div>

      {/* 문제 고르기 시트 — 최근 푼 문제 또는 검색 */}
      {qPickOpen && (
        <div className="cmp-gif-sheet">
          <div className="cmp-head">
            <button type="button" className="cmp-cancel" onClick={() => { setQPickOpen(false); setQQuery(""); setQCat(null); setQSet(null); }}>취소</button>
            <span className="cmp-title">문제 고르기</span>
            <span className="cmp-head-right" aria-hidden="true" />
          </div>
          <div className="cmp-qpick">
            <div className="cmp-qsearch">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
              <input
                value={qQuery}
                onChange={(e) => setQQuery(e.target.value)}
                placeholder="문제 내용으로 검색"
              />
              {qQuery && (
                <button type="button" onClick={() => setQQuery("")} aria-label="검색어 지우기">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* 검색 중이 아니면 과목 → 문제집 → 문제 순으로 골라 들어간다 */}
            {!qQuery.trim() && (qCat || qSet) && (
              <div className="cmp-qpick-crumb">
                <button type="button" onClick={() => { setQCat(null); setQSet(null); }}>과목</button>
                <span aria-hidden="true">›</span>
                {qCat && (
                  <button type="button" onClick={() => setQSet(null)} className={qSet ? "" : "is-now"}>
                    {qCat.name}
                  </button>
                )}
                {qSet && (
                  <>
                    <span aria-hidden="true">›</span>
                    <button type="button" className="is-now">{qSet.title}</button>
                  </>
                )}
              </div>
            )}

            {qLoading && <p className="cmp-poll-hint">불러오는 중…</p>}

            {/* 1단계: 과목 */}
            {!qQuery.trim() && !qCat && (
              <>
                {qList.length > 0 && (
                  <>
                    <p className="cmp-qpick-label">최근에 푼 문제</p>
                    <div className="cmp-qpick-list">
                      {qList.slice(0, 5).map((q) => (
                        <button key={q.id} type="button" className="cmp-qpick-item" onClick={() => attachQuestion(q)}>
                          <span className="cmp-qpick-set">{q.setTitle}</span>
                          <span className="cmp-qpick-text">{q.question}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="cmp-qpick-label">과목에서 찾기</p>
                <div className="cmp-qpick-list">
                  {qCats.map((c) => (
                    <button key={c.id} type="button" className="cmp-qpick-item is-row" onClick={() => { setQCat(c); setQSet(null); }}>
                      <span className="cmp-qpick-text">
                        {/* 과목 아이콘은 이미지 경로일 수도, 이모지일 수도 있다 */}
                        {c.icon?.startsWith("/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.icon} alt="" width={20} height={20} style={{ display: "inline-block", verticalAlign: "-4px", marginRight: 6, objectFit: "contain" }} />
                        ) : (
                          <span style={{ marginRight: 6 }}>{c.icon}</span>
                        )}
                        {c.name}
                      </span>
                      <span className="cmp-qpick-count">{c.sets}개</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 2단계: 문제집 */}
            {!qQuery.trim() && qCat && !qSet && (
              <div className="cmp-qpick-list">
                {qSets.map((st) => (
                  <button key={st.id} type="button" className="cmp-qpick-item is-row" onClick={() => setQSet(st)}>
                    <span className="cmp-qpick-text">{st.title}</span>
                    <span className="cmp-qpick-count">{st.total}문제</span>
                  </button>
                ))}
                {!qLoading && qSets.length === 0 && <p className="cmp-poll-hint">문제집이 없어요.</p>}
              </div>
            )}

            {/* 3단계(또는 검색 결과): 문제 */}
            {(qQuery.trim() || qSet) && (
              <div className="cmp-qpick-list">
                {qList.map((q, i) => (
                  <button key={q.id} type="button" className="cmp-qpick-item" onClick={() => attachQuestion(q)}>
                    <span className="cmp-qpick-set">{qSet ? `${i + 1}번` : q.setTitle}</span>
                    <span className="cmp-qpick-text">{q.question}</span>
                  </button>
                ))}
                {!qLoading && qList.length === 0 && <p className="cmp-poll-hint">찾은 문제가 없어요.</p>}
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>,
    document.body
  );
}

function ComposeStyles() {
  return (
    <style>{`
      .compose-modal {
        position: fixed;
        /* 안드로이드 WebView 는 inset 단축을 무시하는 버전이 있다 — 개별 지정 */
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 1200;
        background: var(--c-bg);
        display: flex;
        flex-direction: column;
        /* 키보드가 덮은 높이를 padding 으로 받아내므로 테두리 상자 기준이어야 한다 */
        box-sizing: border-box;
        animation: cmpUp 0.24s cubic-bezier(0.22, 1, 0.36, 1);
      }
      /* 배경까지 반투명해지면 뒤 화면이 비친다 → 불투명하게 두고 살짝 올라오기만 한다 */
      @keyframes cmpUp { from { transform: translateY(24px); } to { transform: translateY(0); } }
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
      .cmp-attach { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 12px; margin-top: 14px; }
      .cmp-attach-btn { border: none; background: none; padding: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
      .cmp-attach-btn:disabled { opacity: 0.5; }
      .cmp-attach-btn { width: 40px; height: 40px; border-radius: 999px; }
      .cmp-attach-btn img { width: 26px; height: 26px; display: block; }
      .cmp-gif { font-size: 12px; font-weight: 800; color: var(--c-text-4); border: 2px solid var(--c-text-4) !important; border-radius: 7px; width: 30px; height: 21px; opacity: 0.7; }
      /* 투표 · OX퀴즈 · 문제 오류 · 블라인드 칩 — 아이콘 + 글자, 손가락으로 누르기 좋게 키운다 */
      .cmp-chip {
        display: inline-flex; align-items: center; gap: 6px;
        height: 40px; padding: 0 15px 0 12px;
        border: 1px solid var(--c-border); background: none; border-radius: 999px;
        font-size: 14px; font-weight: 700; color: var(--c-text-3); cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
      }
      .cmp-chip img { display: block; width: 20px; height: 20px; flex-shrink: 0; }
      .cmp-chip.is-on { background: var(--c-brand-soft-6); border-color: transparent; color: var(--c-brand); }
      .cmp-poll { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
      .cmp-poll-row { display: flex; align-items: center; gap: 8px; }
      .cmp-poll-input { flex: 1; height: 40px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-bg-muted); padding: 0 12px; font-size: 16px; color: var(--c-text); outline: none; box-sizing: border-box; }
      .cmp-poll-x { width: 28px; height: 28px; border: none; background: none; color: var(--c-text-5); font-size: 18px; cursor: pointer; flex-shrink: 0; }
      .cmp-poll-add { align-self: flex-start; border: none; background: none; padding: 2px 0; font-size: 13px; font-weight: 700; color: var(--c-brand); cursor: pointer; }
      /* 읽는 쪽(퀴즈 카드)과 같은 모양 — 박스 없이 문장 + 정사각 O/X */
      /* 커뮤니티(태블릿) 검색창과 같은 결 — 회색 면 → 포커스 시 흰 면 + 파란 테두리 */
      .cmp-qsearch {
        display: flex; align-items: center; gap: 8px;
        height: 44px; padding: 0 14px; border-radius: 14px;
        background: var(--c-bg-muted-2); border: 1px solid transparent;
        color: var(--c-text-4b); box-sizing: border-box;
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
      }
      .cmp-qsearch:focus-within { background: var(--c-bg); border-color: var(--c-brand); box-shadow: 0 0 0 3px rgba(55, 135, 255, 0.12); }
      .cmp-qsearch input {
        flex: 1; min-width: 0; border: none; background: none; outline: none;
        font-size: 15px; font-family: inherit; color: var(--c-text-b); letter-spacing: -0.2px;
      }
      .cmp-qsearch input::placeholder { color: var(--c-text-4b); }
      .cmp-qsearch button {
        display: flex; align-items: center; justify-content: center;
        width: 22px; height: 22px; border: none; border-radius: 999px;
        background: var(--c-bg-muted-3); color: var(--c-text-4); cursor: pointer; flex-shrink: 0;
      }
      .cmp-qpick { padding: 12px 16px 20px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
      .cmp-qpick-list { display: flex; flex-direction: column; gap: 8px; }
      .cmp-qpick-item { text-align: left; display: flex; flex-direction: column; gap: 3px; padding: 11px 13px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-bg); cursor: pointer; }
      .cmp-qpick-item.is-row { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; }
      .cmp-qpick-count { font-size: 12.5px; font-weight: 700; color: var(--c-text-5); flex-shrink: 0; }
      .cmp-qpick-label { margin: 6px 2px 0; font-size: 12.5px; font-weight: 800; color: var(--c-text-4); }
      .cmp-qpick-crumb { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; color: var(--c-text-5); }
      .cmp-qpick-crumb button { border: none; background: none; padding: 2px 0; font: inherit; color: var(--c-brand); cursor: pointer; }
      .cmp-qpick-crumb button.is-now { color: var(--c-text-3); cursor: default; }
      .cmp-qpick-set { font-size: 12px; font-weight: 700; color: var(--c-text-5); }
      .cmp-qpick-text { font-size: 14.5px; font-weight: 600; color: var(--c-text); line-height: 1.45; }
      .cmp-quiz { margin-top: 12px; display: flex; flex-direction: column; gap: 14px; }
      .cmp-quiz-row { display: flex; flex-direction: column; gap: 8px; }
      .cmp-quiz-top { display: flex; align-items: center; gap: 8px; }
      .cmp-quiz-input { flex: 1; min-width: 0; height: 42px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-bg-muted); padding: 0 13px; font-size: 16px; color: var(--c-text); outline: none; box-sizing: border-box; }
      .cmp-quiz-ox { display: flex; align-items: center; gap: 7px; }
      .cmp-quiz-label { font-size: 12.5px; font-weight: 600; color: var(--c-text-5); margin-left: 2px; }
      .cmp-quiz-ox-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 13px; border: none; cursor: pointer; flex-shrink: 0; }
      .cmp-quiz-ox-btn.is-o { background: var(--c-quiz-o-soft); color: var(--c-quiz-o); opacity: 0.45; }
      .cmp-quiz-ox-btn.is-x { background: var(--c-quiz-x-soft); color: var(--c-quiz-x); opacity: 0.45; }
      /* 고른 쪽만 또렷하게(카드에서 정답 칸을 보여주는 방식과 같다) */
      .cmp-quiz-ox-btn.is-on { opacity: 1; }
      .cmp-quiz-ox-btn.is-on.is-o { box-shadow: inset 0 0 0 2px var(--c-quiz-o-line); }
      .cmp-quiz-ox-btn.is-on.is-x { box-shadow: inset 0 0 0 2px var(--c-quiz-x-line); }
      .cmp-poll-hint { margin: 0; font-size: 12px; color: var(--c-text-5); font-weight: 500; }
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
        position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 10;
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
