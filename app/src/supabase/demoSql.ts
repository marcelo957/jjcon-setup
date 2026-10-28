import type { OpsData } from '../ops/data/types';
import { TABLES, toRows, type Row } from './rows';

/**
 * The app's demo data as SQL inserts for the Supabase tables in supabase/01_tables.sql.
 * Generated from seedData(), so the database starts with exactly what the demo shows.
 */

const lit = (v: Row[string]): string =>
  v === null ? 'null'
    : typeof v === 'boolean' ? (v ? 'true' : 'false')
    : typeof v === 'number' ? String(v)
    : `'${v.replace(/'/g, "''")}'`;

function insert(table: string, rows: Row[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return `insert into ${table} (${cols.join(', ')}) values\n${rows.map((r) => `  (${cols.map((c) => lit(r[c])).join(', ')})`).join(',\n')};\n\n`;
}

export function demoSql(d: OpsData): string {
  const t = toRows(d);
  return [
    '-- JJCON SetUp · step 2 · demo data',
    '-- Run once, after 01_tables.sql, in Supabase → SQL Editor → New query → paste → Run.',
    `-- The demo's people, sectors, plans, lists, steps and task deadlines, as of ${new Date().toISOString().slice(0, 10)}.`,
    '-- Floorplan files point at the demo drawings by name; the real PDF files arrive with step 3 (Storage).',
    '',
    'begin;',
    '',
    ...TABLES.map((table) => insert(table, t[table]).trimEnd()).filter(Boolean).flatMap((sql) => [sql, '']),
    'commit;',
    ''
  ].join('\n');
}
