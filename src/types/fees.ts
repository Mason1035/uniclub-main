export type FeeStatus = 'SUBMITTED' | 'CONFIRMED';

export interface FeeSettings {
  hasPaymentQr: boolean;
  updatedAt: string | null;
}

export interface FeeUserReference {
  id: string;
  name: string;
  uniqueId: string;
}

export interface FeeSubmission {
  id: string;
  user: FeeUserReference | null;
  remark: string;
  status: FeeStatus;
  hasProof: boolean;
  confirmedBy: FeeUserReference | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeeSubmissionPage {
  submissions: FeeSubmission[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
