import { isMainThread, parentPort } from 'worker_threads';

export interface DebtBalance {
  userId: string;
  net: number;
}

export interface DebtPayment {
  from: string;
  to: string;
  amount: number;
}

/** Above this many non-zero members the exact search is skipped (2^n states). */
const EXACT_LIMIT = 16;

/** Greedy matching of the biggest creditor with the biggest debtor: at most (n - 1) payments. */
function settleGroupGreedy(members: DebtBalance[]): DebtPayment[] {
  const creditors = members
    .filter((m) => m.net > 0)
    .map((m) => ({ ...m }))
    .sort((a, b) => b.net - a.net);
  const debtors = members
    .filter((m) => m.net < 0)
    .map((m) => ({ ...m }))
    .sort((a, b) => a.net - b.net);

  const payments: DebtPayment[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    if (!creditor || !debtor) break;
    const amount = Math.min(creditor.net, -debtor.net);
    payments.push({ from: debtor.userId, to: creditor.userId, amount });
    creditor.net -= amount;
    debtor.net += amount;
    if (creditor.net === 0) i++;
    if (debtor.net === 0) j++;
  }
  return payments;
}

/**
 * Splits members into the maximum number of disjoint zero-sum subsets.
 * A subset of size k can be cleared with k - 1 payments, so the total number of
 * payments is (members - subsets): maximising subsets minimises payments.
 */
function partitionIntoZeroSumGroups(members: DebtBalance[]): DebtBalance[][] {
  const n = members.length;
  const full = (1 << n) - 1;
  const sum = new Float64Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    const low = 31 - Math.clz32(mask & -mask);
    sum[mask] = (sum[mask & (mask - 1)] ?? 0) + (members[low]?.net ?? 0);
  }

  // dp[mask] = max number of zero-sum prefixes over all orderings of the members in mask.
  const dp = new Int16Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)] ?? 0);
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Walk back from the full set to recover one optimal ordering.
  const order: number[] = [];
  let mask = full;
  while (mask) {
    const want = (dp[mask] ?? 0) - (sum[mask] === 0 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) && (dp[mask ^ (1 << i)] ?? 0) === want) {
        order.push(i);
        mask ^= 1 << i;
        break;
      }
    }
  }
  order.reverse();

  // Cut the ordering wherever the running total returns to zero.
  const groups: DebtBalance[][] = [];
  let current: DebtBalance[] = [];
  let running = 0;
  for (const index of order) {
    const member = members[index];
    if (!member) continue;
    current.push(member);
    running += member.net;
    if (running === 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Fewest payments that clear every balance (net > 0 is owed money, net < 0 owes money).
 * Exact for groups of up to EXACT_LIMIT members with an open balance, greedy beyond that.
 */
export function simplifyDebts(balances: DebtBalance[]): DebtPayment[] {
  const open = balances.filter((b) => b.net !== 0);
  if (open.length === 0) return [];
  if (open.length > EXACT_LIMIT) return settleGroupGreedy(open);

  return partitionIntoZeroSumGroups(open).flatMap((group) => settleGroupGreedy(group));
}

if (!isMainThread && parentPort) {
  const port = parentPort;
  port.on('message', (message: { data: DebtBalance[] }) => {
    try {
      port.postMessage({ result: simplifyDebts(message.data) });
    } catch (err) {
      port.postMessage({ error: err instanceof Error ? err.message : 'simplifyDebts failed' });
    }
  });
}
