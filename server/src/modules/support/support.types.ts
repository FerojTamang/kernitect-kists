export const supportIssueTypes = [
  'training_access',
  'assessment_issue',
  'progress_issue',
  'certificate_issue',
  'account_login_issue',
  'technical_issue',
  'other',
] as const;

export const supportStatuses = ['open', 'in_progress', 'closed'] as const;

export type SupportIssueType = (typeof supportIssueTypes)[number];
export type SupportStatus = (typeof supportStatuses)[number];
