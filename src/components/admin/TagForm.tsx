"use client";

import StatusToggle from "./StatusToggle";
import { CategoryGroup, CommunityTag } from "./communityTypes";

interface TagFormProps {
  tag: CommunityTag | null;
  groups: CategoryGroup[];
  saving?: boolean;
  onChange: (tag: CommunityTag) => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function TagForm({ tag, groups, saving = false, onChange, onSave, onDelete }: TagFormProps) {
  if (!tag) {
    return (
      <div style={emptyStyle}>
        <strong>태그를 선택해주세요</strong>
        <span>왼쪽 목록에서 선택하거나 태그를 추가하면 상세 설정이 열립니다.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <label style={labelStyle}>
        이름
        <input value={tag.name} onChange={(event) => onChange({ ...tag, name: event.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        slug
        <input value={tag.slug} onChange={(event) => onChange({ ...tag, slug: event.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        설명
        <textarea
          value={tag.description}
          onChange={(event) => onChange({ ...tag, description: event.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </label>
      <label style={labelStyle}>
        소속 카테고리
        <select value={tag.groupId} onChange={(event) => onChange({ ...tag, groupId: event.target.value })} style={inputStyle}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>
        정렬 순서
        <input
          type="number"
          value={tag.sortOrder}
          onChange={(event) => onChange({ ...tag, sortOrder: Number(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: "#374151", fontSize: 13, fontWeight: 700 }}>노출 여부</span>
        <StatusToggle checked={tag.isActive} onChange={(checked) => onChange({ ...tag, isActive: checked })} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", paddingTop: 8 }}>
        <button type="button" onClick={onDelete} disabled={saving} style={dangerButtonStyle}>
          삭제 또는 비활성화
        </button>
        <button type="button" onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

const emptyStyle = {
  minHeight: 280,
  border: "1px dashed #D1D5DB",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "#6B7280",
  fontSize: 14,
  textAlign: "center",
  padding: 24,
} as const;

const labelStyle = {
  display: "grid",
  gap: 8,
  color: "#374151",
  fontSize: 13,
  fontWeight: 700,
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "11px 12px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
} as const;

const primaryButtonStyle = {
  border: "none",
  borderRadius: 8,
  background: "#3787FF",
  color: "#fff",
  padding: "11px 18px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const dangerButtonStyle = {
  border: "1px solid #FCA5A5",
  borderRadius: 8,
  background: "#FEF2F2",
  color: "#B91C1C",
  padding: "11px 14px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
} as const;
