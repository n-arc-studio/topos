import type { Post, ReactionKind } from "./types";

// 反応の重み: 「いいね数」ではなく「場への寄与」の質に応じて配点
const REACTION_WEIGHT: Record<ReactionKind, number> = {
  kusa: 1.0, // 草: 電流の指標
  useful: 2.0, // 良論: 文脈寄与
  patch: 4.0, // 文脈パッチ: 概念の更新
  debug: 5.0, // デバッグ完了: 澱みの解消
};

// 半減期(時間)。古い投稿は重力を失い、自然に沈む (熱力学第二法則のメタファー)
const HALF_LIFE_HOURS = 24;

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

// 重力スコア (= 浮力)。大きいほど上に浮く
export function gravityScore(post: Post, now: number = Date.now()): number {
  const base = reactionScore(post.reactions);
  const decay = ageDecay(post.createdAt, now);
  // 新規投稿には小さな浮力を与え、コールドスタートを防ぐ
  const seed = 0.5;
  return (base + seed) * decay;
}

// 「沈殿度」 0..1。1に近いほど深淵に沈む
export function sedimentLevel(post: Post, now: number = Date.now()): number {
  const g = gravityScore(post, now);
  // ざっくり: g=0 → 1.0、g=5 → 0.5、g=15+ → ほぼ0
  return 1 / (1 + g / 3);
}
