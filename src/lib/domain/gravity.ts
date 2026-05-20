import type { Post, ReactionKind, User, GravityEvent } from "./types";
import type { SpaceGravityConfig } from "./gravity-config";

export type { SpaceGravityConfig } from "./gravity-config";

// 重力スコア (= 浮力) の計算。
//
// 設計方針:
//  1) 内容の強さ      : リアクションの種類別重み
//  2) 会話の活性      : 返信数と参加者数
//  3) ノイズ抑制      : 通報数 / 沈降フラグ
//  4) 時間減衰        : 半減期で指数減衰 (場ごとに上書き可)
//  5) 著者の質量      : 質量保有者を僅かに浮かせる (対数スケール)
//  6) ピン留め優先    : 常に最上位扱い

export const DEFAULT_REACTION_WEIGHT: Record<ReactionKind, number> = {
  like: 1.0,
  useful: 3.0,
  laugh: 2.0,
  tsukkomi: 2.5,
  agree: 2.5,
};

export const DEFAULT_HALF_LIFE_HOURS = 24;
export const DEFAULT_REPLY_W = 1.6;
export const DEFAULT_PARTICIPANT_W = 2.2;
export const DEFAULT_REPORT_PENALTY = 0.3;
export const DEFAULT_SUNK_DAMP = 0.1;
export const DEFAULT_SEED = 0.6;
export const DEFAULT_PIN_BONUS = 1000;
// 質量ボーナス: log10(1 + mass) * USER_MASS_BONUS を加算する。
// mass=10 で +1.04, mass=100 で +2.0, mass=1000 で +3.0 と緩やかに伸びる。
export const DEFAULT_USER_MASS_BONUS = 1.0;

export interface GravityConfig extends SpaceGravityConfig {}

interface ResolvedGravityConfig {
  halfLifeHours: number;
  replyWeight: number;
  participantWeight: number;
  reportPenalty: number;
  sunkDamp: number;
  seed: number;
  pinBonus: number;
  userMassBonus: number;
  reactionWeight: Record<ReactionKind, number>;
}

function resolveConfig(cfg?: GravityConfig): ResolvedGravityConfig {
  return {
    halfLifeHours: cfg?.halfLifeHours ?? DEFAULT_HALF_LIFE_HOURS,
    replyWeight: cfg?.replyWeight ?? DEFAULT_REPLY_W,
    participantWeight: cfg?.participantWeight ?? DEFAULT_PARTICIPANT_W,
    reportPenalty: cfg?.reportPenalty ?? DEFAULT_REPORT_PENALTY,
    sunkDamp: cfg?.sunkDamp ?? DEFAULT_SUNK_DAMP,
    seed: cfg?.seed ?? DEFAULT_SEED,
    pinBonus: cfg?.pinBonus ?? DEFAULT_PIN_BONUS,
    userMassBonus: cfg?.userMassBonus ?? DEFAULT_USER_MASS_BONUS,
    reactionWeight: {
      ...DEFAULT_REACTION_WEIGHT,
      ...(cfg?.reactionWeight ?? {}),
    },
  };
}

export interface ConversationStats {
  replyCount: number;
  participants: number;
}

export function reactionScore(
  reactions: Post["reactions"],
  weights: Record<ReactionKind, number> = DEFAULT_REACTION_WEIGHT
): number {
  let s = 0;
  for (const k of Object.keys(weights) as ReactionKind[]) {
    const n = reactions?.[k];
    if (typeof n === "number" && Number.isFinite(n)) {
      s += n * weights[k];
    }
  }
  return s;
}

export function ageDecay(
  createdAt: number,
  now: number = Date.now(),
  halfLifeHours: number = DEFAULT_HALF_LIFE_HOURS
): number {
  const hours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  return Math.pow(0.5, hours / halfLifeHours);
}

function activityScore(
  stats: ConversationStats | undefined,
  cfg: ResolvedGravityConfig
): number {
  if (!stats) return 0;
  return (
    Math.sqrt(Math.max(0, stats.replyCount)) * cfg.replyWeight +
    Math.sqrt(Math.max(0, stats.participants)) * cfg.participantWeight
  );
}

function noiseFactor(reportCount: number, penalty: number): number {
  return Math.max(0, 1 - reportCount * penalty);
}

function authorMassBonus(
  post: Post,
  author: User | undefined,
  bonus: number
): number {
  if (!author || bonus <= 0) return 0;
  const mass =
    post.identityMode === "named" ? author.publicMass : author.anonymousMass;
  if (!Number.isFinite(mass) || mass <= 0) return 0;
  return Math.log10(1 + mass) * bonus;
}

export interface GravityContext {
  now?: number;
  stats?: ConversationStats;
  author?: User;
  config?: GravityConfig;
}

