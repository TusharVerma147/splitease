import { buildCsv, csvCell } from './exportCsv.worker';

describe('buildCsv', () => {
  const members = [
    { userId: 'u1', name: 'Aman' },
    { userId: 'u2', name: 'Rahul' },
  ];

  test('columns: date, description, paidBy, amount, splitType, one per member', () => {
    const csv = buildCsv({
      members,
      expenses: [
        {
          date: '2026-10-28',
          description: 'Dinner',
          paidBy: 'Aman',
          amount: 120000,
          splitType: 'EQUAL',
          splits: [
            { userId: 'u1', share: 60000 },
            { userId: 'u2', share: 60000 },
          ],
        },
      ],
    });
    expect(csv.split('\n')).toEqual([
      'date,description,paidBy,amount,splitType,Aman,Rahul',
      '2026-10-28,Dinner,Aman,120000,EQUAL,60000,60000',
      '',
    ]);
  });

  test('members that are not part of an expense get 0', () => {
    const csv = buildCsv({
      members,
      expenses: [
        {
          date: '2026-10-28',
          description: 'Cab',
          paidBy: 'Rahul',
          amount: 500,
          splitType: 'EXACT',
          splits: [{ userId: 'u2', share: 500 }],
        },
      ],
    });
    expect(csv).toContain('2026-10-28,Cab,Rahul,500,EXACT,0,500');
  });

  test('escapes commas, quotes and newlines', () => {
    expect(csvCell('Dinner, "late"')).toBe('"Dinner, ""late"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  test('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(-500)).toBe('-500');
  });
});
