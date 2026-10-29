import type { DigestRow, Night } from '../digest/types.js';

// Missing data is shown as —, never as an empty cell (styleguide).
const dash = (v: string | null) => (v === null || v === '' ? '—' : v);

// Retries of 3 or more, and a last status of fail, are the two things a morning reader looks for.
const RETRY_MARK = 3;

function DigestTableRow({ row }: { row: DigestRow }) {
  return (
    <tr>
      <td>{row.job}</td>
      <td>{dash(row.owner)}</td>
      <td>{row.runs}</td>
      <td class={row.retries >= RETRY_MARK ? 'warn' : undefined}>{row.retries}</td>
      <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
      <td>{dash(row.lastError)}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>last error</th>
              <th>first</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <DigestTableRow row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} unreadable {night.badLines === 1 ? 'line' : 'lines'} skipped
        </p>
      ) : null}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
