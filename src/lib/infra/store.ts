import type {
  ModerationAction,
  Post,
  ReactionKind,
  Space,
  Thread,
  User,
} from "@/lib/domain/types";
import type { SpaceGravityConfig } from "@/lib/domain/gravity-config";
import { loadDBSync, scheduleSave } from "./persistence";

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
};

// スキーマ変更時はインクリメント。古い DB は破棄して再シードする。
const SCHEMA_VERSION = 2;

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
  };
  const sLang: Space = {
    id: "s_lang",
    name: "日本語OS解析",
    charter:
      "日本語というOSのソースコード(敬語・主語省略・文脈依存)をデバッグする場。",
    adminIds: [admin.id],
    createdAt: now - 1000 * 60 * 60 * 24 * 14,
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
  };
}

function getDB(): DB {
  if (!g.__toposDB || g.__toposDB.schemaVersion !== SCHEMA_VERSION) {
    const loaded = loadDBSync(SCHEMA_VERSION);
    g.__toposDB = loaded ?? seed();
    if (!loaded) scheduleSave(g.__toposDB);
  }
  return g.__toposDB;
}

function persist(): void {
  if (g.__toposDB) scheduleSave(g.__toposDB);
}

// ---- 公開API ----

export function listSpaces(): Space[] {
  return [...getDB().spaces.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getSpace(id: string): Space | undefined {
  return getDB().spaces.get(id);
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
  if (!db.spaces.has(input.spaceId)) return { error: "space_not_found" };
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
  if (post.authorId === input.byUserId) return { error: "self_reaction" };

  const key = `${input.byUserId}:${input.postId}:${input.kind}`;
  if (db.reactionLog.has(key)) return { error: "already_reacted" };
  db.reactionLog.add(key);

  post.reactions[input.kind] = (post.reactions[input.kind] ?? 0) + 1;

  // 質量を著者に加算 (匿名と記名で別管理)
  const author = db.users.get(post.authorId);
  if (author) {
    const w = MASS_WEIGHT[input.kind];
    if (post.identityMode === "named") author.publicMass += w;
    else author.anonymousMass += w;
  }
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
  if (post.authorId === input.byUserId) return { error: "self_report" };

  const key = `${input.byUserId}:${input.postId}`;
  if (db.reportLog.has(key)) return { error: "already_reported" };
  db.reportLog.add(key);

  post.reportCount += 1;

  // 一定数を超えたら自動沈降
  if (!post.isSunk && post.reportCount >= AUTO_SINK_REPORT_THRESHOLD) {
    post.isSunk = true;
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
export function listHotThreads(limit = 5): Array<{
  thread: Thread;
  space: Space;
  postCount: number;
  lastPostAt: number;
}> {
  const db = getDB();
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
