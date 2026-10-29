import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function runsDirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs and counts the 1 bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts runs and retries, and keeps the last error of a job that recovered', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps a failed job as failed, with its error', () => {
    expect(night?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      owner: 'lane-07',
    });
  });

  it('keeps the row of a job with no owner, owner null', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('keeps the offset from the log', () => {
    const row = night?.rows.find((r) => r.job === 'rig/rotate-logs');
    expect(row?.firstAt).toBe('2026-10-28T23:00:02+01:00');
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file and for a malformed night', () => {
    expect(readNight('runs', '2020-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    const dir = runsDirWith({ '2026-01-01.jsonl': '' });
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts lines that parse but have the wrong shape, and never throws', () => {
    const good = '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":null}';
    const dir = runsDirWith({
      '2026-01-01.jsonl': [good, 'not json', '[]', 'null', '{"job":"b"}', '{"at":"x","job":"b","status":"weird","owner":"o"}', '', good].join('\n'),
    });
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]).toMatchObject({ job: 'a', runs: 2, owner: null });
  });
});
