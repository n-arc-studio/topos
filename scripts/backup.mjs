#!/usr/bin/env node
// 簡易バックアップスクリプト。
// data/topos-db.json を data/backups/topos-db-<timestamp>.json にコピーし、
// 直近 KEEP 世代のみ残す。
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "data", "topos-db.json");
const DIR = path.join(ROOT, "data", "backups");
const KEEP = Number(process.env.TOPOS_BACKUP_KEEP ?? "20");

async function main() {
  if (!existsSync(SRC)) {
    console.error("[backup] no source file:", SRC);
    process.exit(1);
  }
  await fs.mkdir(DIR, { recursive: true });

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  const dest = path.join(DIR, `topos-db-${ts}.json`);
  await fs.copyFile(SRC, dest);
  console.log("[backup] saved:", dest);

  // 世代管理: 古いものから削除
  const entries = (await fs.readdir(DIR))
    .filter((n) => n.startsWith("topos-db-") && n.endsWith(".json"))
    .sort();
  const excess = entries.length - KEEP;
  if (excess > 0) {
    for (const name of entries.slice(0, excess)) {
      await fs.unlink(path.join(DIR, name));
      console.log("[backup] pruned:", name);
    }
  }
}

main().catch((err) => {
  console.error("[backup] failed:", err);
  process.exit(1);
});
