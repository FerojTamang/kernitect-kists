const absoluteUrlPattern = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;

export function resolveApiUrl(url: string): string;
export function resolveApiUrl(url: null): null;
export function resolveApiUrl(url: string | null): string | null {
  if (!url || absoluteUrlPattern.test(url)) return url;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(
    /\/+$/,
    '',
  );
  return apiBaseUrl ? `${apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url;
}
