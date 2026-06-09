/**
 * generate-schema.ts — Reads schema.yaml and generates:
 *   1. src/domain/sqlite-schema.ts  (SQL DDL constant)
 *   2. src/domain/types.ts          (TypeScript interfaces)
 *   3. ../../apps/tauri/src-tauri/src/bridge/schema.rs (Rust structs + DDL)
 *
 * Usage: tsx scripts/generate-schema.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// ─── Types ───────────────────────────────────────────────────

interface Column {
  name: string
  type: string
  primary_key?: boolean
  autoincrement?: boolean
  not_null?: boolean
  default?: string
  json?: boolean
  ts_type?: string
  rust_type?: string
  name_override?: {
    rust_field?: string
    rust_serde_rename?: string
  }
}

interface Table {
  columns: Column[]
  primary_key?: string[]
}

interface SchemaIndex {
  name: string
  table: string
  columns: string[]
}

interface Schema {
  tables: Record<string, Table>
  indexes: SchemaIndex[]
}

// ─── Helpers ─────────────────────────────────────────────────

/** Convert snake_case to camelCase */
function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** SQL type to TypeScript type */
function sqlToTsType(col: Column): string {
  if (col.json && col.ts_type) return col.ts_type
  if (col.type === "TEXT") return "string"
  if (col.type === "INTEGER") return "number"
  return "unknown"
}

/** SQL type to Rust type */
function sqlToRustType(col: Column): string {
  if (col.json && col.rust_type) return col.rust_type
  if (col.type === "TEXT") return "String"
  if (col.type === "INTEGER") return "i64"
  return "serde_json::Value"
}

/** Get the Rust field name (with override support) */
function rustFieldName(col: Column): string {
  return col.name_override?.rust_field ?? col.name
}

/** Get the TypeScript interface name for a table */
function tableInterfaceName(tableName: string): string {
  const map: Record<string, string> = {
    kit_schemas: "KitSchema",
    kit_state: "KitState",
    kit_events: "KitEventEntry",
    kit_config: "KitConfig",
  }
  return map[tableName] ?? toCamelCase(tableName)
}

/** Get the Rust struct name for a table */
function tableStructName(tableName: string): string {
  const map: Record<string, string> = {
    kit_schemas: "KitSchemaData",
    kit_state: "KitStateData",
    kit_events: "KitEventEntry",
    kit_config: "KitConfigData",
  }
  return map[tableName] ?? tableName
}

// ─── SQL DDL Generation ─────────────────────────────────────

function generateDDL(schema: Schema): string {
  const lines: string[] = []

  for (const [tableName, table] of Object.entries(schema.tables)) {
    lines.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`)

    const colDefs: string[] = []
    const pkCols = table.primary_key ?? []

    for (const col of table.columns) {
      let def = `  ${col.name} ${col.type}`
      if (col.primary_key && pkCols.length === 0) {
        def += " PRIMARY KEY"
      }
      if (col.autoincrement) def += " AUTOINCREMENT"
      if (col.not_null) def += " NOT NULL"
      if (col.default !== undefined) def += ` DEFAULT ${col.default}`
      colDefs.push(def)
    }

    if (pkCols.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pkCols.join(", ")})`)
    }

    lines.push(colDefs.join(",\n"))
    lines.push(");")
    lines.push("")
  }

  for (const idx of schema.indexes) {
    lines.push(
      `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.columns.join(", ")});`
    )
  }

  return lines.join("\n")
}

// ─── TypeScript Generation ───────────────────────────────────

function generateTypescript(schema: Schema): string {
  const lines: string[] = []

  for (const [tableName, table] of Object.entries(schema.tables)) {
    const ifaceName = tableInterfaceName(tableName)
    lines.push(`export interface ${ifaceName} {`)

    for (const col of table.columns) {
      const propName = toCamelCase(col.name)
      const tsType = sqlToTsType(col)
      const optional = !col.not_null && !col.primary_key
      lines.push(`  ${propName}${optional ? "?" : ""}: ${tsType}`)
    }

    lines.push("}")
    lines.push("")
  }

  // EventQueryOptions is not schema-driven, kept as hand-written
  lines.push("// ─── Event query options ───────────────────────────────────")
  lines.push("")
  lines.push("/** Options for querying events */")
  lines.push("export interface EventQueryOptions {")
  lines.push("  /** Filter by event type */")
  lines.push("  type?: string")
  lines.push("  /** Only return events after this timestamp (epoch ms) */")
  lines.push("  since?: number")
  lines.push("  /** Maximum number of events to return (default: 100) */")
  lines.push("  limit?: number")
  lines.push("}")
  lines.push("")

  return lines.join("\n")
}

