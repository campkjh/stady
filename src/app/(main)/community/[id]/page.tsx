import type { Metadata } from "next";
import CommunityPostDetailClient from "@/components/CommunityPostDetailClient";

export const metadata: Metadata = {
  title: "커뮤니티 게시글",
  description: "스타디 커뮤니티 게시글 상세 페이지입니다.",
};

export default async function CommunityPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommunityPostDetailClient postId={id} />;
}
