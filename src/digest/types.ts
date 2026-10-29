export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  // Owner on the job's last line. null when the log has none: the view shows it as —.
  owner: string | null;
  // Lines for this job, retries included.
  runs: number;
  // Lines for this job with status "retry".
  retries: number;
  lastStatus: RunStatus;
  // Error on the last line of this job that had one. null when no line had an error.
  lastError: string | null;
  // `at` of the first and last line, as written in the log (offset kept, never converted).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // One row per job, sorted by job.
  rows: DigestRow[];
  // Lines that did not parse or did not have the expected shape. Counted, never thrown.
  badLines: number;
};

// readNight(runsDir, night): reads <runsDir>/<night>.jsonl. Returns null when there is no file
// for that night (or `night` is not YYYY-MM-DD), so a route can answer 404. An empty file is
// not null: it gives { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
