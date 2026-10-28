export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      ...options,
      credentials: 'include',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
      headers: {
        ...(options.body
          ? { 'Content-Type': 'application/json', 'X-KISTS-Request': '1' }
          : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      'We could not reach the training portal. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('kists:session-expired'));
    throw new ApiError(
      response.status,
      response.status >= 500
        ? 'The training portal is temporarily unavailable. Please try again shortly.'
        : data?.error?.message ||
            'The request could not be completed. Please try again.',
      data?.error?.code,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
