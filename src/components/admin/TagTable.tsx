"use client";

import ReorderableList from "./ReorderableList";
import { CommunityTag } from "./communityTypes";

interface TagTableProps {
  tags: CommunityTag[];
  selectedId?: string | null;
  onSelect: (tag: CommunityTag) => void;
  onReorder: (tags: CommunityTag[]) => void;
}

export default function TagTable({ tags, selectedId, onSelect, onReorder }: TagTableProps) {
  return (
    <ReorderableList
      items={tags}
      selectedId={selectedId}
      onSelect={onSelect}
      onChange={onReorder}
      renderItem={(tag) => (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ color: "#111827", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tag.name}
            </strong>
            <span style={{ color: tag.isActive ? "#047857" : "#6B7280", fontSize: 11, fontWeight: 800 }}>
              {tag.isActive ? "노출" : "비노출"}
            </span>
          </div>
          <span style={{ color: "#8A909C", fontSize: 12 }}>/{tag.slug} · 게시글 {tag.postCount || 0}</span>
        </div>
      )}
    />
  );
}
