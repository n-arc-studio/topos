import {
  promises as fs,
  existsSync,
  readFileSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type {
  GravityEvent,
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
  gravityEvents: GravityEvent[];
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
  gravityEvents?: GravityEvent[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "topos-db.json");
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const USE_NEON = Boolean(DATABASE_URL);
const neonSql = DATABASE_URL ? neon(DATABASE_URL) : null;
let neonReady: Promise<void> | null = null;

function toPersistDB(parsed: SerializedDB, expectedVersion: number): PersistDB | null {
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
    gravityEvents: parsed.gravityEvents ?? [],
  };
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

async function ensureNeonTable(): Promise<void> {
  if (!neonSql) return;
  if (!neonReady) {
    neonReady = neonSql`
      CREATE TABLE IF NOT EXISTS topos_state (
        id smallint PRIMARY KEY CHECK (id = 1),
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
  }
  await neonReady;
}

function loadDBFromFile(expectedVersion: number): PersistDB | null {
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
    return toPersistDB(parsed, expectedVersion);
  } catch (err) {
    console.error("[topos] persistence shape invalid", err);
    return null;
  }
}

async function loadDBFromNeon(expectedVersion: number): Promise<PersistDB | null> {
  if (!neonSql) return null;
  try {
    await ensureNeonTable();
    const rows = await neonSql`SELECT payload FROM topos_state WHERE id = 1 LIMIT 1`;
    if (rows.length === 0) return null;
    let payload = rows[0].payload as unknown;
    if (typeof payload === "string") {
      payload = JSON.parse(payload) as unknown;
    }
    return toPersistDB(payload as SerializedDB, expectedVersion);
  } catch (err) {
    console.error("[topos] neon load failed", err);
    return null;
  }
}

export async function loadDB(expectedVersion: number): Promise<PersistDB | null> {
  if (USE_NEON) return loadDBFromNeon(expectedVersion);
  return loadDBFromFile(expectedVersion);
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
    gravityEvents: db.gravityEvents,
  };
}

async function saveDBToFile(db: PersistDB): Promise<void> {
  ensureDir();
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(serialize(db), null, 2), "utf-8");
  await fs.rename(tmp, DATA_FILE);
}

async function saveDBToNeon(db: PersistDB): Promise<void> {
  if (!neonSql) return;
  await ensureNeonTable();
  const payload = JSON.stringify(serialize(db));
  await neonSql`
    INSERT INTO topos_state (id, payload, updated_at)
    VALUES (1, ${payload}::jsonb, now())
    ON CONFLICT (id)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
  `;
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
      if (USE_NEON) {
        await saveDBToNeon(target);
      } else {
        await saveDBToFile(target);
      }
    } catch (err) {
      console.error("[topos] persistence save failed", err);
    }
  }, 100);
}
