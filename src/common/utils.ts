import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from './constant';

/**
 * Equal split with leftover paise going to first members (one each).
 * e.g. 1000 / 3 => [334, 333, 333]
 */
export function equalSplit(totalPaise: number, count: number): number[] {
  const base = Math.floor(totalPaise / count);
  const leftover = totalPaise - base * count;
  return Array.from({ length: count }, (_, i) => (i < leftover ? base + 1 : base));
}

/**
 * Convert percentage to paise share.
 * Final element gets remainder to avoid rounding drift.
 */
export function percentToShares(totalPaise: number, percents: number[]): number[] {
  const shares = percents.map((p) => Math.floor((totalPaise * p) / 100));
  const allocated = shares.reduce((a, b) => a + b, 0);
  const remainder = totalPaise - allocated;
  if (shares.length > 0) shares[shares.length - 1] += remainder;
  return shares;
}

export function parsePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  return { page, limit, skip: (page - 1) * limit };
}
