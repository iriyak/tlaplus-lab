#!/usr/bin/env bun
// tla — thin CLI over tla2tools.jar (SANY / PlusCal / TLC). Runs on Windows, WSL2 and Linux (bun + java).
//   tla version
//   tla put    Name.tla|Name.cfg        # save stdin to work/ (for the MCP tool)
//   tla parse  Spec.tla                 # SANY: syntax + level check
//   tla pcal   Spec.tla [pcal opts]     # PlusCal -> TLA+ (rewrites the file in place)
//   tla check  [opts] Spec.tla          # TLC model checking
//   tla sim    [opts] Spec.tla          # TLC random simulation
// check/sim options:
//   --json            print a JSON summary instead of raw TLC output
//   --config FILE     .cfg to use (default: Spec.cfg next to Spec.tla)
//   --workers N       worker threads (default: auto)
//   --depth N         simulation depth (sim only; default 100)
//   --                everything after is passed to TLC verbatim
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "./tlc-summary";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JAR = process.env.TLA_JAR ?? path.join(HERE, "lib", "tla2tools.jar");
const JAVA = process.env.JAVA ?? (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java");
const JOPTS = (process.env.TLA_JAVA_OPTS ?? "-Xmx2g -XX:+UseParallelGC").split(/\s+/).filter(Boolean);

const die = (msg: string): never => { console.error(`tla: ${msg}`); process.exit(2); };
const clean = (s: string) => s.split(/\r?\n/).filter((l) => !l.startsWith("Picked up")).join("\n");

function java(args: string[], cwd: string, mode: "inherit" | "capture"): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(JAVA, [...JOPTS, "-cp", JAR, ...args], { cwd, stdio: mode === "inherit" ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", (e) => { out += `cannot run ${JAVA}: ${e.message}\n`; resolve({ code: 255, out }); });
    p.on("close", (code) => resolve({ code: code ?? 255, out }));
  });
}

const abs = (p: string) => path.resolve(p);
const [cmd = "help", ...rest] = process.argv.slice(2);

if (!["help", "-h", "--help", "put"].includes(cmd) && !existsSync(JAR)) {
  die(`tla2tools.jar not found at ${JAR} (set TLA_JAR or run: make jar)`);
}

switch (cmd) {
  case "version": {
    const r = await java(["tlc2.TLC"], HERE, "capture");
    const m = clean(r.out).match(/^TLC2 Version .*$/m);
    if (!m) die("could not determine TLC version");
    console.log(m![0]);
    break;
  }
  case "put": {
    if (rest.length !== 1) die("usage: tla put Name.tla|Name.cfg  (content on stdin)");
    if (!/^[A-Za-z][A-Za-z0-9_]*\.(tla|cfg)$/.test(rest[0])) die(`bad file name: ${rest[0]}`);
    let data = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) data += chunk;
    mkdirSync(path.join(HERE, "work"), { recursive: true });
    const dest = path.join(HERE, "work", rest[0]);
    writeFileSync(dest, data);
    console.log(dest);
    break;
  }
  case "parse": {
    if (rest.length < 1) die("usage: tla parse Spec.tla");
    const spec = abs(rest[0]);
    const r = await java(["tla2sany.SANY", ...rest.slice(1), path.basename(spec)], path.dirname(spec), "capture");
    process.stdout.write(clean(r.out) + "\n");
    process.exit(r.code);
  }
  case "pcal": {
    if (rest.length < 1) die("usage: tla pcal Spec.tla [pcal options]");
    const spec = abs(rest[rest.length - 1]);
    const r = await java(["pcal.trans", ...rest.slice(0, -1), path.basename(spec)], path.dirname(spec), "capture");
    process.stdout.write(clean(r.out) + "\n");
    process.exit(r.code);
  }
  case "check":
  case "sim": {
    let json = false, cfg = "", workers = "auto", depth = "100", spec = "";
    let extra: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--json") json = true;
      else if (a === "--config") cfg = rest[++i];
      else if (a === "--workers") workers = rest[++i];
      else if (a === "--depth") depth = rest[++i];
      else if (a === "--") { extra = rest.slice(i + 1); break; }
      else if (a.startsWith("-")) die(`unknown option ${a}`);
      else spec = a;
    }
    if (!spec) die(`usage: tla ${cmd} [opts] Spec.tla`);
    if (!existsSync(spec)) die(`no such file: ${spec}`);
    spec = abs(spec);
    const args = ["tlc2.TLC", "-workers", workers, "-cleanup"];
    if (cfg) args.push("-config", abs(cfg));
    if (cmd === "sim") args.push("-simulate", "-depth", depth);
    const meta = mkdtempSync(path.join(tmpdir(), "tlc-"));
    try {
      const r = await java([...args, "-metadir", meta, ...extra, path.basename(spec)], path.dirname(spec), "capture");
      if (json) console.log(JSON.stringify(summarize(r.code, r.out), null, 2));
      else process.stdout.write(clean(r.out) + "\n");
      process.exitCode = r.code;
    } finally {
      rmSync(meta, { recursive: true, force: true });
    }
    break;
  }
  case "help": case "-h": case "--help": {
    const src = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 15);
    console.log(src.map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    break;
  }
  default:
    die(`unknown command: ${cmd} (try: tla help)`);
}
