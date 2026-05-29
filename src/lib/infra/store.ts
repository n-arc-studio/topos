import type {
  GravityEvent,
  ModerationAction,
  Post,
  ReactionKind,
  Space,
  Thread,
  User,
} from "@/lib/domain/types";
import type { SpaceGravityConfig } from "@/lib/domain/gravity-config";
import {
  evaluateLifecycle,
  isWritable,
  MAX_VACATION_MS,
} from "@/lib/domain/lifecycle";
import { loadDB, scheduleSave } from "./persistence";

// MVP用の単純なメモリストア。
// 永続化は次フェーズで PostgreSQL に差し替える前提で、関数インターフェイスのみ公開する。

type DB = {
  schemaVersion: number;
  users: Map<string, User>;
  spaces: Map<string, Space>;
  threads: Map<string, Thread>;
  posts: Map<string, Post>;
  moderation: ModerationAction[];
  // 同一ユーザー × 同一投稿 × 同一種別の反応の重複防止
  reactionLog: Set<string>;
  // 同一ユーザーが同じ投稿を二重通報するのを防ぐ
  reportLog: Set<string>;
  // 重力スコアに影響したイベントの時系列ログ (GravityChart 用)
  gravityEvents: GravityEvent[];
};

// スキーマ変更時はインクリメント。古い DB は破棄して再シードする。
const SCHEMA_VERSION = 3;

// Next.js dev のホットリロードでも一意に保つ
const g = globalThis as unknown as { __toposDB?: DB };

const AUTO_SINK_REPORT_THRESHOLD = 3;

// 質量(マス)に加算するときの反応別重み。重力スコアと近いが、長期的な評価のため少し控えめ。
const MASS_WEIGHT: Record<ReactionKind, number> = {
  like: 1,
  useful: 3,
  laugh: 2,
  tsukkomi: 2,
  agree: 2,
};

// 投稿/返信の基礎加算。
const POST_MASS_GAIN = 1;

// リアクション実行者には投稿者加算の一部のみ付与する。
const REACTOR_BONUS_RATE = 0.25;

// 初期管理や緊急時の権限操作を行えるプラットフォーム管理者。
const PLATFORM_ADMIN_IDS = new Set(["u_admin"]);

function applyMass(
  user: User | undefined,
  mode: "anonymous" | "named",
  delta: number
): void {
  if (!user || !Number.isFinite(delta) || delta === 0) return;
  if (mode === "named") {
    user.publicMass = Math.round((user.publicMass + delta) * 100) / 100;
    return;
  }
  user.anonymousMass = Math.round((user.anonymousMass + delta) * 100) / 100;
}

function emptyReactions(): Post["reactions"] {
  return { like: 0, useful: 0, laugh: 0, tsukkomi: 0, agree: 0 };
}

function newPostBase(): Pick<Post, "reactions" | "reportCount" | "isPinned" | "isSunk"> {
  return {
    reactions: emptyReactions(),
    reportCount: 0,
    isPinned: false,
    isSunk: false,
  };
}