// ─── Rust Generation ─────────────────────────────────────────

function generateRust(schema: Schema, ddl: string): string {
  const lines: string[] = []

  lines.push("// @generated by scripts/generate-schema.ts - DO NOT EDIT")
  lines.push("// Source: src/domain/schema.yaml")
  lines.push("")

  // DDL constant
  lines.push("pub const SCHEMA_SQL: &str = \"")
  // Escape backslashes and double quotes for Rust string
  const escapedDdl = ddl.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  lines.push(escapedDdl)
  lines.push("\";")
  lines.push("")

  // Structs
  for (const [tableName, table] of Object.entries(schema.tables)) {
    const structName = tableStructName(tableName)
    lines.push("#[derive(Debug, Clone, Serialize, Deserialize)]")
    lines.push(`pub struct ${structName} {`)

    for (const col of table.columns) {
      const rustField = rustFieldName(col)
      const rustType = sqlToRustType(col)

      // Add serde rename if the field name differs from column name
      if (col.name_override?.rust_serde_rename) {
        lines.push(`    #[serde(rename = "${col.name_override.rust_serde_rename}")]`)
      }

      lines.push(`    pub ${rustField}: ${rustType},`)
    }

    lines.push("}")
    lines.push("")
  }

  // EventQueryOptions (hand-written Rust struct)
  lines.push("#[derive(Debug, Clone, Serialize, Deserialize)]")
  lines.push("pub struct EventQueryOptions {")
  lines.push('    #[serde(rename = "type")]')
  lines.push("    pub event_type: Option<String>,")
  lines.push("    pub since: Option<i64>,")
  lines.push("    pub limit: Option<i64>,")
  lines.push("}")
  lines.push("")

  return lines.join("\n")
}

// ─── Main ────────────────────────────────────────────────────

function main() {
  const yamlPath = resolve(ROOT, "src/domain/schema.yaml")
  const raw = readFileSync(yamlPath, "utf-8")
  const schema = yaml.load(raw) as Schema

  const ddl = generateDDL(schema)

  // 1. Generate sqlite-schema.ts
  const tsSchemaPath = resolve(ROOT, "src/domain/sqlite-schema.ts")
  const tsSchemaContent = `/**
 * @generated by scripts/generate-schema.ts - DO NOT EDIT
 * Source: src/domain/schema.yaml
 *
 * Shared DDL constant used by both TypeScript (Electron/better-sqlite3)
 * and Rust (Tauri/rusqlite).
 *
 * WAL mode is enabled at connection time, not in DDL.
 */

export const SQLITE_SCHEMA = \`
${ddl}
\`.trim()
`
  writeFileSync(tsSchemaPath, tsSchemaContent, "utf-8")
  console.log(`  Generated ${tsSchemaPath}`)

  // 2. Generate types.ts
  const tsTypesPath = resolve(ROOT, "src/domain/types.ts")
  const tsTypesContent = `/**
 * @generated by scripts/generate-schema.ts - DO NOT EDIT
 * Source: src/domain/schema.yaml
 *
 * Core domain model shared by all platforms (Electron, Tauri, Web).
 * These types define the data contract between kits, IPC, storage, and MCP.
 */

${generateTypescript(schema)}`
  writeFileSync(tsTypesPath, tsTypesContent, "utf-8")
  console.log(`  Generated ${tsTypesPath}`)

  // 3. Generate Rust schema.rs
  const rustDir = resolve(ROOT, "../../apps/tauri/src-tauri/src/bridge")
  mkdirSync(rustDir, { recursive: true })
  const rustPath = resolve(rustDir, "schema.rs")
  const rustContent = `use serde::{Deserialize, Serialize};

${generateRust(schema, ddl)}`
  writeFileSync(rustPath, rustContent, "utf-8")
  console.log(`  Generated ${rustPath}`)

  console.log("\nSchema generation complete.")
}

main()
