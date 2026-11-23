// Standalone stdio MCP server exposing only the `tlc` tool (for MCP Inspector / quick tests).
//   bun run mcp/server.ts        (or: npx tsx mcp/server.ts)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTlcTool } from "./tlc-tool";

const server = new McpServer({ name: "tlaplus-lab", version: "0.1.0" });
registerTlcTool(server);
await server.connect(new StdioServerTransport());
