"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE_COLOR = "#3787FF";
const INACTIVE_COLOR = "#2B313D";
const COMMUNITY_VISITED_KEY = "stady_community_visited";

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
  const [showCommunityTip, setShowCommunityTip] = useState(false);

  // Show the floating "새로운 커뮤니티" tooltip only to users who have never
  // opened the community. Visiting /community marks it as seen forever.
  useEffect(() => {
    const visited = localStorage.getItem(COMMUNITY_VISITED_KEY) === "true";
    const onCommunity = pathname.startsWith("/community");
    if (onCommunity && !visited) localStorage.setItem(COMMUNITY_VISITED_KEY, "true");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCommunityTip(!visited && !onCommunity);
  }, [pathname]);

  function markCommunityVisited() {
    localStorage.setItem(COMMUNITY_VISITED_KEY, "true");
    setShowCommunityTip(false);
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  if (pathname.startsWith("/community/write")) {
    return null;
  }

  return (
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
            {/* Community and timer tabs inserted after 홈 */}
            {tabIdx === 1 && (
              <>
              <li style={{ position: "relative" }}>
                {showCommunityTip && (
                  <div className="community-tip" aria-hidden="true">
                    <div className="community-tip-bubble">
                      <span className="community-tip-text">새로운 커뮤니티</span>
                    </div>
                    <svg className="community-tip-tail" width="39" height="12" viewBox="0 0 39 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M30.922 2.63L20.459 11C19.729 11.584 18.69 11.584 17.96 11L7.496 2.63C5.368 0.928001 2.725 0 0 0H38.418C35.693 0 33.05 0.928001 30.922 2.63Z" fill="white"/>
                    </svg>
                  </div>
                )}
                <Link
                  href="/community"
                  onClick={markCommunityVisited}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    textDecoration: "none",
                    opacity: isActive("/community") ? 1 : 0.44,
                  }}
                >
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                    <path d="M8 10.5C8 8.567 9.567 7 11.5 7H18.5C20.433 7 22 8.567 22 10.5V15.5C22 17.433 20.433 19 18.5 19H15.75L11.8 22.2C11.47 22.468 10.976 22.233 10.976 21.808V19H11.5C9.567 19 8 17.433 8 15.5V10.5Z" stroke={isActive("/community") ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="1.8" strokeLinejoin="round"/>
                    <path d="M12 12.5H18M12 15.5H15.5" stroke={isActive("/community") ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 500, color: isActive("/community") ? ACTIVE_COLOR : INACTIVE_COLOR }}>커뮤니티</span>
                </Link>
              </li>
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
              </>
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
      <style>{`
        .community-tip {
          position: absolute;
          left: 50%;
          bottom: calc(100% - 12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
          z-index: 60;
          will-change: transform;
          animation: communityTipFloat 2.6s ease-in-out infinite;
        }
        .community-tip-bubble {
          background: #fff;
          border-radius: 16px;
          padding: 7px 14px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16);
          white-space: nowrap;
        }
        .community-tip-text {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.2px;
          background: linear-gradient(110deg, #8B95A1 0%, #8B95A1 26%, #3182F6 42%, #333D4B 58%, #333D4B 100%);
          background-size: 230% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: communityTipText 2.8s ease-in-out infinite;
        }
        .community-tip-tail {
          margin-top: -1px;
          filter: drop-shadow(0 6px 4px rgba(15, 23, 42, 0.10));
        }
        @keyframes communityTipFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-5px); }
        }
        @keyframes communityTipText {
          0% { background-position: 150% 0; }
          100% { background-position: -50% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .community-tip { animation: none; transform: translateX(-50%); }
          .community-tip-text { animation: none; }
        }
      `}</style>
    </nav>
  );
}
