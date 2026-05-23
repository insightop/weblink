#!/usr/bin/env node
/**
 * Convert @/ imports to relative paths in a kit's src/ directory.
 * Usage: node scripts/fix-imports.mjs <kit-name>
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname, resolve } from "path";

const kitName = process.argv[2];
if (!kitName) {
  console.error("Usage: node scripts/fix-imports.mjs <kit-name>");
  process.exit(1);
}

const kitSrcDir = resolve(`kits/${kitName}/src`);
let totalChanges = 0;

function walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".vue"))) {
      files.push(fullPath);
    }
  }
  return files;
}

function convertImport(importPath, fromFile) {
  if (!importPath.startsWith("@/")) return null;
  const target = importPath.replace("@/", "");
  const fromDir = dirname(fromFile);
  const targetFile = resolve(kitSrcDir, target);
  let rel = relative(fromDir, targetFile);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

const files = walkDir(kitSrcDir);
console.log(`Processing ${kitName}: ${files.length} files`);

for (const file of files) {
  let content = readFileSync(file, "utf-8");
  let changed = false;

  // Match: from "@/..." or import("@/...")
  content = content.replace(
    /(from\s+["'])(@\/[^"']+)(["'])/g,
    (match, prefix, path, suffix) => {
      const rel = convertImport(path, file);
      if (rel) {
        changed = true;
        totalChanges++;
        return prefix + rel + suffix;
      }
      return match;
    }
  );

  content = content.replace(
    /(import\s*\(\s*["'])(@\/[^"']+)(["'])/g,
    (match, prefix, path, suffix) => {
      const rel = convertImport(path, file);
      if (rel) {
        changed = true;
        totalChanges++;
        return prefix + rel + suffix;
      }
      return match;
    }
  );

  if (changed) {
    writeFileSync(file, content, "utf-8");
    console.log(`  Updated: ${relative(kitSrcDir, file)}`);
  }
}

console.log(`Done. ${totalChanges} imports converted.`);