function seed(): DB {
  const now = Date.now();
  const users = new Map<string, User>();
  const spaces = new Map<string, Space>();
  const threads = new Map<string, Thread>();
  const posts = new Map<string, Post>();

  const admin: User = {
    id: "u_admin",
    displayName: "キリヒト",
    isAdminOf: ["s_topos", "s_lang"],
    publicMass: 142000,
    anonymousMass: 0,
  };
  const u1: User = {
    id: "u_demo",
    displayName: "demo",
    isAdminOf: [],
    publicMass: 0,
    anonymousMass: 0,
  };
  users.set(admin.id, admin);
  users.set(u1.id, u1);

  const sTopos: Space = {
    id: "s_topos",
    name: "トポス本体",
    charter:
      "場の重力をテーマに、SNSそのものを設計し直す場。マウントと自己保身の敬語を持ち込まないこと。",
    adminIds: [admin.id],
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    lifecycle: "active",
    lifecycleSince: now - 1000 * 60 * 60 * 24 * 30,
    lastAdminActionAt: now,
  };
  const sLang: Space = {
    id: "s_lang",
    name: "日本語OS解析",
    charter:
      "日本語というOSのソースコード(敬語・主語省略・文脈依存)をデバッグする場。",
    adminIds: [admin.id],
    createdAt: now - 1000 * 60 * 60 * 24 * 14,
    lifecycle: "active",
    lifecycleSince: now - 1000 * 60 * 60 * 24 * 14,
    lastAdminActionAt: now,
  };
  spaces.set(sTopos.id, sTopos);
  spaces.set(sLang.id, sLang);

  const t1: Thread = {
    id: "t_intro",
    spaceId: sTopos.id,
    title: "「場の重力」とは何か",
    createdBy: admin.id,
    createdAt: now - 1000 * 60 * 60 * 24 * 3,
  };
  const t2: Thread = {
    id: "t_kei",
    spaceId: sLang.id,
    title: "敬語は身分ではなく動的ロールである",
    createdBy: admin.id,
    createdAt: now - 1000 * 60 * 60 * 24 * 2,
  };
  threads.set(t1.id, t1);
  threads.set(t2.id, t2);

  const seedPosts: Post[] = [
    {
      id: "p1",
      threadId: t1.id,
      spaceId: sTopos.id,
      authorId: admin.id,
      identityMode: "named",
      body: "場の重力とは、人や熱量が自然と引き寄せられる引力のこと。フォロワー数ではなく、場への寄与で評価される世界をつくる。",
      createdAt: now - 1000 * 60 * 60 * 24 * 3,
      reactions: { like: 3, useful: 7, laugh: 0, tsukkomi: 0, agree: 4 },
      isAdminPost: true,
      reportCount: 0,
      isPinned: true,
      isSunk: false,
    },
    {
      id: "p2",
      threadId: t1.id,
      spaceId: sTopos.id,
      authorId: "u_demo",
      identityMode: "anonymous",
      body: "結局フォロワー数ゲームじゃないSNSってどう成り立つの",
      createdAt: now - 1000 * 60 * 60 * 24 * 2,
      reactions: { like: 1, useful: 2, laugh: 0, tsukkomi: 1, agree: 1 },
      isAdminPost: false,
      replyTo: "p1",
      reportCount: 0,
      isPinned: false,
      isSunk: false,
    },
    {
      id: "p3",
      threadId: t1.id,
      spaceId: sTopos.id,
      authorId: admin.id,
      identityMode: "named",
      body: "「場の維持に貢献したか」をスコア化する。澱む発言は重力で下に沈み、流れを作る発言が上に浮く。",
      createdAt: now - 1000 * 60 * 60 * 12,
      reactions: { like: 4, useful: 10, laugh: 0, tsukkomi: 0, agree: 6 },
      isAdminPost: true,
      replyTo: "p2",
      reportCount: 0,
      isPinned: false,
      isSunk: false,
    },
    {
      id: "p4",
      threadId: t2.id,
      spaceId: sLang.id,
      authorId: "u_demo",
      identityMode: "anonymous",
      body: "敬語=マナーって認識自体が日本語OSのバグだと思う",
      createdAt: now - 1000 * 60 * 60 * 6,
      reactions: { like: 5, useful: 4, laugh: 2, tsukkomi: 1, agree: 3 },
      isAdminPost: false,
      reportCount: 0,
      isPinned: false,
      isSunk: false,
    },
  ];
  for (const p of seedPosts) posts.set(p.id, p);

  return {
    schemaVersion: SCHEMA_VERSION,
    users,
    spaces,
    threads,
    posts,
    moderation: [],
    reactionLog: new Set(),
    reportLog: new Set(),
    gravityEvents: [],
  };
}

async function initDB(): Promise<void> {
  if (!g.__toposDB || g.__toposDB.schemaVersion !== SCHEMA_VERSION) {
    const loaded = await loadDB(SCHEMA_VERSION);
    g.__toposDB = loaded ?? seed();
    if (!loaded) scheduleSave(g.__toposDB);
  }
}

try {
  await initDB();
} catch (err) {
  console.error("[topos] db initialization failed", err);
  throw err;
}

