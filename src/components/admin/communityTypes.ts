export interface CategoryGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  postCount?: number;
  tagCount?: number;
}

export interface CommunityTag {
  id: string;
  groupId: string;
  groupName?: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  postCount?: number;
}
