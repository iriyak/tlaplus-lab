// Turn raw TLC output into a small JSON-able summary.
const EXIT_STATUS: Record<number, string> = {
  0: "ok",
  10: "assertion_failed",
  11: "deadlock",
  12: "invariant_violated",
  13: "liveness_violated",
  75: "spec_eval_failure",
  76: "invariant_eval_failure",
  77: "property_eval_failure",
  150: "config_error",
  151: "spec_parse_error",
  152: "config_parse_error",
  255: "error",
};

export interface TraceState { n: number; label: string; vars: Record<string, string> }

export function summarize(rc: number, raw: string): Record<string, unknown> {
  const lines = raw.split(/\r?\n/).filter((l) => !l.startsWith("Picked up"));
  const text = lines.join("\n");
  const s: Record<string, unknown> = { status: EXIT_STATUS[rc] ?? `exit_${rc}`, exit_code: rc };

  let m = text.match(/^TLC2 Version (.+?) \(/m);
  if (m) s.tlc_version = m[1];
  m = text.match(/(\d+) states generated, (\d+) distinct states found, (\d+) states left on queue/);
  if (m) { s.states_generated = +m[1]; s.distinct_states = +m[2]; s.queue_left = +m[3]; }
  m = text.match(/depth of the complete state graph search is (\d+)/);
  if (m) s.depth = +m[1];
  m = text.match(/Finished in (\S+)/);
  if (m) s.elapsed = m[1];

  const errors = lines.filter((l) => l.startsWith("Error:"));
  if (errors.length) s.errors = errors;

  const trace: TraceState[] = [];
  let cur: TraceState | null = null;
  for (const l of lines) {
    const sm = l.match(/^State (\d+): (.*)$/);
    if (sm) { cur = { n: +sm[1], label: sm[2], vars: {} }; trace.push(cur); continue; }
    if (!cur) continue;
    const vm = l.match(/^\/\\ (\w+) = (.*)$/);
    if (vm) cur.vars[vm[1]] = vm[2];
    else if (l.trim() === "" || /^\d+ states generated/.test(l) || l.startsWith("Back to state")) {
      if (l.startsWith("Back to state")) s.loop = l;
      cur = null;
    }
  }
  if (trace.length) s.trace = trace;

  if (![0, 10, 11, 12, 13].includes(rc)) s.output_tail = lines.slice(-25).join("\n");
  return s;
}
