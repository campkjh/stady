"use client";

import ReorderableList from "./ReorderableList";
import { CategoryGroup } from "./communityTypes";

interface CategoryGroupTableProps {
  groups: CategoryGroup[];
  selectedId?: string | null;
  onSelect: (group: CategoryGroup) => void;
  onReorder: (groups: CategoryGroup[]) => void;
}

export default function CategoryGroupTable({ groups, selectedId, onSelect, onReorder }: CategoryGroupTableProps) {
  return (
    <ReorderableList
      items={groups}
      selectedId={selectedId}
      onSelect={onSelect}
      onChange={onReorder}
      renderItem={(group) => (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ color: "#111827", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.name}
            </strong>
            <span style={{ color: group.isActive ? "#047857" : "#6B7280", fontSize: 11, fontWeight: 800 }}>
              {group.isActive ? "노출" : "비노출"}
            </span>
          </div>
          <span style={{ color: "#8A909C", fontSize: 12 }}>/{group.slug} · 태그 {group.tagCount || 0} · 게시글 {group.postCount || 0}</span>
        </div>
      )}
    />
  );
}
