import type { JobView } from '@domain/api';

export class ApiError extends Error {
  constructor(message: string, readonly field?: 'url' | 'market', readonly status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('Cannot reach the grader. Check your connection and try again.');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; field?: 'url' | 'market' };
  if (!res.ok) throw new ApiError(body.error ?? 'Something went wrong. Please try again.', body.field, res.status);
  return body as T;
}

export const startScan = (url: string, market: string): Promise<{ id: string }> =>
  request('/api/scans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, market }) });

export const fetchScan = (id: string): Promise<JobView> => request(`/api/scans/${id}`);
