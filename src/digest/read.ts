import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse one log line at the edge. null = not a usable line (counted by the caller).
function parseLine(text: string): Line | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || typeof o.status !== 'string') return null;
  if (!STATUSES.includes(o.status)) return null;
  if (o.owner !== undefined && o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && o.error !== null && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: o.owner ?? null,
    error: o.error ?? null,
  };
}

export const readNight: ReadNight = (runsDir, night): Night | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.owner = line.owner;
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.error !== null) row.lastError = line.error;
    row.lastAt = line.at;
  }

  return { night, rows: [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)), badLines };
};
