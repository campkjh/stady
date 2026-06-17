"use client";

import { ReactNode, useState } from "react";

interface ReorderableListProps<T extends { id: string }> {
  items: T[];
  selectedId?: string | null;
  onSelect?: (item: T) => void;
  onChange: (items: T[]) => void;
  renderItem: (item: T) => ReactNode;
}

export default function ReorderableList<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  onChange,
  renderItem,
}: ReorderableListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onChange(next.map((item, index) => ({ ...item, sortOrder: index })));
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((item, index) => {
        const active = selectedId === item.id;
        return (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDraggingId(item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              const from = items.findIndex((candidate) => candidate.id === draggingId);
              move(from, index);
              setDraggingId(null);
            }}
            onDragEnd={() => setDraggingId(null)}
            onClick={() => onSelect?.(item)}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr auto",
              alignItems: "center",
              gap: 8,
              border: `1px solid ${active ? "#3787FF" : "#E5E7EB"}`,
              borderRadius: 8,
              background: active ? "#EFF6FF" : "#fff",
              padding: 10,
              cursor: "pointer",
            }}
          >
            <span
              aria-label="드래그 정렬"
              title="드래그해서 순서 변경"
              style={{ color: "#9CA3AF", fontSize: 18, lineHeight: 1, cursor: "grab", textAlign: "center" }}
            >
              =
            </span>
            <div style={{ minWidth: 0 }}>{renderItem(item)}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  move(index, index - 1);
                }}
                disabled={index === 0}
                aria-label="위로 이동"
                title="위로 이동"
                style={smallButtonStyle}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  move(index, index + 1);
                }}
                disabled={index === items.length - 1}
                aria-label="아래로 이동"
                title="아래로 이동"
                style={smallButtonStyle}
              >
                ↓
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const smallButtonStyle = {
  width: 28,
  height: 28,
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  background: "#fff",
  color: "#374151",
  fontWeight: 800,
  cursor: "pointer",
} as const;
