import type { Metadata } from "next";
import CommunityWriteClient from "@/components/CommunityWriteClient";

export const metadata: Metadata = {
  title: "커뮤니티 게시글 작성",
  description: "스타디 커뮤니티 게시글 작성 페이지입니다.",
};

export default function CommunityWritePage() {
  return <CommunityWriteClient />;
}
