export type SupportIssueType =
  | 'training_access'
  | 'assessment_issue'
  | 'progress_issue'
  | 'certificate_issue'
  | 'account_login_issue'
  | 'technical_issue'
  | 'other';

export type SupportStatus = 'open' | 'in_progress' | 'closed';

export interface SupportMessage {
  id: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  issueType: SupportIssueType;
  message: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  adminResponse: string | null;
  respondedAt: string | null;
  respondedBy: number | null;
}

export function formatSupportDate(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${day} · ${time}`;
}

export const issueTypeLabels: Record<SupportIssueType, string> = {
  training_access: 'Training access',
  assessment_issue: 'Assessment issue',
  progress_issue: 'Progress issue',
  certificate_issue: 'Certificate issue',
  account_login_issue: 'Account / login issue',
  technical_issue: 'Technical issue',
  other: 'Other',
};

export const statusLabels: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
};
