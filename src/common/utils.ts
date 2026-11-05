import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from './constant';
import { Errors } from './errors';
import { SplitType } from '../enum/enum';

// ───────────────────────────── express helpers ─────────────────────────────

export type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

/** Forwards rejected promises / thrown errors to the Express error middleware. */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
}

// ───────────────────────────── zod helpers ─────────────────────────────

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');

export function idParams<K extends string>(...keys: K[]) {
  const shape = Object.fromEntries(keys.map((k) => [k, objectIdSchema])) as Record<K, typeof objectIdSchema>;
  return z.object(shape);
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export interface PaginationQuery {
  page: number;
  limit: number;
  order: 'asc' | 'desc';
}

// ───────────────────────────── money ─────────────────────────────

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
 * Convert percentages to paise shares using integer maths (basis points) and
 * the largest-remainder method, so the shares always add up to `totalPaise`.
 */
export function percentToShares(totalPaise: number, percents: number[]): number[] {
  const basisPoints = percents.map((p) => Math.round(p * 100));
  const exact = basisPoints.map((bp) => totalPaise * bp);
  const shares = exact.map((e) => Math.floor(e / 10000));
  const remainders = exact.map((e, i) => ({ i, rem: e % 10000 }));

  let leftover = totalPaise - shares.reduce((a, b) => a + b, 0);
  remainders.sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of remainders) {
    if (leftover <= 0) break;
    shares[i] = (shares[i] ?? 0) + 1;
    leftover--;
  }
  if (leftover > 0 && shares.length > 0) shares[shares.length - 1] = (shares[shares.length - 1] ?? 0) + leftover;
  return shares;
}

export function formatInr(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const rupees = Math.abs(paise) / 100;
  return `${sign}₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ───────────────────────────── split calculation ─────────────────────────────

export interface SplitInput {
  userId: string;
  share?: number;
  percent?: number;
}

export interface CalculatedSplit {
  userId: string;
  share: number;
}

function assertUnique(ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw Errors.validationError('A user can appear only once in an expense split');
  }
}

function assertMembers(ids: string[], memberIds: string[]): void {
  for (const id of ids) {
    if (!memberIds.includes(id)) throw Errors.notGroupMember(`User ${id} is not a member of this group`);
  }
}

/**
 * Turns the request payload of an expense into stored splits (always paise).
 * Pure function: no I/O, throws AppError on invalid input.
 */
export function calculateSplits(
  splitType: SplitType,
  amount: number,
  input: { participants?: string[]; splits?: SplitInput[] },
  memberIds: string[],
): CalculatedSplit[] {
  if (splitType === SplitType.EQUAL) {
    const participants = input.participants;
    if (!participants?.length) throw Errors.validationError('participants required for EQUAL split');
    assertUnique(participants);
    assertMembers(participants, memberIds);
    const shares = equalSplit(amount, participants.length);
    return participants.map((userId, i) => ({ userId, share: shares[i] ?? 0 }));
  }

  const splits = input.splits;
  if (!splits?.length) throw Errors.validationError(`splits required for ${splitType} split`);
  const ids = splits.map((s) => s.userId);
  assertUnique(ids);
  assertMembers(ids, memberIds);

  if (splitType === SplitType.EXACT) {
    if (splits.some((s) => s.share === undefined)) {
      throw Errors.validationError('every split needs a share for EXACT split');
    }
    const total = splits.reduce((sum, s) => sum + (s.share ?? 0), 0);
    if (total !== amount) throw Errors.splitTotalMismatch();
    return splits.map((s) => ({ userId: s.userId, share: s.share ?? 0 }));
  }

  // PERCENT
  if (splits.some((s) => s.percent === undefined)) {
    throw Errors.validationError('every split needs a percent for PERCENT split');
  }
  const percents = splits.map((s) => s.percent ?? 0);
  const totalBp = percents.reduce((sum, p) => sum + Math.round(p * 100), 0);
  if (totalBp !== 10000) throw Errors.splitTotalMismatch();
  const shares = percentToShares(amount, percents);
  return splits.map((s, i) => ({ userId: s.userId, share: shares[i] ?? 0 }));
}

// ───────────────────────────── balances ─────────────────────────────

export interface UserTotal {
  userId: string;
  total: number;
}

export interface BalanceInputs {
  expensePaid: UserTotal[];
  expenseOwed: UserTotal[];
  settlementPaid: UserTotal[];
  settlementReceived: UserTotal[];
}

/**
 * net = paid - shares + settlements paid - settlements received.
 * Positive: the member is owed money. Negative: the member owes money.
 *
 * A settlement "from -> to" reduces what `from` owes, so it raises `from`'s net
 * and lowers `to`'s net.
 */
export function computeNetBalances(input: BalanceInputs): Map<string, number> {
  const net = new Map<string, number>();
  const add = (userId: string, delta: number): void => {
    net.set(userId, (net.get(userId) ?? 0) + delta);
  };
  input.expensePaid.forEach((t) => add(t.userId, t.total));
  input.expenseOwed.forEach((t) => add(t.userId, -t.total));
  input.settlementPaid.forEach((t) => add(t.userId, t.total));
  input.settlementReceived.forEach((t) => add(t.userId, -t.total));
  return net;
}

// ───────────────────────────── pagination ─────────────────────────────

export function parsePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

// ───────────────────────────── misc ─────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
