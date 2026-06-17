import type { Metadata } from "next";
import CommunityClient from "@/components/CommunityClient";

export const metadata: Metadata = {
  title: "스타디 커뮤니티",
  description: "관리자에서 설정한 카테고리와 태그가 반영되는 스타디 커뮤니티입니다.",
  openGraph: {
    title: "스타디 커뮤니티",
    description: "입시, 학습, 생활, 자료 등 카테고리와 태그 기반 커뮤니티",
  },
};

export default function CommunityPage() {
  return <CommunityClient />;
}
