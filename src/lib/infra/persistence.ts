import { neon } from "@neondatabase/serverless";
import type {
  GravityEvent,
  MobileMetricEvent,
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
  mobileMetricEvents: MobileMetricEvent[];
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
  mobileMetricEvents?: MobileMetricEvent[];
}

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for persistence");
}
const neonSql = neon(DATABASE_URL);
let neonReady: Promise<void> | null = null;

// 新しいPostgreSQL永続化機能
async function initializeDatabase(): Promise<void> {
  if (neonReady) return;
  
  try {
    await neonSql`
      CREATE TABLE IF NOT EXISTS auth_users (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS user_profile_mappings (
        auth_user_id text PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
        domain_user_id text NOT NULL,
        display_name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS spaces (
        id text PRIMARY KEY,
        name text NOT NULL,
        description text,
        admin_ids text[] NOT NULL DEFAULT '{}',
        lifecycle text NOT NULL DEFAULT 'active',
        lifecycle_since timestamptz NOT NULL DEFAULT now(),
        last_admin_action_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS threads (
        id text PRIMARY KEY,
        space_id text REFERENCES spaces(id) ON DELETE CASCADE,
        title text NOT NULL,
        created_by text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS posts (
        id text PRIMARY KEY,
        thread_id text REFERENCES threads(id) ON DELETE CASCADE,
        author_id text NOT NULL,
        content text NOT NULL,
        space_id text REFERENCES spaces(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        parent_post_id text REFERENCES posts(id) ON DELETE SET NULL
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS reactions (
        id text PRIMARY KEY,
        post_id text REFERENCES posts(id) ON DELETE CASCADE,
        user_id text NOT NULL,
        kind text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS reports (
        id text PRIMARY KEY,
        post_id text REFERENCES posts(id) ON DELETE CASCADE,
        user_id text NOT NULL,
        reason text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    await neonSql`
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id text PRIMARY KEY,
        action text NOT NULL,
        target_type text NOT NULL,
        target_id text NOT NULL,
        actor_user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    
    neonReady = Promise.resolve();
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

async function loadDBFromPostgreSQL(): Promise<PersistDB> {
  await initializeDatabase();

  try {
    // データを取得
    const usersResult = await neonSql`SELECT * FROM auth_users`;
    const spacesResult = await neonSql`SELECT * FROM spaces`;
    const threadsResult = await neonSql`SELECT * FROM threads`;
    const postsResult = await neonSql`SELECT * FROM posts`;
    const reactionsResult = await neonSql`SELECT * FROM reactions`;
    const reportsResult = await neonSql`SELECT * FROM reports`;
    const moderationActionsResult = await neonSql`SELECT * FROM moderation_actions`;

    // データをMapに変換
    const users = new Map<string, User>();
    for (const row of usersResult) {
      const isAdminOf: string[] = (() => {
        try { return typeof row.is_admin_of === 'string' ? JSON.parse(row.is_admin_of) : row.is_admin_of; } catch { return []; }
      })();
      users.set(row.id, {
        id: row.id,
        displayName: row.display_name || `User ${row.id}`,
        isAdminOf: isAdminOf,
        publicMass: typeof row.public_mass === 'number' ? row.public_mass : 1.0,
        anonymousMass: typeof row.anonymous_mass === 'number' ? row.anonymous_mass : 0.5
      });
    }

    const spaces = new Map<string, Space>();
    for (const row of spacesResult) {
      spaces.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description || "",
        adminIds: row.admin_ids || [],
        lifecycle: row.lifecycle as SpaceLifecycle,
        lifecycleSince: row.lifecycle_since,
        lastAdminActionAt: row.last_admin_action_at
      });
    }

    const threads = new Map<string, Thread>();
    for (const row of threadsResult) {
      threads.set(row.id, {
        id: row.id,
        spaceId: row.space_id,
        title: row.title,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }

    const posts = new Map<string, Post>();
    for (const row of postsResult) {
      posts.set(row.id, {
        id: row.id,
        threadId: row.thread_id,
        authorId: row.author_id,
        content: row.content,
        spaceId: row.space_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        parentPostId: row.parent_post_id || undefined
      });
    }

    const moderation = moderationActionsResult.map(row => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      actorUserId: row.actor_user_id,
      createdAt: row.created_at
    }));

    // 他のデータ構造を初期化
    const reactionLog = new Set<string>();
    const reportLog = new Set<string>();
    const gravityEvents: GravityEvent[] = [];
    const mobileMetricEvents: MobileMetricEvent[] = [];

    return {
      schemaVersion: 3,
      users,
      spaces,
      threads,
      posts,
      moderation,
      reactionLog,
      reportLog,
      gravityEvents,
      mobileMetricEvents
    };
  } catch (error) {
    console.error("Failed to load DB from PostgreSQL:", error);
    throw error;
  }
}

