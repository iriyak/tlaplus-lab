// Spawns mcp/server.ts over stdio with the MCP SDK client and exercises the `tlc` tool.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mcpDir = path.dirname(fileURLToPath(import.meta.url)); // not URL.pathname: that breaks on Windows ("/C:/...")
const client = new Client({ name: "smoke", version: "0" });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [path.join(mcpDir, "server.ts")],
  env: { ...process.env, TLA_LAB: path.resolve(mcpDir, "..") } as Record<string, string>,
}));

const call = async (args: Record<string, unknown>) => {
  try {
    const r: any = await client.callTool({ name: "tlc", arguments: args });
    return { isError: !!r.isError, text: r.content[0].text as string };
  } catch (e) {
    return { isError: true, text: String(e) }; // schema validation errors may surface as protocol errors
  }
};
let failed = 0;
const expect = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
  if (!ok) failed++;
};

console.log("tools:", (await client.listTools()).tools.map((t) => t.name).join(", "));

let r = await call({ action: "version" });
expect("version", /TLC2 Version/.test(r.text), r.text);

r = await call({ action: "parse", spec: "examples/DieHard.tla" });
expect("parse ok", !r.isError && /Semantic processing of module DieHard/.test(r.text), r.text);

r = await call({ action: "check", spec: "examples/DieHard.tla" });
let j = JSON.parse(r.text);
expect("DieHard -> invariant_violated, not tool error", !r.isError && j.status === "invariant_violated" && j.trace.at(-1).vars.big === "4", r.text);

const hello = `---- MODULE Hello ----
EXTENDS Naturals
VARIABLE x
Init == x = 0
Next == x < 3 /\\ x' = x + 1
Spec == Init /\\ [][Next]_x
Small == x <= 3
====`;
r = await call({ action: "check", module: "Hello", source: hello, cfg: "SPECIFICATION Spec\nINVARIANT Small\nCHECK_DEADLOCK FALSE\n" });
j = JSON.parse(r.text);
expect("inline spec ok (deadlock check off)", j.status === "ok" && j.distinct_states === 4, r.text);

const pluscal = `---- MODULE Race2 ----
EXTENDS Naturals
(*--algorithm Race2
variables counter = 0;
process Worker \\in 1..2
variables tmp = 0;
begin
  Read:  tmp := counter;
  Write: counter := tmp + 1;
end process;
end algorithm; *)
Correct == (\\A self \\in 1..2 : pc[self] = "Done") => counter = 2
====`;
r = await call({ action: "check", module: "Race2", source: pluscal, cfg: "SPECIFICATION Spec\nINVARIANT Correct\n" });
j = JSON.parse(r.text);
expect("inline PlusCal auto-translated, lost update found", j.status === "invariant_violated", r.text);

r = await call({ action: "sim", spec: "examples/DieHard.tla", depth: 30 });
expect("sim returns JSON", !!JSON.parse(r.text).status, r.text);

r = await call({ action: "check", module: "Bad", source: "---- MODULE Bad ----\nVARIABLE x\nInit == x =\n====", cfg: "SPECIFICATION Spec\n" });
expect("syntax error surfaces as isError or error status", r.isError || JSON.parse(r.text).status !== "ok", r.text);

r = await call({ action: "check", module: "../evil", source: "x" });
expect("bad module name rejected", r.isError, r.text);

await client.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