function getDB(): DB {
  if (!g.__toposDB || g.__toposDB.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("[topos] db is not initialized");
  }
  // 後方互換: 既存 DB に gravityEvents が無い場合 (古いプロセスの globalThis キャッシュ等)
  if (!g.__toposDB.gravityEvents) g.__toposDB.gravityEvents = [];
  // 後方互換: lifecycle フィールド未設定の Space を補完 (プロセス内マイグレ)
  for (const s of g.__toposDB.spaces.values()) {
    if (!s.lifecycle) {
      s.lifecycle = "active";
      s.lifecycleSince = s.createdAt;
      s.lastAdminActionAt = Date.now();
    }
  }
  return g.__toposDB;
}

// 場のライフサイクルを遅延評価し、必要なら状態遷移を書き戻す。
// succession 期限切れで立候補者がいる場合はその場で承認処理も行う。
function touchLifecycle(space: Space): Space {
  const now = Date.now();
  const snap = evaluateLifecycle(space, now);
  if (snap.changed) {
    space.lifecycle = snap.lifecycle;
    space.lifecycleSince = snap.lifecycleSince;
    space.successionDeadline = snap.successionDeadline;
    space.candidates = snap.candidates;
    space.frozenAt = snap.frozenAt;
    persist();
  }
  // succession 期限切れ × 立候補あり → 自動承認
  if (
    space.lifecycle === "succession" &&
    space.successionDeadline !== undefined &&
    now >= space.successionDeadline &&
    (space.candidates?.length ?? 0) > 0
  ) {
    const db = g.__toposDB;
    const winner = space.candidates![0];
    const newAdmin = db?.users.get(winner.userId);
    if (newAdmin && !newAdmin.isAdminOf.includes(space.id)) {
      newAdmin.isAdminOf.push(space.id);
    }
    if (!space.adminIds.includes(winner.userId)) {
      space.adminIds.push(winner.userId);
    }
    space.lifecycle = "active";
    space.lifecycleSince = now;
    space.lastAdminActionAt = now;
    space.successionDeadline = undefined;
    space.candidates = undefined;
    persist();
  }
  return space;
}

function persist(): void {
  if (g.__toposDB) scheduleSave(g.__toposDB);
}

// ---- 公開API ----

export function listSpaces(): Space[] {
  const spaces = [...getDB().spaces.values()];
  for (const s of spaces) touchLifecycle(s);
  return spaces.sort((a, b) => b.createdAt - a.createdAt);
}

export function getSpace(id: string): Space | undefined {
  const s = getDB().spaces.get(id);
  return s ? touchLifecycle(s) : undefined;
}

