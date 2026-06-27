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
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M21.0688 8.20407L12.6218 1.48707C12.4451 1.34623 12.2258 1.26953 11.9998 1.26953C11.7738 1.26953 11.5545 1.34623 11.3778 1.48707L2.9298 8.20407C2.69436 8.39135 2.50419 8.62933 2.37347 8.90029C2.24275 9.17126 2.17484 9.46822 2.1748 9.76907V19.1871C2.1748 19.8236 2.42766 20.434 2.87775 20.8841C3.32784 21.3342 3.93828 21.5871 4.5748 21.5871H9.9998V16.8351C9.9998 16.5699 10.1052 16.3155 10.2927 16.128C10.4802 15.9404 10.7346 15.8351 10.9998 15.8351H12.9998C13.265 15.8351 13.5194 15.9404 13.7069 16.128C13.8944 16.3155 13.9998 16.5699 13.9998 16.8351V21.5871H19.4238C20.0603 21.5871 20.6708 21.3342 21.1209 20.8841C21.5709 20.434 21.8238 19.8236 21.8238 19.1871V9.77007C21.8238 9.46922 21.7559 9.17226 21.6251 8.90129C21.4944 8.63033 21.3043 8.39135 21.0688 8.20407Z" fill={color}/>
      </svg>
    ),
  },
  {
    label: "책갈피",
    href: "/bookmarks",
    icon: (color: string) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M3.5 3.9998C3.5 3.2998 4 2.7998 4.7 2.7998H19.3C20 2.7998 20.5 3.2998 20.5 3.9998V21.1998C20.5 21.6998 20 21.9998 19.6 21.6998L12.6 17.6998C12.2 17.4998 11.8 17.4998 11.4 17.6998L4.4 21.6998C4 21.8998 3.5 21.5998 3.5 21.1998V3.9998Z" fill={color}/>
      </svg>
    ),
  },
  {
    label: "마이홈",
    href: "/mypage",
    icon: (color: string) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M16.8872 6.64352C16.8872 7.28634 16.7607 7.92288 16.5148 8.5168C16.2688 9.11071 15.9083 9.65037 15.4538 10.105C14.9993 10.5595 14.4597 10.9202 13.8659 11.1662C13.272 11.4123 12.6355 11.539 11.9927 11.539C10.6944 11.5392 9.44932 11.0236 8.53124 10.1057C7.61315 9.18777 7.0973 7.94276 7.09717 6.64452C7.09711 6.0017 7.22365 5.36516 7.46959 4.77125C7.71553 4.17734 8.07603 3.63768 8.53053 3.18309C9.44843 2.265 10.6934 1.74916 11.9917 1.74902C13.2899 1.74889 14.535 2.26449 15.4531 3.18238C16.3712 4.10028 16.887 5.34529 16.8872 6.64352ZM11.9922 13.0365C4.94317 13.0365 2.20117 17.5225 2.20117 19.6095C2.20117 21.6955 8.03817 22.2515 11.9922 22.2515C15.9462 22.2515 21.7832 21.6955 21.7832 19.6095C21.7832 17.5225 19.0412 13.0365 11.9922 13.0365Z" fill={color}/>
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
        maxWidth: 720,
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
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M13.2578 16.9901C12.8778 17.2098 12.4467 17.3253 12.0078 17.3251C11.569 17.3259 11.1377 17.2106 10.7578 16.9911L4.34277 13.2871V17.1891C4.34277 17.5461 4.53277 17.8761 4.84277 18.0541L11.5078 21.9031C11.8178 22.0811 12.1978 22.0811 12.5078 21.9031L19.1728 18.0531C19.4828 17.8761 19.6728 17.5461 19.6728 17.1891V13.2871L13.2578 16.9901Z" fill={isActive("/community") ? ACTIVE_COLOR : INACTIVE_COLOR}/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M23.0529 7.87195L12.5069 1.78195C12.3548 1.69447 12.1823 1.64844 12.0069 1.64844C11.8314 1.64844 11.659 1.69447 11.5069 1.78195L0.96187 7.87195C0.809863 7.95972 0.683636 8.08596 0.595876 8.23797C0.508116 8.38999 0.461914 8.56242 0.461914 8.73795C0.461914 8.91348 0.508116 9.08591 0.595876 9.23793C0.683636 9.38994 0.809863 9.51618 0.96187 9.60395L11.5089 15.6919C11.6608 15.7799 11.8333 15.8262 12.0089 15.8262C12.1844 15.8262 12.3569 15.7799 12.5089 15.6919L20.9069 10.8439V15.1329H22.4069V9.97695L23.0549 9.60295C23.2069 9.51518 23.3331 9.38894 23.4209 9.23693C23.5086 9.08491 23.5548 8.91248 23.5548 8.73695C23.5548 8.56142 23.5086 8.38899 23.4209 8.23697C23.3331 8.08496 23.2069 7.95872 23.0549 7.87095" fill={isActive("/community") ? ACTIVE_COLOR : INACTIVE_COLOR}/>
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
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M19.999 5.99885C20.223 7.61185 20.05 8.72985 18.82 8.72985C17.031 8.72985 17.031 4.85285 14.01 2.73385C10.99 0.514851 8.86502 1.01885 8.75202 1.12085C11.213 3.03785 9.87102 6.10785 8.19302 6.91485C6.62702 7.72185 4.81802 6.63685 5.71302 4.21685C3.35202 6.26285 1.99902 8.72685 1.99902 12.0009C1.99902 17.5069 6.51502 22.0009 11.996 22.0009C17.999 22.0009 21.999 17.0009 21.999 12.0009C21.999 10.0009 21.471 8.00085 20 5.99985L19.999 5.99885ZM11.996 20.9329C9.77702 20.9329 8.06202 19.2179 8.06202 16.9989C8.06202 13.7719 11.996 11.5529 11.996 11.5529C11.996 11.5529 15.93 13.7719 15.93 16.9989C15.93 19.1159 14.215 20.9329 11.996 20.9329Z" fill={isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR}/>
                    <path opacity="0.5" d="M11.9999 11.5537C11.9999 11.5537 8.06592 13.7727 8.06592 16.9997C8.06592 19.2187 9.78092 20.9337 11.9999 20.9337C14.2189 20.9337 15.9339 19.1187 15.9339 16.9997C15.9339 13.7727 11.9999 11.5537 11.9999 11.5537Z" fill={isActive("/timer") ? ACTIVE_COLOR : INACTIVE_COLOR}/>
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
