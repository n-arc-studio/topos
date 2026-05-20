import type { Post, ReactionKind, User } from "./types";
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
