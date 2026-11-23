// MCP tool `tlc`: drives bin/tla (SANY / PlusCal / TLC).
// Drop-in for local-mcp-server:  import { registerTlcTool } from "./tlc-tool"; registerTlcTool(server);
// Runs natively on Windows (set TLA_LAB to the lab folder); TLA_WSL=1 reaches a lab inside WSL2 via wsl.exe.
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Native by default (bun runs bin/tla.ts, java from PATH / JAVA_HOME) — works on Windows, Linux, WSL2.
//   TLA_LAB        lab directory (default: <home>/tlaplus-lab, or ../ of this file when run in place)
//   TLA_WSL=1      run the lab inside WSL2 instead (lab path in TLA_LAB is then a WSL path)
//   TLA_WSL_DISTRO distro name for wsl.exe -d
const WSL = !!process.env.TLA_WSL;
const DISTRO = process.env.TLA_WSL_DISTRO ?? "";
const LAB = process.env.TLA_LAB ?? (WSL ? "" : path.join(os.homedir(), "tlaplus-lab"));
const BUN = /bun/i.test(path.basename(process.execPath)) ? process.execPath : "bun";

function tlaCommand(args: string[]): { cmd: string; argv: string[] } {
  if (WSL) {
    const script = 'exec bun "${1:-$HOME/tlaplus-lab}/bin/tla.ts" "${@:2}"';
    const d = DISTRO ? ["-d", DISTRO] : [];
    return { cmd: "wsl.exe", argv: [...d, "-e", "bash", "-lc", script, "tla", LAB, ...args] };
  }
  return { cmd: BUN, argv: [path.join(LAB, "bin", "tla.ts"), ...args] };
}

interface RunResult { code: number | null; stdout: string; stderr: string; timedOut: boolean }

function runTla(args: string[], opts: { stdin?: string; timeoutMs: number }): Promise<RunResult> {
  const { cmd, argv } = tlaCommand(args);
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; p.kill("SIGKILL"); }, opts.timeoutMs);
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => { clearTimeout(timer); resolve({ code: 255, stdout, stderr: stderr + String(e), timedOut }); });
    p.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
    p.stdin.end(opts.stdin ?? "");
  });
}

const MODULE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export const tlcInput = {
  action: z.enum(["version", "parse", "pcal", "check", "sim"]).describe(
    "version: TLC version. parse: SANY syntax/level check. pcal: translate PlusCal in place. " +
    "check: TLC model checking (JSON summary with counterexample trace). sim: TLC random simulation."),
  module: z.string().regex(MODULE_RE).optional().describe(
    "Module name for inline `source` (file work/<module>.tla). Must equal the MODULE name in the source."),
  source: z.string().optional().describe("TLA+ (or PlusCal) module text to save and run. Alternative to `spec`."),
  cfg: z.string().optional().describe("TLC .cfg text (SPECIFICATION/INVARIANT/CONSTANT...). Saved as work/<module>.cfg."),
  spec: z.string().optional().describe("Existing spec path in the lab, e.g. examples/DieHard.tla. Alternative to `source`."),
  workers: z.number().int().min(1).max(64).optional().describe("TLC worker threads (default: auto)."),
  depth: z.number().int().min(1).optional().describe("Max trace depth for sim (default 100)."),
  timeoutSec: z.number().int().min(1).max(1800).optional().describe("Wall-clock limit (default 120)."),
  extraArgs: z.array(z.string()).optional().describe("Extra TLC arguments passed through verbatim after `--`."),
};

export async function runTlc(a: z.infer<z.ZodObject<typeof tlcInput>>) {
  const timeoutMs = (a.timeoutSec ?? 120) * 1000;
  const out = (text: string, isError = false) => ({ content: [{ type: "text" as const, text }], isError });

  if (a.action === "version") {
    const r = await runTla(["version"], { timeoutMs });
    return out(r.stdout.trim() || r.stderr.trim(), r.code !== 0);
  }

  let spec = a.spec;
  if (a.source !== undefined) {
    if (!a.module) return out("`module` is required with `source`.", true);
    const put = await runTla(["put", `${a.module}.tla`], { stdin: a.source, timeoutMs });
    if (put.code !== 0) return out(`put failed: ${put.stderr || put.stdout}`, true);
    if (a.cfg !== undefined) {
      const putc = await runTla(["put", `${a.module}.cfg`], { stdin: a.cfg, timeoutMs });
      if (putc.code !== 0) return out(`put cfg failed: ${putc.stderr || putc.stdout}`, true);
    }
    spec = `work/${a.module}.tla`;
  }
  if (!spec) return out("Give either `spec` or `module` + `source`.", true);

  // PlusCal source that has not been translated yet: translate first.
  const needsPcal = a.action !== "parse" && a.action !== "pcal" && a.source !== undefined &&
    /--(fair\s+)?algorithm/.test(a.source) && !a.source.includes("BEGIN TRANSLATION");
  if (a.action === "pcal" || needsPcal) {
    const r = await runTla(["pcal", spec], { timeoutMs });
    if (a.action === "pcal" || r.code !== 0) {
      return out(clean(r.stdout + r.stderr), r.code !== 0);
    }
  }

  if (a.action === "parse") {
    const r = await runTla(["parse", spec], { timeoutMs });
    return out(clean(r.stdout + r.stderr), r.code !== 0);
  }

  const args = [a.action, "--json"];
  if (a.workers) args.push("--workers", String(a.workers));
  if (a.action === "sim" && a.depth) args.push("--depth", String(a.depth));
  args.push(spec);
  if (a.extraArgs?.length) args.push("--", ...a.extraArgs);

  const r = await runTla(args, { timeoutMs });
  if (r.timedOut) return out(`TLC timed out after ${timeoutMs / 1000}s (killed).`, true);
  // exit 10-13 are model-checking verdicts, not tool failures; JSON is on stdout either way
  const verdict = r.code === 0 || (r.code !== null && r.code >= 10 && r.code <= 13);
  return out(r.stdout.trim() || clean(r.stderr), !verdict);
}

const clean = (s: string) => s.split("\n").filter((l) => !l.startsWith("Picked up")).join("\n").trim();

export function registerTlcTool(server: McpServer) {
  server.registerTool(
    "tlc",
    {
      title: "TLA+ / TLC",
      description:
        "Run TLA+ tools (SANY parser, PlusCal translator, TLC model checker/simulator) in the local tlaplus-lab. " +
        "Pass a spec as inline `module`+`source` (+`cfg`) or as an existing `spec` path. " +
        "check/sim return JSON: status (ok, invariant_violated, deadlock, liveness_violated, ...), state counts, and a counterexample trace.",
      inputSchema: tlcInput,
    },
    async (args) => runTlc(args),
  );
}
