import type { Post, ReactionKind } from "./types";

// 重力スコア (= 浮力) の計算。
//
// 設計方針 (issue #1):
//  1) 内容の強さ      : リアクションの種類別重み
//  2) 会話の活性      : 返信数と参加者数 (場が動いた証拠)
//  3) ノイズ抑制      : 通報数で減点 / 沈降フラグで強い減衰
//  4) 時間減衰        : 24h 半減期 (深い会話が極端に死なない程度)
//  5) ピン留め優先    : 管理者がピン留めしたものは常に最上位扱い
//
// 数式 (概要):
//   content   = Σ reactions[k] * REACTION_WEIGHT[k]
//   activity  = sqrt(replyCount) * REPLY_W + sqrt(participants) * PARTICIPANT_W
//   noise     = max(0, 1 - reportCount * REPORT_PENALTY)
//   sunkMul   = isSunk ? SUNK_DAMP : 1
//   decay     = 0.5 ^ (hours / HALF_LIFE_HOURS)
//   base      = (content + activity + SEED) * decay * noise * sunkMul
//   gravity   = isPinned ? base + PIN_BONUS : base

const REACTION_WEIGHT: Record<ReactionKind, number> = {
  like: 1.0, // 軽い肯定: 場の電流
  useful: 3.0, // 情報価値: 残るべき発言
  laugh: 2.0, // 場の温度: 笑いは場を温める
  tsukkomi: 2.5, // 会話を回す返し
  agree: 2.5, // 理解の前進
};

const HALF_LIFE_HOURS = 24;

// 会話活性の係数。返信数より参加者数のほうが「場」としては重い。
const REPLY_W = 1.6;
const PARTICIPANT_W = 2.2;

// 通報1件あたりの減衰率 (3件で 1.0 - 0.9 = 0.1 まで落ちる)
const REPORT_PENALTY = 0.3;

// 沈降フラグが立った投稿の重力倍率
const SUNK_DAMP = 0.1;

// 新規投稿に与える種(seed)の重力。コールドスタート緩和。
const SEED = 0.6;

// ピン留め時の追加重力 (常に上に置く)
const PIN_BONUS = 1000;

export interface ConversationStats {
  replyCount: number;
  participants: number;
}

export function reactionScore(reactions: Post["reactions"]): number {
  let s = 0;
  for (const k of Object.keys(reactions) as ReactionKind[]) {
    s += (reactions[k] ?? 0) * REACTION_WEIGHT[k];
  }
  return s;
}

export function ageDecay(createdAt: number, now: number = Date.now()): number {
  const hours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  return Math.pow(0.5, hours / HALF_LIFE_HOURS);
}

function activityScore(stats?: ConversationStats): number {
  if (!stats) return 0;
  return (
    Math.sqrt(Math.max(0, stats.replyCount)) * REPLY_W +
    Math.sqrt(Math.max(0, stats.participants)) * PARTICIPANT_W
  );
}

function noiseFactor(reportCount: number): number {
  return Math.max(0, 1 - reportCount * REPORT_PENALTY);
}

export function gravityScore(
  post: Post,
  now: number = Date.now(),
  stats?: ConversationStats
): number {
  const content = reactionScore(post.reactions);
  const activity = activityScore(stats);
  const decay = ageDecay(post.createdAt, now);
  const noise = noiseFactor(post.reportCount ?? 0);
  const sunkMul = post.isSunk ? SUNK_DAMP : 1;
  const base = (content + activity + SEED) * decay * noise * sunkMul;
  return post.isPinned ? base + PIN_BONUS : base;
}

// 「沈殿度」 0..1。1に近いほど深淵に沈む (UIの透明度などに利用)
export function sedimentLevel(
  post: Post,
  now: number = Date.now(),
  stats?: ConversationStats
): number {
  const g = gravityScore(post, now, stats);
  return 1 / (1 + g / 3);
}

// スレッド全体から、各投稿の返信数と参加者数を集計する。
// 子孫を含む一意参加者数を数えるため、まず親子のインデックスを作る。
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
    set.delete(p.authorId); // 自分は除外
    participants[p.id] = set.size;
  }

  return { replyCountByPost: replyCount, participantsByPost: participants };
}