async function saveDBToPostgreSQL(db: PersistDB): Promise<void> {
  await initializeDatabase();

  try {
    // データを保存する前に、既存データをクリア
    await neonSql`DELETE FROM moderation_actions`;
    await neonSql`DELETE FROM reports`;
    await neonSql`DELETE FROM reactions`;
    await neonSql`DELETE FROM posts`;
    await neonSql`DELETE FROM threads`;
    await neonSql`DELETE FROM spaces`;
    await neonSql`DELETE FROM users`;
    await neonSql`DELETE FROM user_profile_mappings`;
    await neonSql`DELETE FROM auth_users`;

    // データを保存
    for (const [id, user] of db.users) {
      const isAdminOfJson = JSON.stringify(user.isAdminOf);
      await neonSql`
        INSERT INTO users (id, display_name, is_admin_of, public_mass, anonymous_mass, created_at, updated_at)
        VALUES (${id}, ${user.displayName || null}, ${isAdminOfJson}, ${user.publicMass}, ${user.anonymousMass}, now(), now())
        ON CONFLICT (id) DO UPDATE SET
          display_name = excluded.display_name,
          is_admin_of = excluded.is_admin_of,
          public_mass = excluded.public_mass,
          anonymous_mass = excluded.anonymous_mass,
          updated_at = now()
      `;
    }

    for (const [id, space] of db.spaces) {
      await neonSql`
        INSERT INTO spaces (id, name, description, admin_ids, lifecycle, lifecycle_since, last_admin_action_at, created_at, updated_at)
        VALUES (${id}, ${space.name}, ${space.description || null}, ${space.adminIds}, ${space.lifecycle}, ${space.lifecycleSince}, ${space.lastAdminActionAt}, now(), now())
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          admin_ids = excluded.admin_ids,
          lifecycle = excluded.lifecycle,
          updated_at = now()
      `;
    }

    for (const [id, thread] of db.threads) {
      await neonSql`
        INSERT INTO threads (id, space_id, title, created_by, created_at, updated_at)
        VALUES (${id}, ${thread.spaceId}, ${thread.title}, ${thread.createdBy}, ${thread.createdAt}, ${thread.updatedAt})
        ON CONFLICT (id) DO UPDATE SET
          title = excluded.title,
          updated_at = now()
      `;
    }

    for (const [id, post] of db.posts) {
      await neonSql`
        INSERT INTO posts (id, thread_id, author_id, content, space_id, created_at, updated_at, parent_post_id)
        VALUES (${id}, ${post.threadId}, ${post.authorId}, ${post.content}, ${post.spaceId}, ${post.createdAt}, ${post.updatedAt}, ${post.parentPostId || null})
        ON CONFLICT (id) DO UPDATE SET
          content = excluded.content,
          updated_at = now()
      `;
    }

    for (const action of db.moderation) {
      await neonSql`
        INSERT INTO moderation_actions (id, action, target_type, target_id, actor_user_id, created_at)
        VALUES (${action.id}, ${action.action}, ${action.targetType}, ${action.targetId}, ${action.actorUserId}, ${action.createdAt})
      `;
    }

  } catch (error) {
    console.error("Failed to save DB to PostgreSQL:", error);
    throw error;
  }
}

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
    mobileMetricEvents: parsed.mobileMetricEvents ?? [],
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
    mobileMetricEvents: db.mobileMetricEvents,
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

export async function saveNow(db: PersistDB): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingDB = null;
  await saveDBToNeon(db);
}

export async function flushPendingSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const target = pendingDB;
  pendingDB = null;
  if (!target) return;
  await saveDBToNeon(target);
}
