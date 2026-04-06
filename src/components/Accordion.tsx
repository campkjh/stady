"use client";

import { useState } from "react";

interface AccordionItem {
  id: number;
  header: React.ReactNode;
  content: React.ReactNode;
}

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div style={{ padding: "0 20px" }}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              className="press"
              onClick={() => setOpenId(isOpen ? null : item.id)}
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
              <div style={{ flex: 1, minWidth: 0 }}>
                {item.header}
              </div>
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
                maxHeight: isOpen ? 200 : 0,
                transition: "max-height 0.3s ease",
              }}
            >
              {item.content}
            </div>
            <div style={{ height: 1, backgroundColor: "#F3F4F6" }} />
          </div>
        );
      })}
    </div>
  );
}
