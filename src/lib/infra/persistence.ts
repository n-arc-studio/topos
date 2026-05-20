import {
  promises as fs,
  existsSync,
  readFileSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import type {
  ModerationAction,
  Post,
  Space,
  Thread,
  User,
} from "@/lib/domain/types";

// MVP のメモリストアを JSON ファイルへ永続化する最小実装。
// PostgreSQL/Prisma への移行は将来。今は「サーバ再起動後もデータが残る」
// ことだけを満たす。

export type PersistDB = {
  schemaVersion: number;
  users: Map<string, User>;
  spaces: Map<string, Space>;
  threads: Map<string, Thread>;
  posts: Map<string, Post>;
  moderation: ModerationAction[];
  reactionLog: Set<string>;
  reportLog: Set<string>;
};

interface SerializedDB {
  schemaVersion: number;
  users: User[];
  spaces: Space[];
  threads: Thread[];
  posts: Post[];
  moderation: ModerationAction[];
  reactionLog: string[];
  reportLog: string[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "topos-db.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDBSync(expectedVersion: number): PersistDB | null {
  if (!existsSync(DATA_FILE)) return null;
  let raw: string;
  try {
    raw = readFileSync(DATA_FILE, "utf-8");
  } catch (err) {
    console.error("[topos] persistence read failed", err);
    return null;
  }
  let parsed: SerializedDB;
  try {
    parsed = JSON.parse(raw) as SerializedDB;
  } catch (err) {
    // 壊れた JSON は隔離して空 DB で起動する。
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantine = path.join(DATA_DIR, `topos-db.corrupt-${ts}.json`);
    try {
      ensureDir();
      renameSync(DATA_FILE, quarantine);
      console.error(
        `[topos] persistence file was corrupt, quarantined to ${quarantine}`,
        err
      );
    } catch (renameErr) {
      console.error("[topos] persistence quarantine failed", renameErr);
    }
    return null;
  }
  try {
    if (parsed.schemaVersion !== expectedVersion) return null;
    return {
      schemaVersion: parsed.schemaVersion,
      users: new Map(parsed.users.map((u) => [u.id, u])),
      spaces: new Map(parsed.spaces.map((s) => [s.id, s])),
      threads: new Map(parsed.threads.map((t) => [t.id, t])),
      posts: new Map(parsed.posts.map((p) => [p.id, p])),
      moderation: parsed.moderation,
      reactionLog: new Set(parsed.reactionLog),
      reportLog: new Set(parsed.reportLog),
    };
  } catch (err) {
    console.error("[topos] persistence shape invalid", err);
    return null;
  }
}

let saveTimer: NodeJS.Timeout | null = null;
let pendingDB: PersistDB | null = null;

function serialize(db: PersistDB): SerializedDB {
  return {
    schemaVersion: db.schemaVersion,
    users: [...db.users.values()],
    spaces: [...db.spaces.values()],
    threads: [...db.threads.values()],
    posts: [...db.posts.values()],
    moderation: db.moderation,
    reactionLog: [...db.reactionLog],
    reportLog: [...db.reportLog],
  };
}

// 100ms 以内の連続変更は1回の書き込みに集約する。
export function scheduleSave(db: PersistDB): void {
  pendingDB = db;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    const target = pendingDB;
    saveTimer = null;
    pendingDB = null;
    if (!target) return;
    try {
      ensureDir();
      const tmp = `${DATA_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(serialize(target), null, 2), "utf-8");
      await fs.rename(tmp, DATA_FILE);
    } catch (err) {
      console.error("[topos] persistence save failed", err);
    }
  }, 100);
}
