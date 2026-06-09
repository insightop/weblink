/**
 * @weblink/bridge — MCP Server
 *
 * Creates an MCP server that exposes bridge data as tools and resources.
 * Uses @modelcontextprotocol/sdk with stdio transport.
 *
 * The server reads data from a DataBridgeStorage instance (shared SQLite).
 * Can run as a standalone process or as a child process of the desktop app.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { DataBridgeStorage } from "../storage/DataBridgeStorage.js"

export function createMcpServer(storage: DataBridgeStorage): McpServer {
  const server = new McpServer({
    name: "weblink-bridge",
    version: "1.0.0",
  })

  // ── Tool: list_kits ──────────────────────────────────────────

  server.tool(
    "list_kits",
    "List all registered kit sessions with their current state summary",
    {},
    async () => {
      const states = await storage.getAllStates()
      const kits = states.map((s) => ({
        kitKey: s.kitKey,
        instanceId: s.instanceId,
        state: s.state,
        updatedAt: new Date(s.updatedAt).toISOString(),
      }))
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { kits, count: kits.length },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // ── Tool: get_kit_state ──────────────────────────────────────

  server.tool(
    "get_kit_state",
    "Get the current runtime state of a specific kit",
    {
      kitKey: z.string().describe("Kit identifier (e.g. 'serialkit', 'cankit')"),
      instanceId: z.string().optional().describe("Instance identifier (defaults to 'default')"),
    },
    async ({ kitKey, instanceId }) => {
      const state = await storage.getState(kitKey, instanceId)
      if (!state) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `No state found for kit '${kitKey}'`,
                kitKey,
                instanceId: instanceId ?? "default",
              }),
            },
          ],
        }
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                kitKey: state.kitKey,
                instanceId: state.instanceId,
                state: state.state,
                updatedAt: new Date(state.updatedAt).toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // ── Tool: get_kit_events ─────────────────────────────────────

  server.tool(
    "get_kit_events",
    "Retrieve recent events from a kit (serial data, CAN frames, logs, etc.)",
    {
      kitKey: z.string().describe("Kit identifier"),
      type: z.string().optional().describe("Filter by event type (e.g. 'rx_line', 'tx_frame')"),
      since: z.number().optional().describe("Only events after this timestamp (epoch ms)"),
      limit: z.number().optional().describe("Max events to return (default: 100)"),
    },
    async ({ kitKey, type, since, limit }) => {
      const events = await storage.getEvents(kitKey, {
        type: type || undefined,
        since: since || undefined,
        limit: limit || 100,
      })
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                kitKey,
                events: events.map((e) => ({
                  id: e.id,
                  type: e.type,
                  ts: new Date(e.ts).toISOString(),
                  payload: e.payload,
                })),
                count: events.length,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // ── Tool: get_kit_config ─────────────────────────────────────

  server.tool(
    "get_kit_config",
    "Get the configuration of a kit (baud rate, bit rate, etc.)",
    {
      kitKey: z.string().describe("Kit identifier"),
    },
    async ({ kitKey }) => {
      const config = await storage.getConfig(kitKey)
      if (!config) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `No config found for kit '${kitKey}'`,
                kitKey,
              }),
            },
          ],
        }
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                kitKey: config.kitKey,
                config: config.config,
                updatedAt: new Date(config.updatedAt).toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // ── Resource: kits overview ──────────────────────────────────

  server.resource(
    "kits-overview",
    "weblink://kits",
    async (uri) => {
      const states = await storage.getAllStates()
      const kits = states.map((s) => ({
        kitKey: s.kitKey,
        instanceId: s.instanceId,
        state: s.state,
        updatedAt: new Date(s.updatedAt).toISOString(),
      }))
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ kits, count: kits.length }, null, 2),
          },
        ],
      }
    },
  )

  return server
}
