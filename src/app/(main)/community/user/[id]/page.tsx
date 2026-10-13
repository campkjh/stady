import type { Metadata } from "next";
import CommunityUserProfileClient from "@/components/CommunityUserProfileClient";

export const metadata: Metadata = {
  title: "커뮤니티 프로필",
  description: "스타디 커뮤니티 사용자 프로필입니다.",
};

export default async function CommunityUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommunityUserProfileClient userId={id} />;
}
