"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE_COLOR = "#3787FF";
const INACTIVE_COLOR = "#2B313D";

const tabs = [
  {
    label: "홈",
    href: "/",
    icon: (color: string) => (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <path d="M13.8467 8.13878C14.5381 7.65068 15.4619 7.65068 16.1533 8.13878L21.5586 11.9542C22.0894 12.329 22.4053 12.9382 22.4053 13.588V20.6769C22.4052 21.7814 21.5098 22.6769 20.4053 22.6769H17.6354C17.4144 22.6769 17.2354 22.4978 17.2354 22.2769V18.5515C17.2354 18.3306 17.0563 18.1515 16.8354 18.1515H13.1646C12.9437 18.1515 12.7646 18.3306 12.7646 18.5515V22.2769C12.7646 22.4978 12.5856 22.6769 12.3646 22.6769H9.59473C8.4902 22.6769 7.5948 21.7814 7.59473 20.6769V13.588C7.59473 12.9382 7.91057 12.329 8.44141 11.9542L13.8467 8.13878Z" fill={color}/>
      </svg>
    ),
  },
  {
    label: "검색",
    href: "/search",
    icon: (color: string) => (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <circle cx="13.8173" cy="13.8173" r="6.24392" stroke={color} strokeWidth="1.8"/>
        <path d="M18.8291 18.8296L23.3266 23.327" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "책갈피",
    href: "/bookmarks",
    icon: (color: string) => (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <path d="M7.33325 7.63221C7.33325 6.73104 8.00454 6 8.83325 6H20.8333C21.6614 6 22.3333 6.73046 22.3333 7.63221V22.9103C22.3333 23.7481 21.4997 24.2713 20.8333 23.8526L15.5835 20.5546C15.1193 20.2631 14.5478 20.2631 14.0835 20.5546L8.83379 23.8526C8.1673 24.2713 7.33379 23.7481 7.33379 22.9103L7.33325 7.63221Z" fill={color}/>
      </svg>
    ),
  },
  {
    label: "마이홈",
    href: "/mypage",
    icon: (color: string) => (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="1.3" y="4.96992" width="27.4" height="20.06" rx="10.03" stroke={color} strokeWidth="1.6"/>
        <path d="M7.004 10.24H8.624L11.276 13.924L14.036 10.24H15.584V19H13.952V12.856L11.264 16.48L8.636 12.916V19H7.004V10.24ZM18.909 18.652L16.029 11.98H17.757L19.713 16.708L21.561 11.98H23.265L19.077 22.24H17.433L18.909 18.652Z" fill={color}/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      borderTop: "1px solid #E5E7EB",
      backgroundColor: "#fff",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <ul style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        height: 82,
        maxWidth: 500,
        margin: "0 auto",
        listStyle: "none",
        padding: 0,
      }}>
        {tabs.map((tab, tabIdx) => (
          <React.Fragment key={tab.href}>
            {/* Timer tab inserted after 검색 (index 1) */}
            {tabIdx === 2 && (
              <li>
                <Link
                  href="/timer"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    textDecoration: "none",
                    opacity: isActive("/timer") ? 1 : 0.44,
                  }}
                >
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                    <circle cx="15" cy="16.5" r="8" stroke={isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="1.8" fill="none" />
                    <path d="M15 12V16.5L18 18.5" stroke={isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M12.5 5.5H17.5" stroke={isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M15 5.5V8" stroke={isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 500, color: isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR }}>타이머</span>
                </Link>
              </li>
            )}
            <li>
              <Link
                href={tab.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  textDecoration: "none",
                  opacity: isActive(tab.href) ? 1 : 0.44,
                }}
              >
                {tab.icon(isActive(tab.href) ? ACTIVE_COLOR : INACTIVE_COLOR)}
                <span style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: isActive(tab.href) ? ACTIVE_COLOR : INACTIVE_COLOR,
                }}>
                  {tab.label}
                </span>
              </Link>
            </li>
          </React.Fragment>
        ))}
      </ul>
    </nav>
    </>
  );
}
