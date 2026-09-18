import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  Dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  'My Training': (
    <>
      <path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v6l6 4 6-4v-6M22 8v8" />
    </>
  ),
  Scenarios: (
    <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7m9 5v10" />
  ),
  Assessments: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 11h6M9 15h6M9 19h3" />
    </>
  ),
  Certificates: (
    <>
      <path d="M12 21H4V3h14v8M8 7h6M8 11h3" />
      <circle cx="17" cy="15" r="4" />
      <path d="m14 18-1 5 4-2 4 2-1-5" />
    </>
  ),
  Progress: <path d="M3 21V13h4v8m3 0V8h4v13m3 0V3h4v18H3" />,
  Resources: (
    <path d="M12 5v16M12 5C9 2 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-2-10 1Z" />
  ),
  Settings: (
    <>
      <path d="m9 3 1-1h4l1 3 3 1 3 1 1 4-2 2-1 3v3l-4 2-2-2h-3l-3 1-3-3 1-3-1-3-2-2 2-4 3 1 2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 12 3 3 7-7" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 22v-4a8 8 0 0 1 16 0v4M9 16l3 3 3-3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="17" rx="2" />
      <path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3M7 18h3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 8a3 3 0 1 1 5 2c-1 1-2 1-2 4M12 17v1" />
    </>
  ),
  bell: (
    <>
      <path d="M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3v-5M9 21h6M12 1v2" />
    </>
  ),
  arrow: <path d="M3 12h18m-6-6 6 6-6 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
};

export function DashboardIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.Resources}
    </svg>
  );
}
