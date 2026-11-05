import { DebtBalance, simplifyDebts } from './simplifyDebts.worker';

/** Applies the payments to the balances and returns what is left over. */
function residual(balances: DebtBalance[], payments: Array<{ from: string; to: string; amount: number }>) {
  const net = new Map(balances.map((b) => [b.userId, b.net]));
  for (const p of payments) {
    net.set(p.from, (net.get(p.from) ?? 0) + p.amount);
    net.set(p.to, (net.get(p.to) ?? 0) - p.amount);
  }
  return [...net.values()].filter((v) => v !== 0);
}

describe('simplifyDebts', () => {
  test('spec example: Neha and Rahul pay Aman', () => {
    const balances = [
      { userId: 'u_aman', net: 50000 },
      { userId: 'u_rahul', net: -20000 },
      { userId: 'u_neha', net: -30000 },
    ];
    const payments = simplifyDebts(balances);
    expect(payments).toHaveLength(2);
    expect(payments).toEqual(
      expect.arrayContaining([
        { from: 'u_neha', to: 'u_aman', amount: 30000 },
        { from: 'u_rahul', to: 'u_aman', amount: 20000 },
      ]),
    );
  });

  test('nothing to do when everyone is settled', () => {
    expect(
      simplifyDebts([
        { userId: 'a', net: 0 },
        { userId: 'b', net: 0 },
      ]),
    ).toEqual([]);
  });

  test('clears every balance exactly', () => {
    const balances = [
      { userId: 'a', net: 700 },
      { userId: 'b', net: 300 },
      { userId: 'c', net: -450 },
      { userId: 'd', net: -250 },
      { userId: 'e', net: -300 },
    ];
    expect(residual(balances, simplifyDebts(balances))).toEqual([]);
  });

  test('beats the greedy answer: two independent pairs need 2 payments, not 3', () => {
    // a owes c 10, b owes d 10 - greedy on sorted values can chain them into 3 payments.
    const balances = [
      { userId: 'a', net: -10 },
      { userId: 'b', net: -10 },
      { userId: 'c', net: 10 },
      { userId: 'd', net: 10 },
    ];
    expect(simplifyDebts(balances)).toHaveLength(2);
  });

  test('finds disjoint zero-sum subsets: 6 members that split into 3 pairs need 3 payments', () => {
    const balances = [
      { userId: 'a', net: 70 },
      { userId: 'b', net: 50 },
      { userId: 'c', net: 40 },
      { userId: 'd', net: -40 },
      { userId: 'e', net: -50 },
      { userId: 'f', net: -70 },
    ];
    const payments = simplifyDebts(balances);
    expect(payments).toHaveLength(3);
    expect(residual(balances, payments)).toEqual([]);
  });

  test('never needs more than (members - 1) payments, and handles larger groups', () => {
    const balances: DebtBalance[] = Array.from({ length: 25 }, (_, i) => ({
      userId: `u${i}`,
      net: i % 2 === 0 ? (i + 1) * 100 : -(i * 100),
    }));
    const total = balances.reduce((s, b) => s + b.net, 0);
    balances.push({ userId: 'balancer', net: -total });
    const payments = simplifyDebts(balances);
    expect(payments.length).toBeLessThanOrEqual(balances.length - 1);
    expect(residual(balances, payments)).toEqual([]);
  });
});
