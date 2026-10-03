export interface QuantificationCollection {
  id: string;
  title: string;
  description: string;
  startAt: string | null;
  deadline: string | null;
  status: 'draft' | 'open' | 'closed';
  availability: 'draft' | 'scheduled' | 'open' | 'closed';
  createdAt: string;
}
export interface QuantificationSubmission {
  id: string;
  collectionId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  status: 'submitted';
  version: number;
  submittedAt: string;
}
export interface QuantificationUpload {
  id: string;
  originalFilename: string;
  fileSize: number;
  state: 'pending' | 'confirming' | 'confirmed' | 'aborted' | 'expired';
  expiresAt: string;
}
export interface CosUploadCredentials {
  TmpSecretId: string;
  TmpSecretKey: string;
  SecurityToken: string;
  StartTime: number;
  ExpiredTime: number;
  ScopeLimit: boolean;
}
export interface SignedUploadCredentials { mode: 'signed'; StartTime: number; ExpiredTime: number; ScopeLimit: true }
export type UploadCredentials = CosUploadCredentials | SignedUploadCredentials;
export interface UploadAuthorization { url: string; headers: Record<string, string>; expiresAt: string }
export interface UploadSession {
  upload: QuantificationUpload;
  target: { provider: 'cos'; endpoint?: string; bucket: string; region: string; key: string; multipartId: string; partBytes: number };
  credentials: UploadCredentials;
}
export interface CollectionList {
  collections: QuantificationCollection[];
  storage: { provider: string; configured: boolean };
  limits: { maxFileBytes: number; partBytes: number };
}
export interface SubmissionState {
  collection: QuantificationCollection;
  submission: QuantificationSubmission | null;
  pendingUpload: QuantificationUpload | null;
}
export interface DownloadLink { submissionId: string; originalFilename: string; url: string; expiresAt: string }
export interface DownloadLinks { links: DownloadLink[]; errors: { submissionId: string; error: string }[] }
export interface SubmissionOverview {
  collection: QuantificationCollection;
  rows: { id: string; name: string; studentId: string; registered: boolean; outsideRoster: boolean; submission: QuantificationSubmission | null }[];
  summary: { total: number; submitted: number; missing: number; outsideRoster: number };
  pagination: { page: number; pages: number; limit: number; total: number };
}
export interface CollectionInput { title: string; description: string; startAt: string | null; deadline: string | null; status: 'draft' | 'open' | 'closed' }

export interface StorageConfiguration {
  revision: string; mode: 'cos' | 'scf'; bucket: string; region: string; endpoint: string;
  directoryPrefix: string; tokenEndpoint: string; functionUrl: string;
  updatedAt: string | null;
}
export interface StorageConfigurationInput {
  revision: string; bucket: string; region: string; endpoint: string; directoryPrefix: string;
  tokenEndpoint: string; functionUrl: string;
}

export interface StorageMaterial {
  key: string; name: string; size: number; lastModified: string; legacyPath: boolean; pending: boolean;
}
export interface StorageMaterialList {
  prefix: string; count: number; files: StorageMaterial[]; retainedCopies: number; refreshedAt: string;
}
