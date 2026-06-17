"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CategoryGroup {
  id: string;
  name: string;
}

interface CommunityTag {
  id: string;
  groupId: string;
  name: string;
}

interface UploadedImage {
  url: string;
  name: string;
}

export default function CommunityWriteClient() {
  const router = useRouter();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [groupId, setGroupId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (!groupId) return;
    setTagIds([]);
    loadTags(groupId);
  }, [groupId]);

  async function loadGroups() {
    setLoading(true);
    try {
      const response = await fetch("/api/category-groups");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "카테고리를 불러오지 못했습니다.");
      const nextGroups = data.groups || [];
      setGroups(nextGroups);
      if (nextGroups[0]) setGroupId(nextGroups[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTags(nextGroupId: string) {
    try {
      const response = await fetch(`/api/tags?groupId=${encodeURIComponent(nextGroupId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "태그를 불러오지 못했습니다.");
      setTags(data.tags || []);
    } catch (error) {
      setTags([]);
      setMessage(error instanceof Error ? error.message : "태그를 불러오지 못했습니다.");
    }
  }

  function toggleTag(tagId: string) {
    setTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    if (uploadedImages.length + files.length > 5) {
      setMessage("이미지는 최대 5장까지 올릴 수 있습니다.");
      return;
    }

    setUploadingImages(true);
    setMessage("");
    try {
      const nextImages: UploadedImage[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error("이미지 파일만 업로드할 수 있습니다.");
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error("이미지는 10MB 이하만 업로드할 수 있습니다.");
        }

        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/community/uploads", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "이미지 업로드에 실패했습니다.");
        nextImages.push({ url: data.url, name: file.name });
      }
      setUploadedImages((current) => [...current, ...nextImages]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingImages(false);
    }
  }

  function removeImage(url: string) {
    setUploadedImages((current) => current.filter((image) => image.url !== url));
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPosting(true);
    setMessage("");
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title,
          content,
          tagIds,
          imageUrls: uploadedImages.map((image) => image.url),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글을 저장하지 못했습니다.");
      router.replace("/community");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시글을 저장하지 못했습니다.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="community-write-page">
      <div className="community-write-shell">
        <header className="community-write-topbar">
          <button
            type="button"
            onClick={() => router.push("/community")}
            aria-label="뒤로가기"
            className="community-back-button"
            style={backButtonStyle}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p className="community-write-eyebrow">STADY</p>
            <h1 style={{ margin: 0, color: "#111827", fontSize: 24, fontWeight: 900 }}>게시글 작성</h1>
          </div>
        </header>

        {message && (
          <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700 }}>
            {message}
          </div>
        )}

        <form onSubmit={submitPost} className="community-write-panel" style={panelStyle}>
          <label style={labelStyle}>
            카테고리
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)} style={inputStyle} disabled={loading}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#374151", fontSize: 14, fontWeight: 800 }}>태그</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tags.length === 0 ? (
                <span style={{ color: "#8A909C", fontSize: 14 }}>선택 가능한 활성 태그가 없습니다.</span>
              ) : (
                tags.map((tag) => (
                  <button key={tag.id} type="button" className="community-chip" onClick={() => toggleTag(tag.id)} style={tagChipStyle(tagIds.includes(tag.id))}>
                    #{tag.name}
                  </button>
                ))
              )}
            </div>
            <span style={{ color: "#8A909C", fontSize: 13 }}>태그는 여러 개 선택할 수 있으며, 1개 이상 선택을 권장합니다.</span>
          </div>

          <label style={labelStyle}>
            제목
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목" style={inputStyle} />
          </label>

          <label style={labelStyle}>
            내용
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="내용"
              rows={8}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
            />
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#374151", fontSize: 14, fontWeight: 800 }}>이미지</span>
              <label className="community-image-upload-button" style={{ ...imageUploadButtonStyle, position: "relative", overflow: "hidden" }}>
                {uploadingImages ? "업로드 중..." : "이미지 추가"}
                {/* WKWebView(iOS 앱)에서는 display:none 파일 input의 파일 선택창이
                    열리지 않는 이슈가 있어, 버튼 위에 투명 input을 덮어 탭이
                    input에 직접 닿게 한다. */}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={uploadImages}
                  disabled={uploadingImages || uploadedImages.length >= 5}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  }}
                />
              </label>
            </div>
            {uploadedImages.length > 0 && (
              <div className="community-image-preview-grid">
                {uploadedImages.map((image) => (
                  <div key={image.url} className="community-image-preview">
                    <img src={image.url} alt={image.name} />
                    <button type="button" onClick={() => removeImage(image.url)} aria-label="이미지 삭제">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="community-submit-button" disabled={posting || uploadingImages || !groupId || !title.trim() || !content.trim()} style={submitStyle}>
            {posting ? "등록 중..." : "게시글 등록"}
          </button>
        </form>
      </div>
      <style>{`
        .community-write-page {
          min-height: 100vh;
          background: #fff;
          color: #111827;
          padding: 0 16px 28px;
        }
        .community-write-shell {
          max-width: 720px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
          padding-top: calc(76px + env(safe-area-inset-top, 0px));
        }
        .community-write-topbar {
          position: fixed;
          top: 0;
          left: 50%;
          z-index: 80;
          width: min(100vw, 500px);
          max-width: 500px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          transform: translateX(-50%);
          padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 12px;
          background: rgba(255, 255, 255, 0.88);
          border-bottom: 1px solid rgba(229, 231, 235, 0.8);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .community-write-eyebrow {
          margin: 0 0 2px;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 900;
        }
        .community-back-button:hover {
          background: #F9FAFB !important;
          border-color: #D1D5DB !important;
          transform: translateX(-1px);
        }
        .community-back-button:active,
        .community-chip:active,
        .community-submit-button:active {
          transform: scale(0.97);
        }
        .community-chip {
          transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
        }
        .community-write-panel {
          margin-top: 14px;
          animation: communitySlideUp 0.22s ease both;
        }
        .community-submit-button {
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }
        .community-image-upload-button {
          transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
        }
        .community-image-upload-button:active {
          transform: scale(0.97);
        }
        .community-image-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .community-image-preview {
          position: relative;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid #EEF0F3;
          aspect-ratio: 1;
          background: #F9FAFB;
        }
        .community-image-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .community-image-preview button {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.78);
          color: #fff;
          font-size: 18px;
          line-height: 28px;
          cursor: pointer;
        }
        .community-submit-button:hover:not(:disabled) {
          box-shadow: 0 8px 18px rgba(55,135,255,0.24);
        }
        @keyframes communitySlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 900px) {
          .community-write-page {
            padding-left: 24px;
            padding-right: 24px;
          }
          .community-write-topbar {
            padding-left: 24px;
            padding-right: 24px;
          }
        }
      `}</style>
    </main>
  );
}

function tagChipStyle(active: boolean) {
  return {
    flex: "0 0 auto",
    border: `1px solid ${active ? "#9CA3AF" : "#E5E7EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#4B5563",
    padding: "8px 11px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    transition: "background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease",
  } as const;
}

const backButtonStyle = {
  width: 38,
  height: 38,
  border: "1px solid #E5E7EB",
  borderRadius: 999,
  background: "#fff",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "transform 0.16s ease, background 0.16s ease, border-color 0.16s ease",
} as const;

const panelStyle = {
  display: "grid",
  gap: 16,
  borderTop: "1px solid #EEF0F3",
  borderBottom: "1px solid #EEF0F3",
  borderRadius: 0,
  background: "transparent",
  padding: "18px 0",
} as const;

const labelStyle = {
  display: "grid",
  gap: 8,
  color: "#374151",
  fontSize: 14,
  fontWeight: 800,
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "12px 13px",
  color: "#111827",
  background: "#fff",
  fontSize: 16,
  boxSizing: "border-box",
} as const;

const imageUploadButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #E5E7EB",
  borderRadius: 999,
  background: "#fff",
  color: "#111827",
  padding: "9px 12px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
} as const;

const submitStyle = {
  border: "none",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  padding: "13px 14px",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  transition: "transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease",
} as const;
