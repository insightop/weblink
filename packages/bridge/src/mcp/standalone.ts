/**
 * @weblink/bridge — MCP Server Entry Point (stdio)
 *
 * Standalone MCP server that reads from SQLite and exposes kit data
 * via the Model Context Protocol. Used by AI tools (Claude Code, Cursor, etc.)
 *
 * Usage:
 *   node --import tsx packages/bridge/src/mcp/standalone.ts /path/to/weblink.db
 *
 * Or configured in .claude/settings.json:
 *   { "mcpServers": { "weblink": { "command": "node", "args": ["--import", "tsx", "packages/bridge/src/mcp/standalone.ts", "/path/to/db"] } }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import Database from "better-sqlite3"
import { DataBridgeStorage } from "../storage/DataBridgeStorage.js"
import { createMcpServer } from "./server.js"

async function main(): Promise<void> {
  const dbPath = process.argv[2]
  if (!dbPath) {
    console.error("Usage: standalone.ts <db-path>")
    process.exit(1)
  }

  const db = new Database(dbPath)
  const storage = new DataBridgeStorage(db)
  const server = createMcpServer(storage)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Cleanup on exit
  process.on("SIGINT", () => {
    storage.close()
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    storage.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error("[bridge-mcp] Fatal error:", err)
  process.exit(1)
})
