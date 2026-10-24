import { seedData } from '../ops/data/seed';
import { demoSql } from './demoSql';

describe('demo data SQL', () => {
  it('covers every person, sector, block, list line, step and task', () => {
    const d = seedData(new Date('2026-10-24T12:00:00'));
    const sql = demoSql(d);
    const count = (table: string) => (sql.split(`insert into ${table} `)[1]?.split(';\n')[0].match(/^ {2}\(/gm) ?? []).length;
    expect(count('people')).toBe(d.people.length);
    expect(count('sectors')).toBe(d.sectors.length);
    expect(count('content_blocks')).toBe(d.sectors.reduce((n, s) => n + 5 + 6 + s.custom.length, 0));
    expect(count('tasks')).toBe(d.sectors.reduce((n, s) => n + Object.keys(s.tasks ?? {}).length, 0));
    expect(sql).toContain("'Championship Master'");
    expect(sql).toContain("'D''Andre'");
  });
});
