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
