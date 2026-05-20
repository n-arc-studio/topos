import type {
  ModerationAction,
  Post,
  ReactionKind,
  Space,
  Thread,
  User,
} from "@/lib/domain/types";

// MVP用の単純なメモリストア。
// 永続化は次フェーズで PostgreSQL に差し替える前提で、関数インターフェイスのみ公開する。

type DB = {
  users: Map<string, User>;
  spaces: Map<string, Space>;
  threads: Map<string, Thread>;
  posts: Map<string, Post>;
  moderation: ModerationAction[];
};

// Next.js dev のホットリロードでも一意に保つ
const g = globalThis as unknown as { __toposDB?: DB };

function emptyReactions(): Post["reactions"] {
  return { kusa: 0, useful: 0, patch: 0, debug: 0 };
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
      reactions: { kusa: 3, useful: 7, patch: 2, debug: 0 },
      isAdminPost: true,
    },
    {
      id: "p2",
      threadId: t1.id,
      spaceId: sTopos.id,
      authorId: "u_demo",
      identityMode: "anonymous",
      body: "結局フォロワー数ゲームじゃないSNSってどう成り立つの",
      createdAt: now - 1000 * 60 * 60 * 24 * 2,
      reactions: { kusa: 1, useful: 2, patch: 0, debug: 0 },
      isAdminPost: false,
    },
    {
      id: "p3",
      threadId: t1.id,
      spaceId: sTopos.id,
      authorId: admin.id,
      identityMode: "named",
      body: "「場の維持に貢献したか」をスコア化する。澱む発言は重力で下に沈み、流れを作る発言が上に浮く。",
      createdAt: now - 1000 * 60 * 60 * 12,
      reactions: { kusa: 4, useful: 10, patch: 3, debug: 1 },
      isAdminPost: true,
    },
    {
      id: "p4",
      threadId: t2.id,
      spaceId: sLang.id,
      authorId: "u_demo",
      identityMode: "anonymous",
      body: "敬語=マナーって認識自体が日本語OSのバグだと思う",
      createdAt: now - 1000 * 60 * 60 * 6,
      reactions: { kusa: 5, useful: 4, patch: 1, debug: 0 },
      isAdminPost: false,
    },
  ];
  for (const p of seedPosts) posts.set(p.id, p);

  return { users, spaces, threads, posts, moderation: [] };
}

function getDB(): DB {
  if (!g.__toposDB) g.__toposDB = seed();
  return g.__toposDB;
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
  }
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
    reactions: emptyReactions(),
    isAdminPost: isAdmin,
    replyTo: input.replyTo,
  };
  db.posts.set(p.id, p);
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
  post.reactions[input.kind] = (post.reactions[input.kind] ?? 0) + 1;

  // 質量を著者に加算 (匿名と記名で別管理)
  const author = db.users.get(post.authorId);
  if (author) {
    const w = { kusa: 1, useful: 2, patch: 4, debug: 5 }[input.kind];
    if (post.identityMode === "named") author.publicMass += w;
    else author.anonymousMass += w;
  }
  return post;
}

export function isAdmin(userId: string, spaceId: string): boolean {
  const u = getDB().users.get(userId);
  return !!u?.isAdminOf.includes(spaceId);
}
