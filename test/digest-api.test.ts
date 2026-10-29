import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
const configFor = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const line = (o: Record<string, unknown>) => JSON.stringify(o);

describe('digest JSON', () => {
  it('answers 200 with the rows of a night, in the same jobs and order as the page', async () => {
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        line({ at: '2026-10-28T10:00:00+01:00', job: 'zeta/job', status: 'ok', owner: 'rook' }),
        line({ at: '2026-10-28T10:05:00+01:00', job: 'alpha/flaky', status: 'retry', owner: 'rook', error: '503' }),
        line({ at: '2026-10-28T10:08:00+01:00', job: 'alpha/flaky', status: 'ok', owner: 'rook' }),
        line({ at: '2026-10-28T11:00:00+01:00', job: 'mid/broken', status: 'fail', owner: null, error: 'quota' }),
      ].join('\n') + '\n',
    );

    const app = createApp(configFor(dir));
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/flaky', 'mid/broken', 'zeta/job']);

    const page = await (await app.request('/digest/2026-10-28')).text();
    const pageOrder = body.rows.map((r) => page.indexOf(r.job));
    expect(pageOrder.every((i) => i > 0)).toBe(true);
    expect([...pageOrder].sort((a, b) => a - b)).toEqual(pageOrder);
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await createApp(configFor(dir)).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for this night' });
  });

  it('answers 200 with an empty rows array for an empty night', async () => {
    writeFileSync(join(dir, '2026-10-27.jsonl'), '');
    const res = await createApp(configFor(dir)).request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-27', rows: [], badLines: 0 });
  });

  it('counts a bad line instead of failing the night', async () => {
    writeFileSync(
      join(dir, '2026-10-26.jsonl'),
      [line({ at: '2026-10-26T10:00:00+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }), '{not json'].join('\n'),
    );
    const res = await createApp(configFor(dir)).request('/api/digest/2026-10-26');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
    expect(body.badLines).toBe(1);
  });
});
