// ドメイン型定義
// 思想:
//  - 場(Space)が主役。投稿(Post)は「場」への作用として評価される
//  - 匿名(anonymous) / 記名(named) は投稿ごとに切替可能
//  - 管理者(admin)は記名強制で責任を可視化する

export type UserId = string;
export type SpaceId = string;
export type ThreadId = string;
export type PostId = string;

export type IdentityMode = "anonymous" | "named";

export type ReactionKind =
  | "kusa" // 草: 場の電流を流した
  | "useful" // 良論: 場の文脈に寄与
  | "patch" // 文脈パッチ: 概念を定義し直した
  | "debug"; // デバッグ完了: 澱みを解消した

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
}

export interface ReactionEvent {
  postId: PostId;
  byUserId: UserId;
  kind: ReactionKind;
  at: number;
}

export interface ModerationAction {
  id: string;
  spaceId: SpaceId;
  threadId?: ThreadId;
  postId?: PostId;
  byUserId: UserId;
  kind: "lift" | "sink" | "slow" | "pin" | "define";
  payload?: Record<string, unknown>;
  at: number;
  note?: string;
}
