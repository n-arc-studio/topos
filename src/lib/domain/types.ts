// ドメイン型定義
// 思想:
//  - 場(Space)が主役。投稿(Post)は「場」への作用として評価される
//  - 匿名(anonymous) / 記名(named) は投稿ごとに切替可能
//  - 管理者(admin)は記名強制で責任を可視化する

import type { SpaceGravityConfig } from "./gravity-config";

export type UserId = string;
export type SpaceId = string;
export type ThreadId = string;
export type PostId = string;

export type IdentityMode = "anonymous" | "named";

// 反応の種類
//  - like     : いいね (軽い同意 / 一票)
//  - useful   : 参考になった (情報価値)
//  - laugh    : 笑った (面白さ・場の温度)
//  - tsukkomi : ツッコミ (会話を回す軽い返し / 突っ込み)
//  - agree    : なるほど (理解が進んだ)
export type ReactionKind = "like" | "useful" | "laugh" | "tsukkomi" | "agree";

export const REACTION_LABEL: Record<ReactionKind, string> = {
  like: "いいね",
  useful: "参考になった",
  laugh: "笑った",
  tsukkomi: "ツッコミ",
  agree: "なるほど",
};

export interface User {
  id: UserId;
  displayName: string;
  isAdminOf: SpaceId[]; // 場ごとの管理者権限
  publicMass: number; // 記名で得た質量
  anonymousMass: number; // 匿名で得た質量 (公的権威には変換しない)
}

export interface Space {
  id: SpaceId;
  name: string;
  charter: string; // 場の憲章 (どんな文脈を守るか)
  adminIds: UserId[];
  createdAt: number;
  // 場ごとの物理係数 (未指定は既定値)
  gravityConfig?: SpaceGravityConfig;
}

export interface Thread {
  id: ThreadId;
  spaceId: SpaceId;
  title: string;
  createdBy: UserId;
  createdAt: number;
}

export interface Post {
  id: PostId;
  threadId: ThreadId;
  spaceId: SpaceId;
  authorId: UserId; // 内部識別子 (匿名でも保持: 不正対策と質量集計のため)
  identityMode: IdentityMode;
  body: string;
  createdAt: number;
  reactions: Record<ReactionKind, number>;
  isAdminPost: boolean; // 投稿時点で管理者だったか (履歴のため)
  replyTo?: PostId;
  reportCount: number; // 通報数 (一定数で自動沈降)
  isPinned: boolean; // 管理者がピン留めしたか
  isSunk: boolean; // 管理者または自動沈降で沈められたか
}

// スレッド内で計算する会話統計 (重力スコアの会話活性成分に使う)
export interface ThreadStats {
  replyCountByPost: Record<PostId, number>;
  participantsByPost: Record<PostId, number>; // 子孫を含む一意参加者数
}

export interface ReactionEvent {
  postId: PostId;
  byUserId: UserId;
  kind: ReactionKind;
  at: number;
}

// 重力スコアに影響を与える時点付きイベント。GravityChart の時系列再生に用いる。
export type GravityEventType =
  | "reaction"
  | "report"
  | "sink"
  | "unsink"
  | "pin"
  | "unpin";

export interface GravityEvent {
  postId: PostId;
  type: GravityEventType;
  at: number;
  reactionKind?: ReactionKind; // type=="reaction" のとき
  byUserId?: UserId; // 参考: 誰が起こしたか
}

export interface ModerationAction {
  id: string;
  spaceId: SpaceId;
  threadId?: ThreadId;
  postId?: PostId;
  byUserId: UserId;
  kind: "lift" | "sink" | "slow" | "pin" | "define" | "unsink" | "unpin";
  payload?: Record<string, unknown>;
  at: number;
  note?: string;
}
