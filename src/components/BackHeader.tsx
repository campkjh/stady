"use client";

import { useRouter } from "next/navigation";

export default function BackHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          flexShrink: 0,
          background: "none",
          border: "none",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>
        {title}
      </h1>
    </div>
  );
}