export function listThreads(spaceId: string): Thread[] {
  return [...getDB().threads.values()]
    .filter((t) => t.spaceId === spaceId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getThread(id: string): Thread | undefined {
  return getDB().threads.get(id);
}

export function listPosts(threadId: string): Post[] {
  return [...getDB().posts.values()].filter((p) => p.threadId === threadId);
}

export function getPost(id: string): Post | undefined {
  return getDB().posts.get(id);
}

export function listPostEvents(postId: string): GravityEvent[] {
  const events = getDB().gravityEvents ?? [];
  return events.filter((e) => e.postId === postId);
}

export function getUser(id: string): User | undefined {
  return getDB().users.get(id);
}

export function ensureUser(id: string, displayName: string): User {
  const db = getDB();
  let u = db.users.get(id);
  if (!u) {
    u = {
      id,
      displayName,
      isAdminOf: [],
      publicMass: 0,
      anonymousMass: 0,
    };
    db.users.set(id, u);
    persist();
  }
  return u;
}

export function updateUserDisplayName(
  userId: string,
  displayName: string
): User | { error: string } {
  const name = displayName.trim();
  if (!name) return { error: "empty_name" };
  if (name.length > 40) return { error: "too_long" };
  const db = getDB();
  const u = db.users.get(userId);
  if (!u) return { error: "user_not_found" };
  u.displayName = name;
  persist();
  return u;
}

export function createThread(input: {
  spaceId: string;
  title: string;
  createdBy: string;
}): Thread | { error: string } {
  const db = getDB();
  const space = db.spaces.get(input.spaceId);
  if (!space) return { error: "space_not_found" };
  touchLifecycle(space);
  if (!isWritable(space)) return { error: "space_archived" };
  if (!input.title.trim()) return { error: "empty_title" };
  const t: Thread = {
    id: `t_${Math.random().toString(36).slice(2, 10)}`,
    spaceId: input.spaceId,
    title: input.title.trim().slice(0, 120),
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };
  db.threads.set(t.id, t);
  persist();
  return t;
}

export function createPost(input: {
  threadId: string;
  authorId: string;
  identityMode: "anonymous" | "named";
  body: string;
  replyTo?: string;
}): Post | { error: string } {
  const db = getDB();
  const thread = db.threads.get(input.threadId);
  if (!thread) return { error: "thread_not_found" };
  const space = db.spaces.get(thread.spaceId);
  if (space) {
    touchLifecycle(space);
    if (!isWritable(space)) return { error: "space_archived" };
  }
  const body = input.body.trim();
  if (!body) return { error: "empty_body" };
  if (body.length > 2000) return { error: "too_long" };
  if (input.replyTo) {
    const target = db.posts.get(input.replyTo);
    if (!target) return { error: "reply_target_not_found" };
    if (target.threadId !== thread.id) {
      // 別スレッドの投稿を返信先にすることは禁止 (データ整合性ガード)
      return { error: "reply_cross_thread" };
    }
  }

  const author = db.users.get(input.authorId);
  const isAdmin = !!author?.isAdminOf.includes(thread.spaceId);

  // 管理者は記名強制 (責任の可視化)
  const mode: "anonymous" | "named" = isAdmin ? "named" : input.identityMode;

  const p: Post = {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    threadId: thread.id,
    spaceId: thread.spaceId,
    authorId: input.authorId,
    identityMode: mode,
    body,
    createdAt: Date.now(),
    isAdminPost: isAdmin,
    replyTo: input.replyTo,
    ...newPostBase(),
  };
  db.posts.set(p.id, p);

  // 投稿/返信そのものにも質量を付与する。
  applyMass(author, mode, POST_MASS_GAIN);

  persist();
  return p;
}

export function react(input: {
  postId: string;
  byUserId: string;
  kind: ReactionKind;
}): Post | { error: string } {
  const db = getDB();
  const post = db.posts.get(input.postId);
  if (!post) return { error: "post_not_found" };
  const space = db.spaces.get(post.spaceId);
  if (space) {
    touchLifecycle(space);
    if (!isWritable(space)) return { error: "space_archived" };
  }
  if (post.authorId === input.byUserId) return { error: "self_reaction" };

  const key = `${input.byUserId}:${input.postId}:${input.kind}`;
  if (db.reactionLog.has(key)) return { error: "already_reacted" };
  db.reactionLog.add(key);

  post.reactions[input.kind] = (post.reactions[input.kind] ?? 0) + 1;
  db.gravityEvents.push({
    postId: post.id,
    type: "reaction",
    at: Date.now(),
    reactionKind: input.kind,
    byUserId: input.byUserId,
  });

  // 質量を著者に加算 (匿名と記名で別管理)
  const author = db.users.get(post.authorId);
  const w = MASS_WEIGHT[input.kind];
  applyMass(author, post.identityMode, w);

  // リアクション実行者にも少量の質量を付与する。
  const reactor = db.users.get(input.byUserId);
  applyMass(reactor, post.identityMode, w * REACTOR_BONUS_RATE);

  persist();
  return post;
}

export function reportPost(input: {
  postId: string;
  byUserId: string;
  reason?: string;
}): Post | { error: string } {
  const db = getDB();
  const post = db.posts.get(input.postId);
  if (!post) return { error: "post_not_found" };
  const space = db.spaces.get(post.spaceId);
  if (space) {
    touchLifecycle(space);
    if (!isWritable(space)) return { error: "space_archived" };
  }
  if (post.authorId === input.byUserId) return { error: "self_report" };

  const key = `${input.byUserId}:${input.postId}`;
  if (db.reportLog.has(key)) return { error: "already_reported" };
  db.reportLog.add(key);

  post.reportCount += 1;
  db.gravityEvents.push({
    postId: post.id,
    type: "report",
    at: Date.now(),
    byUserId: input.byUserId,
  });

  // 一定数を超えたら自動沈降
  if (!post.isSunk && post.reportCount >= AUTO_SINK_REPORT_THRESHOLD) {
    post.isSunk = true;
    db.gravityEvents.push({
      postId: post.id,
      type: "sink",
      at: Date.now(),
      byUserId: "system",
    });
    db.moderation.push({
      id: `m_${Math.random().toString(36).slice(2, 10)}`,
      spaceId: post.spaceId,
      threadId: post.threadId,
      postId: post.id,
      byUserId: "system",
      kind: "sink",
      at: Date.now(),
      note: `auto-sink: reports=${post.reportCount}`,
    });
  }
  persist();
  return post;
}

export function moderatePost(input: {
  postId: string;
  byUserId: string;
  action: "sink" | "unsink" | "pin" | "unpin";
}): Post | { error: string } {
  const db = getDB();
  const post = db.posts.get(input.postId);
  if (!post) return { error: "post_not_found" };
  const user = db.users.get(input.byUserId);
  if (!user?.isAdminOf.includes(post.spaceId)) {
    return { error: "not_authorized" };
  }
  switch (input.action) {
    case "sink":
      post.isSunk = true;
      break;
    case "unsink":
      post.isSunk = false;
      break;
    case "pin":
      post.isPinned = true;
      break;
    case "unpin":
      post.isPinned = false;
      break;
  }
  // 管理者の活動を lifecycle 判定に反映
  const space = db.spaces.get(post.spaceId);
  if (space) {
    space.lastAdminActionAt = Date.now();
    touchLifecycle(space);
  }
  db.gravityEvents.push({
    postId: post.id,
    type: input.action,
    at: Date.now(),
    byUserId: input.byUserId,
  });
  db.moderation.push({
    id: `m_${Math.random().toString(36).slice(2, 10)}`,
    spaceId: post.spaceId,
    threadId: post.threadId,
    postId: post.id,
    byUserId: input.byUserId,
    kind: input.action,
    at: Date.now(),
  });
  persist();
  return post;
}

export function isAdmin(userId: string, spaceId: string): boolean {
  const u = getDB().users.get(userId);
  return !!u?.isAdminOf.includes(spaceId);
}

// ホーム用: 全スレッドを「最新投稿の活発さ」で並べ替える
export function listHotThreads(limit = 5, opts?: { includeArchived?: boolean }): Array<{
  thread: Thread;
  space: Space;
  postCount: number;
  lastPostAt: number;
}> {
  const db = getDB();
  const includeArchived = opts?.includeArchived ?? false;
  const allPosts = [...db.posts.values()];
  const result: Array<{
    thread: Thread;
    space: Space;
    postCount: number;
    lastPostAt: number;
  }> = [];
  for (const thread of db.threads.values()) {
    const space = db.spaces.get(thread.spaceId);
    if (!space) continue;
    touchLifecycle(space);
    if (!includeArchived && space.lifecycle === "archived") continue;
    const posts = allPosts.filter((p) => p.threadId === thread.id);
    const lastPostAt = posts.reduce(
      (acc, p) => Math.max(acc, p.createdAt),
      thread.createdAt
    );
    result.push({ thread, space, postCount: posts.length, lastPostAt });
  }
  // ざっくり: 最新投稿の新しさ + 投稿数 を組合せ
  result.sort((a, b) => {
    const recencyA =
      Math.pow(0.5, (Date.now() - a.lastPostAt) / (1000 * 60 * 60 * 24)) *
        10 +
      a.postCount;
    const recencyB =
      Math.pow(0.5, (Date.now() - b.lastPostAt) / (1000 * 60 * 60 * 24)) *
        10 +
      b.postCount;
    return recencyB - recencyA;
  });
  return result.slice(0, limit);
}

// ---- 管理画面用の参照API ----

export function isAnyAdmin(userId: string): boolean {
  const u = getDB().users.get(userId);
  return !!u && u.isAdminOf.length > 0;
}

export function isPlatformAdmin(userId: string): boolean {
  return PLATFORM_ADMIN_IDS.has(userId);
}

export function listReportedPosts(spaceIds?: string[]): Post[] {
  const db = getDB();
  return [...db.posts.values()]
    .filter((p) => p.reportCount > 0)
    .filter((p) => !spaceIds || spaceIds.includes(p.spaceId))
    .sort((a, b) => b.reportCount - a.reportCount);
}

export function listSunkPosts(spaceIds?: string[]): Post[] {
  const db = getDB();
  return [...db.posts.values()]
    .filter((p) => p.isSunk)
    .filter((p) => !spaceIds || spaceIds.includes(p.spaceId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function listModerationLog(spaceIds?: string[], limit = 100) {
  const db = getDB();
  return [...db.moderation]
    .filter((m) => !spaceIds || spaceIds.includes(m.spaceId))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

// ---- 場の物理係数を編集 (管理者専用) ----

export function updateSpaceGravityConfig(
  spaceId: string,
  byUserId: string,
  config: SpaceGravityConfig | null
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };
  const u = db.users.get(byUserId);
  if (!u || !u.isAdminOf.includes(spaceId)) return { error: "forbidden" };
  if (config === null) {
    delete space.gravityConfig;
  } else {
    space.gravityConfig = sanitizeGravityConfig(config);
  }
  space.lastAdminActionAt = Date.now();
  touchLifecycle(space);
  db.moderation.push({
    id: `m_${Math.random().toString(36).slice(2, 10)}`,
    spaceId,
    byUserId,
    kind: "define",
    payload: { gravityConfig: space.gravityConfig ?? null },
    at: Date.now(),
  });
  persist();
  return space;
}

// 場管理者の付与。既存管理者またはプラットフォーム管理者のみ実行可能。
export function grantAdminRole(
  spaceId: string,
  byUserId: string,
  targetUserId: string
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };

  const actor = db.users.get(byUserId);
  const canManageRole =
    !!actor && (actor.isAdminOf.includes(spaceId) || isPlatformAdmin(byUserId));
  if (!canManageRole) return { error: "forbidden" };

  const target = db.users.get(targetUserId);
  if (!target) return { error: "user_not_found" };

  if (space.adminIds.includes(targetUserId)) {
    return { error: "already_admin" };
  }

  space.adminIds.push(targetUserId);
  if (!target.isAdminOf.includes(spaceId)) {
    target.isAdminOf.push(spaceId);
  }

  space.lastAdminActionAt = Date.now();
  touchLifecycle(space);
  db.moderation.push({
    id: `m_${Math.random().toString(36).slice(2, 10)}`,
    spaceId,
    byUserId,
    kind: "grant_admin",
    payload: { targetUserId },
    at: Date.now(),
  });
  persist();
  return space;
}

// 場管理者の剥奪。最後の管理者は剥奪不可。
export function revokeAdminRole(
  spaceId: string,
  byUserId: string,
  targetUserId: string
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };

  const actor = db.users.get(byUserId);
  const canManageRole =
    !!actor && (actor.isAdminOf.includes(spaceId) || isPlatformAdmin(byUserId));
  if (!canManageRole) return { error: "forbidden" };

  if (!space.adminIds.includes(targetUserId)) {
    return { error: "target_not_admin" };
  }
  if (space.adminIds.length <= 1) {
    return { error: "last_admin_protected" };
  }

  space.adminIds = space.adminIds.filter((id) => id !== targetUserId);
  const target = db.users.get(targetUserId);
  if (target) {
    target.isAdminOf = target.isAdminOf.filter((id) => id !== spaceId);
  }

  space.lastAdminActionAt = Date.now();
  touchLifecycle(space);
  db.moderation.push({
    id: `m_${Math.random().toString(36).slice(2, 10)}`,
    spaceId,
    byUserId,
    kind: "revoke_admin",
    payload: { targetUserId },
    at: Date.now(),
  });
  persist();
  return space;
}

function clampPositive(n: unknown, min = 0, max = 1e6): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function sanitizeGravityConfig(cfg: SpaceGravityConfig): SpaceGravityConfig {
  const out: SpaceGravityConfig = {};
  const h = clampPositive(cfg.halfLifeHours, 0.5, 24 * 365);
  if (h !== undefined) out.halfLifeHours = h;
  const rw = clampPositive(cfg.replyWeight);
  if (rw !== undefined) out.replyWeight = rw;
  const pw = clampPositive(cfg.participantWeight);
  if (pw !== undefined) out.participantWeight = pw;
  const rp = clampPositive(cfg.reportPenalty, 0, 1);
  if (rp !== undefined) out.reportPenalty = rp;
  const sd = clampPositive(cfg.sunkDamp, 0, 1);
  if (sd !== undefined) out.sunkDamp = sd;
  const seed = clampPositive(cfg.seed);
  if (seed !== undefined) out.seed = seed;
  const pb = clampPositive(cfg.pinBonus);
  if (pb !== undefined) out.pinBonus = pb;
  const ub = clampPositive(cfg.userMassBonus, 0, 10);
  if (ub !== undefined) out.userMassBonus = ub;
  if (cfg.reactionWeight) {
    const rw2: Partial<Record<ReactionKind, number>> = {};
    for (const k of Object.keys(cfg.reactionWeight) as ReactionKind[]) {
      const v = clampPositive(cfg.reactionWeight[k]);
      if (v !== undefined) rw2[k] = v;
    }
    if (Object.keys(rw2).length > 0) out.reactionWeight = rw2;
  }
  return out;
}

// succession 中の立候補を取り下げる
export function withdrawCandidacy(
  spaceId: string,
  byUserId: string
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };
  touchLifecycle(space);
  if (space.lifecycle !== "succession") return { error: "not_in_succession" };
  const list = space.candidates ?? [];
  const next = list.filter((c) => c.userId !== byUserId);
  if (next.length === list.length) return { error: "not_a_candidate" };
  space.candidates = next;
  persist();
  return space;
}

// 管理者が活動猶予を宣言 (最大 MAX_VACATION_MS)
export function declareVacation(
  spaceId: string,
  byUserId: string,
  durationMs: number
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };
  const u = db.users.get(byUserId);
  if (!u || !u.isAdminOf.includes(spaceId)) return { error: "forbidden" };
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { error: "invalid_duration" };
  }
  const capped = Math.min(durationMs, MAX_VACATION_MS);
  space.vacationUntil = Date.now() + capped;
  // vacation 宣言自体を管理者活動として扱う
  space.lastAdminActionAt = Date.now();
  touchLifecycle(space);
  persist();
  return space;
}

