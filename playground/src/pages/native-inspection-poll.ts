interface Delivery {
  paired: boolean;
  started: boolean;
  finished: boolean;
}
interface ProgressRow {
  operation: { id: string; phase: string; pendingPhase?: string };
  connection: Delivery;
  content?: { phase: string };
  updates?: Array<{
    id: string;
    operation?: { phase: string; pendingPhase?: string } | null;
    connection?: Delivery;
  }>;
}

/** A delivery acknowledgement schedules polling; it supplies no verified view. */
export function nativeDeliveryPendingFromAcknowledgement(value: unknown, operationId: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'operationId,pending' ||
      !('operationId' in value) || value.operationId !== operationId ||
      !('pending' in value) || typeof value.pending !== 'boolean')
    throw Error('Native delivery acknowledgement unavailable. Refresh the saved inspection.');
  return value.pending;
}

interface ComparisonInspection {
  kind: string;
  caseId: string;
  ownershipId: string;
  parentOperationId?: string;
  sourceOperationId?: string;
  fileKey: string;
  operation: {id: string};
  connection: {paired: boolean; connected: boolean; started: boolean; finished: boolean};
}

/** Check the response identity; the host supplies the same verified row as its full listing. */
export function nativeComparisonInspectionFromResponse<T extends ComparisonInspection>(value: unknown, parentOperationId: string, caseId: string): T {
  const record = (input: unknown): input is Record<string, unknown> => !!input && typeof input === 'object' && !Array.isArray(input);
  const uuid = (input: unknown) => typeof input === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input);
  if (!record(value) || Object.keys(value).join(',') !== 'comparison' || !record(value.comparison))
    throw Error('Native comparison response unavailable. Refresh the saved inspection.');
  const row = value.comparison;
  if (row.kind !== 'comparison' || row.parentOperationId !== parentOperationId || row.caseId !== caseId ||
      !uuid(row.ownershipId) || !uuid(row.sourceOperationId) || typeof row.fileKey !== 'string' || !row.fileKey ||
      !record(row.operation) || !uuid(row.operation.id) || !record(row.connection) ||
      ['paired','connected','started','finished'].some(key => typeof (row.connection as Record<string, unknown>)[key] !== 'boolean'))
    throw Error('Native comparison response unavailable. Refresh the saved inspection.');
  return row as unknown as T;
}

interface NativeInspectionScope {
  referenceId: string;
  ownershipId: string | undefined;
}

/** A response from an older source or observation must not enter the active view. */
export function nativeInspectionScopeMatches(requested: NativeInspectionScope, active: NativeInspectionScope): boolean {
  return !!requested.ownershipId && requested.referenceId === active.referenceId && requested.ownershipId === active.ownershipId;
}

/** Keep the complete host-checked root row, including reported stale/refused state. */
export function nativeRootInspectionFromResponse<T extends ComparisonInspection>(value: unknown, caseId: string, ownershipId: string | undefined): T {
  const record = (input: unknown): input is Record<string, unknown> => !!input && typeof input === 'object' && !Array.isArray(input);
  const uuid = (input: unknown) => typeof input === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input);
  const unavailable = () => Error('Native root response unavailable. Refresh the saved inspection.');
  if (!uuid(ownershipId) || !record(value) || Object.keys(value).join(',') !== 'operation' || !record(value.operation)) throw unavailable();
  const row = value.operation;
  if (row.kind !== 'root' || row.caseId !== caseId || row.ownershipId !== ownershipId ||
      row.parentOperationId !== undefined || row.sourceOperationId !== undefined ||
      typeof row.fileKey !== 'string' || !row.fileKey || !record(row.operation) || !uuid(row.operation.id) ||
      typeof row.operation.phase !== 'string' || !row.operation.phase || typeof row.operation.sourceCurrent !== 'boolean' ||
      !Array.isArray(row.operation.problems) || !row.operation.problems.every(problem => typeof problem === 'string') ||
      !record(row.connection) || ['paired','connected','started','finished'].some(key => typeof (row.connection as Record<string, unknown>)[key] !== 'boolean')) throw unavailable();
  return row as unknown as T;
}

