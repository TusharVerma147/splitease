import { calculateSplits, computeNetBalances, equalSplit, formatInr, percentToShares, parsePagination } from './utils';
import { SplitType } from '../enum/enum';
import { AppError } from './errors';

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

describe('equalSplit', () => {
  test('divides evenly', () => {
    expect(equalSplit(1000, 4)).toEqual([250, 250, 250, 250]);
  });

  test('leftover paise go to the first members, one each (1000 / 3)', () => {
    expect(equalSplit(1000, 3)).toEqual([334, 333, 333]);
  });

  test('4 leftover paise go to the first four members (1000 / 6)', () => {
    expect(equalSplit(1000, 6)).toEqual([167, 167, 167, 167, 166, 166]);
  });

  test.each([
    [1, 3],
    [10, 3],
    [999, 7],
    [100000, 13],
  ])('always sums to the total (%i / %i)', (total, count) => {
    expect(sum(equalSplit(total, count))).toBe(total);
  });
});

describe('percentToShares', () => {
  test('50-50', () => {
    expect(percentToShares(10000, [50, 50])).toEqual([5000, 5000]);
  });

  test('70-30', () => {
    expect(percentToShares(10000, [70, 30])).toEqual([7000, 3000]);
  });

  test('33/33/34 of ₹500 sums exactly', () => {
    expect(percentToShares(50000, [33, 33, 34])).toEqual([16500, 16500, 17000]);
  });

  test('uneven remainders still add up (1 paisa, thirds)', () => {
    const shares = percentToShares(100, [33.33, 33.33, 33.34]);
    expect(sum(shares)).toBe(100);
  });

  test('fractional percents use integer maths', () => {
    expect(percentToShares(1000, [12.5, 87.5])).toEqual([125, 875]);
  });
});

describe('calculateSplits', () => {
  const members = ['u_aman', 'u_rahul', 'u_neha'];

  test('EQUAL: spec example (₹1200 among 3)', () => {
    const splits = calculateSplits(SplitType.EQUAL, 120000, { participants: members }, members);
    expect(splits).toEqual([
      { userId: 'u_aman', share: 40000 },
      { userId: 'u_rahul', share: 40000 },
      { userId: 'u_neha', share: 40000 },
    ]);
  });

  test('EQUAL: indivisible amount gives leftover to the first members', () => {
    const splits = calculateSplits(SplitType.EQUAL, 1000, { participants: members }, members);
    expect(splits.map((s) => s.share)).toEqual([334, 333, 333]);
  });

  test('EXACT: shares must add up to the amount', () => {
    const ok = calculateSplits(
      SplitType.EXACT,
      900000,
      {
        splits: [
          { userId: 'u_aman', share: 400000 },
          { userId: 'u_rahul', share: 300000 },
          { userId: 'u_neha', share: 200000 },
        ],
      },
      members,
    );
    expect(sum(ok.map((s) => s.share))).toBe(900000);

    expect(() =>
      calculateSplits(
        SplitType.EXACT,
        900000,
        {
          splits: [
            { userId: 'u_aman', share: 400000 },
            { userId: 'u_rahul', share: 400000 },
          ],
        },
        members,
      ),
    ).toThrow(expect.objectContaining({ code: 'SPLIT_TOTAL_MISMATCH', statusCode: 400 }));
  });

  test('PERCENT: converts to paise (spec example)', () => {
    const splits = calculateSplits(
      SplitType.PERCENT,
      50000,
      {
        splits: [
          { userId: 'u_aman', percent: 50 },
          { userId: 'u_neha', percent: 50 },
        ],
      },
      members,
    );
    expect(splits).toEqual([
      { userId: 'u_aman', share: 25000 },
      { userId: 'u_neha', share: 25000 },
    ]);
  });

  test('PERCENT: must total 100', () => {
    expect(() =>
      calculateSplits(
        SplitType.PERCENT,
        50000,
        {
          splits: [
            { userId: 'u_aman', percent: 50 },
            { userId: 'u_neha', percent: 40 },
          ],
        },
        members,
      ),
    ).toThrow(expect.objectContaining({ code: 'SPLIT_TOTAL_MISMATCH' }));
  });

  test('rejects users that are not group members', () => {
    expect(() => calculateSplits(SplitType.EQUAL, 1000, { participants: ['u_aman', 'u_stranger'] }, members)).toThrow(
      expect.objectContaining({ code: 'NOT_GROUP_MEMBER', statusCode: 403 }),
    );
  });

  test('rejects duplicate users', () => {
    expect(() => calculateSplits(SplitType.EQUAL, 1000, { participants: ['u_aman', 'u_aman'] }, members)).toThrow(
      AppError,
    );
  });

  test('EQUAL needs participants, EXACT/PERCENT need splits', () => {
    expect(() => calculateSplits(SplitType.EQUAL, 1000, {}, members)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() => calculateSplits(SplitType.EXACT, 1000, {}, members)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});

describe('computeNetBalances', () => {
  const totals = (entries: Array<[string, number]>) => entries.map(([userId, total]) => ({ userId, total }));

  test('net = paid - shares (spec example: Aman paid ₹1200 dinner for 3)', () => {
    const net = computeNetBalances({
      expensePaid: totals([['aman', 120000]]),
      expenseOwed: totals([
        ['aman', 40000],
        ['rahul', 40000],
        ['neha', 40000],
      ]),
      settlementPaid: [],
      settlementReceived: [],
    });
    expect(net.get('aman')).toBe(80000);
    expect(net.get('rahul')).toBe(-40000);
    expect(net.get('neha')).toBe(-40000);
  });

  test('a settlement raises the payer and lowers the receiver ("Rahul paid Aman ₹500")', () => {
    const net = computeNetBalances({
      expensePaid: totals([['aman', 120000]]),
      expenseOwed: totals([
        ['aman', 40000],
        ['rahul', 40000],
        ['neha', 40000],
      ]),
      settlementPaid: totals([['rahul', 40000]]),
      settlementReceived: totals([['aman', 40000]]),
    });
    expect(net.get('rahul')).toBe(0);
    expect(net.get('aman')).toBe(40000);
  });

  test('all members of a group always sum to zero', () => {
    const net = computeNetBalances({
      expensePaid: totals([
        ['a', 900000],
        ['b', 50000],
        ['c', 1000],
      ]),
      expenseOwed: totals([
        ['a', 400000 + 25000 + 334],
        ['b', 300000 + 0 + 333],
        ['c', 200000 + 25000 + 333],
      ]),
      settlementPaid: totals([['b', 12345]]),
      settlementReceived: totals([['a', 12345]]),
    });
    expect(sum([...net.values()])).toBe(0);
  });
});

describe('helpers', () => {
  test('formatInr formats paise as rupees', () => {
    expect(formatInr(120000)).toBe('₹1,200.00');
    expect(formatInr(-45050)).toBe('-₹450.50');
  });

  test('parsePagination applies defaults and caps', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePagination({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 100, skip: 200 });
    expect(parsePagination({ page: '-4', limit: 'abc' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});
