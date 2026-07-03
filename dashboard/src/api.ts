/**
 * Client for the dev-server-only control API (see dashboard/vite.config.ts).
 *
 * The endpoints exist only while `npm run dashboard` (the Vite dev server) is
 * running — a static `vite build` deployment has no /api routes. Callers get
 * a typed `unavailable` result instead of an exception so every control can
 * degrade gracefully.
 */

export type RunTask = 'parity' | 'catalog' | 'eval';

export interface RunResult {
  task: string;
  exitCode: number;
  output: string;
}

export interface JudgeViolation {
  rule: string;
  detail: string;
}

export interface JudgeFileReport {
  file: string;
  elements: number;
  checks: number;
  violations: JudgeViolation[];
  score: number;
  adherent: boolean;
}

export interface JudgeResult {
  exitCode: number;
  output: string;
  report: { reports: JudgeFileReport[] };
}

export type ApiResponse<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export const UNAVAILABLE_NOTE =
  'available when running `npm run dashboard` (dev server)';

async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Network failure — no server behind the static build.
    return { status: 'unavailable' };
  }

  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  if (response.status === 404 || response.status === 405 || !isJson) {
    // Static hosting (vite build output) has no /api routes.
    return { status: 'unavailable' };
  }

  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    return { status: 'error', message: payload.error ?? `HTTP ${response.status}` };
  }
  return { status: 'ok', data: payload };
}

export function runTask(task: RunTask): Promise<ApiResponse<RunResult>> {
  return post<RunResult>('/api/run', { task });
}

export function judgeSource(source: string): Promise<ApiResponse<JudgeResult>> {
  return post<JudgeResult>('/api/judge', { source });
}
