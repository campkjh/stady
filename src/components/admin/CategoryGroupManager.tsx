"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryGroupForm from "./CategoryGroupForm";
import CategoryGroupTable from "./CategoryGroupTable";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { CategoryGroup } from "./communityTypes";

type Filter = "all" | "active" | "inactive";

const emptyGroup: CategoryGroup = {
  id: "new",
  name: "",
  slug: "",
  description: "",
  isActive: true,
  sortOrder: 0,
  postCount: 0,
  tagCount: 0,
};

export default function CategoryGroupManager() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryGroup | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/category-groups", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "카테고리 그룹을 불러오지 못했습니다.");
      setGroups(data.groups || []);
      if (!selectedId && data.groups?.[0]) {
        setSelectedId(data.groups[0].id);
        setDraft(data.groups[0]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리 그룹을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups
      .filter((group) => {
        if (filter === "active" && !group.isActive) return false;
        if (filter === "inactive" && group.isActive) return false;
        if (!keyword) return true;
        return `${group.name} ${group.slug} ${group.description}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [filter, groups, search]);

  function selectGroup(group: CategoryGroup) {
    setSelectedId(group.id);
    setDraft(group);
    setMessage("");
  }

  function addGroup() {
    const next = { ...emptyGroup, sortOrder: groups.length };
    setSelectedId("new");
    setDraft(next);
    setMessage("");
  }

  async function saveGroup() {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const isNew = draft.id === "new";
      const response = await fetch(isNew ? "/api/admin/category-groups" : `/api/admin/category-groups/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setGroups(data.groups || []);
      const nextId = data.id || draft.id;
      const nextDraft = (data.groups || []).find((group: CategoryGroup) => group.id === nextId) || null;
      setSelectedId(nextId);
      setDraft(nextDraft);
      setMessage("저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!draft || draft.id === "new") {
      setDeleteOpen(false);
      setDraft(null);
      setSelectedId(null);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/category-groups/${draft.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "삭제하지 못했습니다.");
      setGroups(data.groups || []);
      const next = data.groups?.[0] || null;
      setSelectedId(next?.id || null);
      setDraft(next);
      setMessage(data.deactivated ? "연결된 게시글이 있어 비활성화 처리했습니다." : "삭제되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  }

  function reorderVisible(nextVisible: CategoryGroup[]) {
    const visibleIds = new Set(filteredGroups.map((group) => group.id));
    const hidden = groups.filter((group) => !visibleIds.has(group.id));
    const merged = [...nextVisible, ...hidden].map((group, index) => ({ ...group, sortOrder: index }));
    setGroups(merged);
    if (draft) {
      const changedDraft = merged.find((group) => group.id === draft.id);
      if (changedDraft) setDraft(changedDraft);
    }
  }

  async function saveOrder() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/category-groups/reorder", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: groups.map((group, index) => ({ id: group.id, sortOrder: index })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "순서를 저장하지 못했습니다.");
      setGroups(data.groups || []);
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
        <h1 style={{ margin: 0, color: "#111827", fontSize: 26, fontWeight: 900 }}>카테고리 관리</h1>
        <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: 14 }}>커뮤니티 상위 카테고리 그룹을 동적으로 관리합니다.</p>
      </div>
      {message && (
        <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700 }}>
          {message}
        </div>
      )}
      <div className="category-manager-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)", gap: 20 }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <strong style={{ color: "#111827", fontSize: 16 }}>카테고리 그룹 목록</strong>
            <button type="button" onClick={addGroup} style={secondaryButtonStyle}>추가</button>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="검색"
            style={inputStyle}
          />
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} style={inputStyle}>
            <option value="all">전체</option>
            <option value="active">노출</option>
            <option value="inactive">비노출</option>
          </select>
          {loading ? (
            <p style={{ color: "#6B7280", fontSize: 14 }}>불러오는 중...</p>
          ) : (
            <CategoryGroupTable groups={filteredGroups} selectedId={selectedId} onSelect={selectGroup} onReorder={reorderVisible} />
          )}
          <button type="button" onClick={saveOrder} disabled={saving || !groups.length} style={primaryOutlineStyle}>
            정렬 저장
          </button>
        </div>
        <div style={panelStyle}>
          <strong style={{ color: "#111827", fontSize: 16 }}>상세 설정</strong>
          <CategoryGroupForm
            group={draft}
            saving={saving}
            onChange={(next) => setDraft(next)}
            onSave={saveGroup}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .category-manager-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <DeleteConfirmModal
        open={deleteOpen}
        title="카테고리 그룹 삭제"
        description="연결된 게시글이 있으면 실제 삭제 대신 비활성화됩니다. 계속 진행할까요?"
        confirmLabel="진행"
        onConfirm={deleteGroup}
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
