"use client";

import { useEffect, useRef, useState } from "react";

interface AccordionItem {
  id: string | number;
  header: React.ReactNode;
  content: React.ReactNode;
}

function AccordionRow({
  item,
  isOpen,
  onToggle,
  autoScroll,
}: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
  autoScroll?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // 콘텐츠 실제 높이를 측정해 그만큼만 펼친다. 이미지가 뒤늦게 로드돼 높이가
  // 커져도 ResizeObserver로 다시 측정 → 잘림 없이 전체가 보인다.
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setContentHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 홈에서 특정 공지로 들어온 경우: 그 항목으로 스크롤(펼침 애니메이션 후).
  useEffect(() => {
    if (!autoScroll) return;
    const t = setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(t);
  }, [autoScroll]);

  return (
    <div ref={rootRef}>
      <button
        type="button"
        className="press"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 0",
          background: "none",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{item.header}</div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            marginLeft: 12,
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: isOpen ? contentHeight : 0,
          transition: "max-height 0.3s ease",
        }}
      >
        <div ref={innerRef}>{item.content}</div>
      </div>
      <div style={{ height: 1, backgroundColor: "#F3F4F6" }} />
    </div>
  );
}

export default function Accordion({
  items,
  defaultOpenId,
}: {
  items: AccordionItem[];
  defaultOpenId?: string | number | null;
}) {
  // 홈에서 특정 공지로 들어오면 그 항목을 처음부터 펼쳐 둔다.
  const [openId, setOpenId] = useState<string | number | null>(
    defaultOpenId != null && items.some((it) => it.id === defaultOpenId) ? defaultOpenId : null
  );

  return (
    <div style={{ padding: "0 20px" }}>
      {items.map((item) => (
        <AccordionRow
          key={item.id}
          item={item}
          isOpen={openId === item.id}
          autoScroll={defaultOpenId != null && item.id === defaultOpenId}
          onToggle={() => setOpenId(openId === item.id ? null : item.id)}
        />
      ))}
    </div>
  );
}