export function gravityScore(post: Post, ctx: GravityContext = {}): number {
  const cfg = resolveConfig(ctx.config);
  const now = ctx.now ?? Date.now();
  const content = reactionScore(post.reactions, cfg.reactionWeight);
  const activity = activityScore(ctx.stats, cfg);
  const decay = ageDecay(post.createdAt, now, cfg.halfLifeHours);
  const noise = noiseFactor(post.reportCount ?? 0, cfg.reportPenalty);
  const sunkMul = post.isSunk ? cfg.sunkDamp : 1;
  const mass = authorMassBonus(post, ctx.author, cfg.userMassBonus);
  const base = (content + activity + cfg.seed + mass) * decay * noise * sunkMul;
  return post.isPinned ? base + cfg.pinBonus : base;
}

export function sedimentLevel(post: Post, ctx: GravityContext = {}): number {
  const g = gravityScore(post, ctx);
  return 1 / (1 + g / 3);
}

export function computeStats(posts: Post[]): {
  replyCountByPost: Record<string, number>;
  participantsByPost: Record<string, number>;
} {
  const children: Record<string, Post[]> = {};
  for (const p of posts) {
    if (p.replyTo) {
      (children[p.replyTo] ||= []).push(p);
    }
  }

  const replyCount: Record<string, number> = {};
  const participants: Record<string, number> = {};

  function collectAuthors(rootId: string, acc: Set<string>) {
    const cs = children[rootId];
    if (!cs) return;
    for (const c of cs) {
      acc.add(c.authorId);
      collectAuthors(c.id, acc);
    }
  }

  for (const p of posts) {
    const direct = children[p.id]?.length ?? 0;
    replyCount[p.id] = direct;
    const set = new Set<string>();
    collectAuthors(p.id, set);
    set.delete(p.authorId);
    participants[p.id] = set.size;
  }

  return { replyCountByPost: replyCount, participantsByPost: participants };
}

// 沈殿の深さを離散層に分類する (沈殿層ビューア用)
export type SedimentLayer = "surface" | "shallow" | "deep" | "abyss";

export function sedimentLayer(sediment: number): SedimentLayer {
  if (sediment < 0.25) return "surface";
  if (sediment < 0.55) return "shallow";
  if (sediment < 0.8) return "deep";
  return "abyss";
}

export const LAYER_LABEL: Record<SedimentLayer, string> = {
  surface: "表層",
  shallow: "中層",
  deep: "深層",
  abyss: "最深層",
};

export const LAYER_ORDER: SedimentLayer[] = [
  "surface",
  "shallow",
  "deep",
  "abyss",
];

// ---- イベント駆動の重力履歴 ----
//
// 設計:
//  - 現在の post.reactions / reportCount / isSunk / isPinned は「ストア上の最新状態」
//  - events は重力を変化させた瞬間の時系列ログ (reaction / report / sink / unsink / pin / unpin)
//  - 時刻 t におけるスナップショットは「現在の状態から t より後のイベントを巻き戻す」ことで得る
//  - イベントが空の seed 投稿は、状態が常に最新であったかのように扱う (純粋な指数減衰)
//  - stats (返信数・参加者数) は厳密な時系列再生をしないため、現在値を使う
function buildPostSnapshotAt(
  post: Post,
  events: GravityEvent[],
  t: number
): Post {
  const reactions: Record<ReactionKind, number> = {
    ...post.reactions,
  } as Record<ReactionKind, number>;
  let reportCount = post.reportCount;
  let isSunk = post.isSunk;
  let isPinned = post.isPinned;
  // 新しいイベントから巻き戻す (t より後のものを取り消す)
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.at <= t) break; // 配列が時系列昇順である前提
    switch (e.type) {
      case "reaction":
        if (e.reactionKind && reactions[e.reactionKind] > 0) {
          reactions[e.reactionKind] -= 1;
        }
        break;
      case "report":
        reportCount = Math.max(0, reportCount - 1);
        break;
      case "sink":
        isSunk = false;
        break;
      case "unsink":
        isSunk = true;
        break;
      case "pin":
        isPinned = false;
        break;
      case "unpin":
        isPinned = true;
        break;
    }
  }
  return { ...post, reactions, reportCount, isSunk, isPinned };
}

// 任意時刻 t における重力スコア (イベント履歴を考慮)
export function gravityAt(
  post: Post,
  events: GravityEvent[],
  t: number,
  ctx: Omit<GravityContext, "now"> = {}
): number {
  // イベント配列はストアで時系列昇順だが念のためソート
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const snapshot = buildPostSnapshotAt(post, sorted, t);
  return gravityScore(snapshot, { ...ctx, now: t });
}
