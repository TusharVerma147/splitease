import { workerData, parentPort } from 'worker_threads';

interface Balance {
  userId: string;
  net: number;
}

interface Payment {
  from: string;
  to: string;
  amount: number;
}

function simplifyDebts(balances: Balance[]): Payment[] {
  const creditors: Balance[] = balances.filter((b) => b.net > 0).sort((a, b) => b.net - a.net);
  const debtors: Balance[] = balances.filter((b) => b.net < 0).sort((a, b) => a.net - b.net);

  const payments: Payment[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]!;
    const debtor = debtors[j]!;
    const amount = Math.min(creditor.net, Math.abs(debtor.net));

    payments.push({ from: debtor.userId, to: creditor.userId, amount });

    creditor.net -= amount;
    debtor.net += amount;

    if (creditor.net === 0) i++;
    if (debtor.net === 0) j++;
  }

  return payments;
}

const result = simplifyDebts(workerData as Balance[]);
parentPort?.postMessage(result);
