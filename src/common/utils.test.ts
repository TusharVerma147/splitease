import { equalSplit, percentToShares } from './utils';

describe('equalSplit', () => {
  test('divides evenly', () => {
    expect(equalSplit(1000, 4)).toEqual([250, 250, 250, 250]);
  });

  test('distributes leftover paise to first members', () => {
    expect(equalSplit(1000, 3)).toEqual([334, 333, 333]);
  });

  test('1 paise leftover to first member', () => {
    expect(equalSplit(10, 3)).toEqual([4, 3, 3]);
  });

  test('all shares sum to total', () => {
    const shares = equalSplit(999, 7);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(sum).toBe(999);
  });

  test('2 leftover paise distributed to first 2 members', () => {
    const shares = equalSplit(1000, 6);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(sum).toBe(1000);
  });
});

describe('percentToShares', () => {
  test('50-50 split', () => {
    expect(percentToShares(10000, [50, 50])).toEqual([5000, 5000]);
  });

  test('sums to total', () => {
    const shares = percentToShares(50000, [33, 33, 34]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(50000);
  });

  test('rounding remainder goes to last member', () => {
    const shares = percentToShares(100, [33, 33, 34]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  test('70-30 split', () => {
    const shares = percentToShares(10000, [70, 30]);
    expect(shares[0]).toBe(7000);
    expect(shares[1]).toBe(3000);
  });
});
