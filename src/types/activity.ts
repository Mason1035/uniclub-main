import type { MongoEvent } from '../utils/eventTransform';

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type MemberFilter = 'all' | 'registered' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'unregistered';
export interface ActivityPagination { page: number; limit: number; total: number; pages: number }
export interface ActivityStats { totalMembers: number; registered: number; pending: number; approved: number; rejected: number; cancelled: number; unregistered: number }
export interface ActivityRegistration {
  id: string; userId: string; name: string; status: RegistrationStatus; version: number;
  createdAt: string; updatedAt: string; reviewedBy?: string | null; reviewedAt?: string | null;
  reviewNote?: string | null; legacyStatus?: string | null;
}
export interface ActivityMember {
  id: string; userId: string | null; name: string; avatar?: string | null; uniqueId?: string;
  status: RegistrationStatus | 'UNREGISTERED'; registration: ActivityRegistration | null;
}
export interface ActivityList { events: MongoEvent[]; pagination: ActivityPagination; years?: number[]; types?: Array<string | { value: string; label: string }> }
export interface ActivityDetail { event: MongoEvent; stats?: ActivityStats }
export interface RegistrationList { members: ActivityMember[]; stats: ActivityStats; pagination: ActivityPagination }
export interface ReviewResult { userId: string; success: boolean; error?: string; code?: string; rsvp?: ActivityRegistration }
export interface ActivityMedia {
  id: string; type: 'COVER' | 'PHOTO'; thumbnailUrl: string; url: string; caption?: string;
  width?: number; height?: number; sortOrder: number;
  expiresAt?: string;
}
export interface ActivityMediaList { media: ActivityMedia[]; pagination: ActivityPagination; version: number }
export interface ActivityUpload { upload: { id: string; url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string } }
