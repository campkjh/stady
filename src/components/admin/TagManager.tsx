"use client";

import { useEffect, useMemo, useState } from "react";
import DeleteConfirmModal from "./DeleteConfirmModal";
import TagForm from "./TagForm";
import TagTable from "./TagTable";
import { CategoryGroup, CommunityTag } from "./communityTypes";

type Filter = "all" | "active" | "inactive";

function makeEmptyTag(groupId: string, sortOrder: number): CommunityTag {
  return {
    id: "new",
    groupId,
    name: "",
    slug: "",
    description: "",
    isActive: true,
    sortOrder,
    postCount: 0,
  };
}

export default function TagManager() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommunityTag | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function loadGroups() {
    const response = await fetch("/api/admin/category-groups", { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "카테고리를 불러오지 못했습니다.");
    setGroups(data.groups || []);
    const firstGroupId = selectedGroupId || data.groups?.[0]?.id || "";
    setSelectedGroupId(firstGroupId);
    return firstGroupId;
  }

  async function loadTags(groupId = selectedGroupId) {
    if (!groupId) {
      setTags([]);
      setDraft(null);
      setSelectedId(null);
      return;
    }
    const response = await fetch(`/api/admin/tags?groupId=${encodeURIComponent(groupId)}`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "태그를 불러오지 못했습니다.");
    setTags(data.tags || []);
    const next = data.tags?.[0] || null;
    setSelectedId(next?.id || null);
    setDraft(next);
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        const groupId = await loadGroups();
        await loadTags(groupId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "태그 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setMessage("");
    setLoading(true);
    try {
      await loadTags(groupId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "태그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const filteredTags = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tags
      .filter((tag) => {
        if (filter === "active" && !tag.isActive) return false;
        if (filter === "inactive" && tag.isActive) return false;
        if (!keyword) return true;
        return `${tag.name} ${tag.slug} ${tag.description}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [filter, search, tags]);

  function addTag() {
    if (!selectedGroupId) return;
    const next = makeEmptyTag(selectedGroupId, tags.length);
    setSelectedId("new");
    setDraft(next);
    setMessage("");
  }

  function selectTag(tag: CommunityTag) {
    setSelectedId(tag.id);
    setDraft(tag);
    setMessage("");
  }

  async function saveTag() {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const isNew = draft.id === "new";
      const response = await fetch(isNew ? "/api/admin/tags" : `/api/admin/tags/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setSelectedGroupId(draft.groupId);
      const nextTags = data.tags || [];
      setTags(nextTags);
      const nextId = data.id || draft.id;
      setSelectedId(nextId);
      setDraft(nextTags.find((tag: CommunityTag) => tag.id === nextId) || null);
      setMessage("저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTag() {
    if (!draft || draft.id === "new") {
      setDeleteOpen(false);
      setDraft(null);
      setSelectedId(null);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/tags/${draft.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "삭제하지 못했습니다.");
      await loadTags(selectedGroupId);
      setMessage(data.deactivated ? "연결된 게시글이 있어 비활성화 처리했습니다." : "삭제되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  }

  function reorderVisible(nextVisible: CommunityTag[]) {
    const visibleIds = new Set(filteredTags.map((tag) => tag.id));
    const hidden = tags.filter((tag) => !visibleIds.has(tag.id));
    const merged = [...nextVisible, ...hidden].map((tag, index) => ({ ...tag, sortOrder: index }));
    setTags(merged);
    if (draft) {
      const changedDraft = merged.find((tag) => tag.id === draft.id);
      if (changedDraft) setDraft(changedDraft);
    }
  }

  async function saveOrder() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tags/reorder", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroupId,
          items: tags.map((tag, index) => ({ id: tag.id, sortOrder: index })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "순서를 저장하지 못했습니다.");
      setTags(data.tags || []);
      setMessage("정렬 순서가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "순서를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, color: "#111827", fontSize: 26, fontWeight: 900 }}>태그 관리</h1>
        <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: 14 }}>카테고리 안의 세부 태그를 동적으로 관리합니다.</p>
      </div>
      {message && (
        <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700 }}>
          {message}
        </div>
      )}
      <div className="tag-manager-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)", gap: 20 }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <strong style={{ color: "#111827", fontSize: 16 }}>태그 목록</strong>
            <button type="button" onClick={addTag} disabled={!selectedGroupId} style={secondaryButtonStyle}>태그 추가</button>
          </div>
          <select value={selectedGroupId} onChange={(event) => changeGroup(event.target.value)} style={inputStyle}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="검색" style={inputStyle} />
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} style={inputStyle}>
            <option value="all">전체</option>
            <option value="active">노출</option>
            <option value="inactive">비노출</option>
          </select>
          {loading ? (
            <p style={{ color: "#6B7280", fontSize: 14 }}>불러오는 중...</p>
          ) : (
            <TagTable tags={filteredTags} selectedId={selectedId} onSelect={selectTag} onReorder={reorderVisible} />
          )}
          <button type="button" onClick={saveOrder} disabled={saving || !tags.length} style={primaryOutlineStyle}>
            정렬 저장
          </button>
        </div>
        <div style={panelStyle}>
          <strong style={{ color: "#111827", fontSize: 16 }}>상세 설정</strong>
          <TagForm
            tag={draft}
            groups={groups}
            saving={saving}
            onChange={(next) => setDraft(next)}
            onSave={saveTag}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .tag-manager-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <DeleteConfirmModal
        open={deleteOpen}
        title="태그 삭제"
        description="연결된 게시글이 있으면 실제 삭제 대신 비활성화됩니다. 계속 진행할까요?"
        confirmLabel="진행"
        onConfirm={deleteTag}
        onClose={() => setDeleteOpen(false)}
        loading={saving}
      />
    </section>
  );
}

const panelStyle = {
  display: "grid",
  alignContent: "start",
  gap: 14,
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  background: "#fff",
  padding: 18,
  minWidth: 0,
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "11px 12px",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
} as const;

const secondaryButtonStyle = {
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  background: "#fff",
  color: "#374151",
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const primaryOutlineStyle = {
  border: "1px solid #3787FF",
  borderRadius: 8,
  background: "#EFF6FF",
  color: "#1D4ED8",
  padding: "11px 14px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
} as const;