// ---- 場のライフサイクル / 継承 ----

// succession 期間中の立候補。誰でも可能 (閾値は将来導入)。
export function applyForSpaceAdmin(
  spaceId: string,
  byUserId: string
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };
  touchLifecycle(space);
  if (space.lifecycle !== "succession") return { error: "not_in_succession" };
  const user = db.users.get(byUserId);
  if (!user) return { error: "user_not_found" };
  const list = space.candidates ?? [];
  if (list.some((c) => c.userId === byUserId)) {
    return { error: "already_candidate" };
  }
  list.push({ userId: byUserId, statedAt: Date.now() });
  space.candidates = list;
  persist();
  return space;
}

// succession 期限到来時の確定処理。
//  - 立候補1名以上: 先頭1名を admin に昇格して active へ
//  - 立候補ゼロ   : archived へ (時間凍結)
// 呼び出しは外部 (cron 不要、読み取り時の遅延評価でも可) を想定。
export function finalizeSuccession(
  spaceId: string
): Space | { error: string } {
  const db = getDB();
  const space = db.spaces.get(spaceId);
  if (!space) return { error: "space_not_found" };
  touchLifecycle(space);
  if (space.lifecycle !== "succession") return { error: "not_in_succession" };
  const now = Date.now();
  const deadline = space.successionDeadline ?? now;
  if (now < deadline) return { error: "not_yet" };

  const candidates = space.candidates ?? [];
  if (candidates.length === 0) {
    space.lifecycle = "archived";
    space.lifecycleSince = now;
    space.frozenAt = now;
    space.successionDeadline = undefined;
    space.candidates = undefined;
    persist();
    return space;
  }

  // MVP: 立候補順で先頭1名を承認 (将来: 投票や質量しきい値)
  const winner = candidates[0];
  const newAdmin = db.users.get(winner.userId);
  if (newAdmin && !newAdmin.isAdminOf.includes(spaceId)) {
    newAdmin.isAdminOf.push(spaceId);
  }
  if (!space.adminIds.includes(winner.userId)) {
    space.adminIds.push(winner.userId);
  }
  space.lifecycle = "active";
  space.lifecycleSince = now;
  space.lastAdminActionAt = now;
  space.successionDeadline = undefined;
  space.candidates = undefined;
  persist();
  return space;
}
