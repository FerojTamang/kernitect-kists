export function LoginIcon({
  name,
}: {
  name:
    | 'email'
    | 'lock'
    | 'eye'
    | 'eye-off'
    | 'book'
    | 'box'
    | 'shield'
    | 'chart'
    | 'arrow'
    | 'info';
}) {
  const paths = {
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    'eye-off': (
      <>
        <path d="m3 3 18 18M9 5.5A11 11 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3 4M6 6C3 8 2 12 2 12s3 7 10 7a11 11 0 0 0 5-1M10 10a3 3 0 0 0 4 4" />
      </>
    ),
    book: (
      <>
        <path d="M12 5v16M12 5C9 2 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-2-10 1Z" />
      </>
    ),
    box: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7m9 5v10" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    chart: (
      <>
        <path d="M3 21V12h5v9m0 0V7h5v14m0 0V3h6v18H3" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
  };
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
      {paths[name]}
    </svg>
  );
}