/** Keep one host-checked authored row without replacing unrelated inspections. */
export function nativeAuthoredInspectionFromResponse<T extends ComparisonInspection>(value: unknown, caseId: string, ownershipId: string | undefined): T {
  const record = (input: unknown): input is Record<string, unknown> => !!input && typeof input === 'object' && !Array.isArray(input);
  const uuid = (input: unknown) => typeof input === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input);
  const unavailable = () => Error('Native authored response unavailable. Refresh the saved inspection.');
  if (!uuid(ownershipId) || !record(value) || Object.keys(value).join(',') !== 'operations' ||
      !Array.isArray(value.operations) || value.operations.length !== 1 || !record(value.operations[0])) throw unavailable();
  const row = value.operations[0];
  if (row.kind !== 'authored' || row.caseId !== caseId || row.ownershipId !== ownershipId ||
      row.parentOperationId !== undefined || row.sourceOperationId !== undefined ||
      typeof row.fileKey !== 'string' || !row.fileKey || !record(row.operation) || !uuid(row.operation.id) ||
      typeof row.operation.phase !== 'string' || !row.operation.phase || typeof row.operation.sourceCurrent !== 'boolean' ||
      !Array.isArray(row.operation.problems) || !row.operation.problems.every(problem => typeof problem === 'string') ||
      !record(row.connection) || ['paired','connected','started','finished'].some(key => typeof (row.connection as Record<string, unknown>)[key] !== 'boolean')) throw unavailable();
  return row as unknown as T;
}

/** Replace only this checked child; keep unrelated rows and avoid duplicate entries on retry. */
export function mergeNativeComparisonInspection<T extends {operation:{id:string}}>(rows: T[], comparison: T): T[] {
  return rows.some(row => row.operation.id === comparison.operation.id)
    ? rows.map(row => row.operation.id === comparison.operation.id ? comparison : row)
    : [...rows, comparison];
}

/** An older full response cannot overwrite a later delivery acknowledgement. */
export async function readCurrentNativeInspection<T>(read: () => Promise<T>, currentRevision: () => number): Promise<{revision: number; value: T} | undefined> {
  const revision = currentRevision();
  try {
    const result = await read();
    return revision === currentRevision() ? {revision, value: result} : undefined;
  } catch (error) {
    if (revision !== currentRevision()) return undefined;
    throw error;
  }
}

/** null means source inspection needs the full listing; [] means idle. */
export function nativeProgressRoutes(rows: ProgressRow[]): string[] | null {
  if (rows.some(row => row.content?.phase === 'running')) return null;
  const routes: string[] = [];
  for (const row of rows) {
    const root = `native-operation/${row.operation.id}`;
    if (row.connection.paired && row.connection.started &&
        (!row.connection.finished || row.operation.pendingPhase)) routes.push(`${root}/progress`);
    for (const update of row.updates ?? []) {
      if (update.connection?.paired && update.connection.started &&
          (!update.connection.finished || update.operation?.pendingPhase ||
           ['awaiting-native-result', 'update-preflight-observed', 'update-applied'].includes(update.operation?.phase ?? '')))
        routes.push(`${root}/update/${update.id}/progress`);
    }
  }
  return routes;
}

/** Progress can defer a full read but can never supply its verified result. */
export async function nativePollNeedsRefresh(rows: ProgressRow[], read: (route: string) => Promise<unknown>, statusReadDue = false): Promise<boolean> {
  const routes = nativeProgressRoutes(rows);
  if (routes === null) return true;
  if (!routes.length) return false;
  // An interrupted command may remain pending forever. Periodic full reads
  // expose its recovery controls and fresh connection/source status.
  if (statusReadDue) return true;
  try {
    const results = await Promise.all(routes.map(read));
    // Missing, malformed, refused, or completed progress needs a fresh full read.
    return results.some(result => !result || typeof result !== 'object' || !('pending' in result) || result.pending !== true);
  } catch { return true; }
}
