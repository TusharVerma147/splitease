import { isMainThread, parentPort } from 'worker_threads';

export interface CsvExpense {
  date: string;
  description: string;
  paidBy: string;
  amount: number;
  splitType: string;
  splits: Array<{ userId: string; share: number }>;
}

export interface CsvInput {
  members: Array<{ userId: string; name: string }>;
  expenses: CsvExpense[];
}

export interface CsvOutput {
  csv: string;
  rows: number;
}

/** Quotes a cell when needed and neutralises spreadsheet formula injection. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Columns: date, description, paidBy, amount (paise), splitType, one column per member (their share). */
export function buildCsv(input: CsvInput): string {
  const header = ['date', 'description', 'paidBy', 'amount', 'splitType', ...input.members.map((m) => m.name)]
    .map(csvCell)
    .join(',');

  const rows = input.expenses.map((expense) => {
    const shares = new Map(expense.splits.map((s) => [s.userId, s.share]));
    return [
      csvCell(expense.date),
      csvCell(expense.description),
      csvCell(expense.paidBy),
      csvCell(expense.amount),
      csvCell(expense.splitType),
      ...input.members.map((m) => csvCell(shares.get(m.userId) ?? 0)),
    ].join(',');
  });

  return [header, ...rows].join('\n') + '\n';
}

if (!isMainThread && parentPort) {
  const port = parentPort;
  port.on('message', (message: { data: CsvInput }) => {
    try {
      const output: CsvOutput = { csv: buildCsv(message.data), rows: message.data.expenses.length };
      port.postMessage({ result: output });
    } catch (err) {
      port.postMessage({ error: err instanceof Error ? err.message : 'exportCsv failed' });
    }
  });
}
