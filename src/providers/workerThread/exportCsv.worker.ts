import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';

interface SplitRow {
  userId: string;
  name: string;
  share: number;
}

interface ExpenseRow {
  date: string;
  description: string;
  paidBy: string;
  amount: number;
  splitType: string;
  splits: SplitRow[];
}

interface ExportWorkerData {
  exportId: string;
  groupName: string;
  members: Array<{ userId: string; name: string }>;
  expenses: ExpenseRow[];
  outputDir: string;
}

function buildCsv(data: ExportWorkerData): string {
  const memberNames = data.members.map((m) => m.name);
  const header = ['date', 'description', 'paidBy', 'amount(paise)', 'splitType', ...memberNames].join(',');

  const rows = data.expenses.map((exp) => {
    const memberShares = data.members.map((m) => {
      const split = exp.splits.find((s) => s.userId === m.userId);
      return split ? split.share : 0;
    });
    return [exp.date, `"${exp.description}"`, exp.paidBy, exp.amount, exp.splitType, ...memberShares].join(',');
  });

  return [header, ...rows].join('\n');
}

const data = workerData as ExportWorkerData;
const csv = buildCsv(data);
const filePath = path.join(data.outputDir, `export_${data.exportId}.csv`);

fs.mkdirSync(data.outputDir, { recursive: true });
fs.writeFileSync(filePath, csv, 'utf-8');

parentPort?.postMessage({ filePath });
