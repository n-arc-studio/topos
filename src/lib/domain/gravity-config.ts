// 場ごとに上書き可能な物理パラメータの型。
// types.ts と gravity.ts の循環参照を避けるため独立ファイル。
import type { ReactionKind } from "./types";

export interface SpaceGravityConfig {
  halfLifeHours?: number;
  replyWeight?: number;
  participantWeight?: number;
  reportPenalty?: number;
  sunkDamp?: number;
  seed?: number;
  pinBonus?: number;
  userMassBonus?: number;
  reactionWeight?: Partial<Record<ReactionKind, number>>;
}
