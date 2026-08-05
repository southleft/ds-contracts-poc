import type { DurableObjectStateLite } from './env';

interface ReservationRequest {
  reservation: number;
  budget: number;
}

interface ReservationResult {
  admitted: boolean;
  used: number;
}

const USED_KEY = 'used';

/**
 * One instance is addressed per UTC day. Durable Object storage transactions
 * serialize concurrent reservations, so admitted totals cannot exceed budget.
 */
export class BudgetCoordinator {
  constructor(private readonly state: DurableObjectStateLite) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405 });
    }

    let body: ReservationRequest;
    try {
      body = (await request.json()) as ReservationRequest;
    } catch {
      return Response.json({ error: 'invalid reservation' }, { status: 400 });
    }

    const reservation =
      Number.isSafeInteger(body.reservation) && body.reservation > 0
        ? body.reservation
        : 0;
    const budget =
      Number.isSafeInteger(body.budget) && body.budget >= 0 ? body.budget : -1;
    if (reservation === 0 || budget < 0) {
      return Response.json({ error: 'invalid reservation' }, { status: 400 });
    }

    const result = await this.state.storage.transaction<ReservationResult>(
      async (txn) => {
        const stored = await txn.get<number>(USED_KEY);
        const used =
          Number.isSafeInteger(stored) && (stored as number) >= 0
            ? (stored as number)
            : 0;
        if (used + reservation > budget) return { admitted: false, used };
        const next = used + reservation;
        await txn.put(USED_KEY, next);
        return { admitted: true, used: next };
      },
    );

    return Response.json(result);
  }
}
