import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let dir: string;
const configFor = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const line = (o: Record<string, unknown>) => JSON.stringify(o);

describe('digest page', () => {
  it('renders one table sorted by job, marking retries of 3 or more and fail', async () => {
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        line({ at: '2026-10-28T10:00:00+01:00', job: 'zeta/job', status: 'ok', owner: 'rook' }),
        line({ at: '2026-10-28T10:05:00+01:00', job: 'alpha/flaky', status: 'retry', owner: 'rook', error: '503' }),
        line({ at: '2026-10-28T10:06:00+01:00', job: 'alpha/flaky', status: 'retry', owner: 'rook', error: '503' }),
        line({ at: '2026-10-28T10:07:00+01:00', job: 'alpha/flaky', status: 'retry', owner: 'rook', error: '503' }),
        line({ at: '2026-10-28T10:08:00+01:00', job: 'alpha/flaky', status: 'ok', owner: 'rook' }),
        line({ at: '2026-10-28T11:00:00+01:00', job: 'mid/broken', status: 'fail', owner: null, error: 'quota' }),
      ].join('\n') + '\n',
    );

    const res = await createApp(configFor(dir)).request('/digest/2026-10-28');
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html.match(/<table>/g)).toHaveLength(1);
    const alpha = html.indexOf('alpha/flaky');
    const mid = html.indexOf('mid/broken');
    const zeta = html.indexOf('zeta/job');
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(mid);
    expect(mid).toBeLessThan(zeta);
    // retries of 3 are marked; the fail row's status is marked; a null owner shows as —.
    expect(html).toMatch(/<td class="warn">3<\/td>/);
    expect(html).toMatch(/<td class="warn">fail<\/td>/);
    expect(html).toContain('—');
    expect(html).not.toMatch(/<td class="warn">0<\/td>/);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(configFor(dir)).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-01-01');
  });

  it('renders "nothing ran" for an empty file', async () => {
    writeFileSync(join(dir, '2026-10-27.jsonl'), '');
    const res = await createApp(configFor(dir)).request('/digest/2026-10-27');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('still renders the night and counts a bad line', async () => {
    writeFileSync(
      join(dir, '2026-10-26.jsonl'),
      [line({ at: '2026-10-26T10:00:00+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }), '{not json'].join('\n'),
    );
    const res = await createApp(configFor(dir)).request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('1 unreadable line skipped');
  });

  it('renders the real night on disk', async () => {
    const res = await createApp(configFor('runs')).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('notes/backup');
  });
});
