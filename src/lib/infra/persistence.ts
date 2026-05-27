import { neon } from "@neondatabase/serverless";
import type {
  GravityEvent,
  ModerationAction,
  Post,
  Space,
  Thread,
  User,
} from "@/lib/domain/types";

// 永続化は Neon/PostgreSQL を前提にする。

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

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for persistence");
}
const neonSql = neon(DATABASE_URL);
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

async function ensureNeonTable(): Promise<void> {
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

async function loadDBFromNeon(expectedVersion: number): Promise<PersistDB | null> {
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
    throw err;
  }
}

export async function loadDB(expectedVersion: number): Promise<PersistDB | null> {
  return loadDBFromNeon(expectedVersion);
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

async function saveDBToNeon(db: PersistDB): Promise<void> {
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
      await saveDBToNeon(target);
    } catch (err) {
      console.error("[topos] persistence save failed", err);
    }
  }, 100);
}
