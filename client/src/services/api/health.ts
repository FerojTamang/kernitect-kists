export interface HealthResponse {
  status: 'ok';
  service: 'KISTS API';
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok)
    throw new Error(`Health request failed (${response.status})`);
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('status' in data) ||
    data.status !== 'ok' ||
    !('service' in data) ||
    data.service !== 'KISTS API'
  ) {
    throw new Error('Unexpected health response');
  }
  return { status: data.status, service: data.service };
}
