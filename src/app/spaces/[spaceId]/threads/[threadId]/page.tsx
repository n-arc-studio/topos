import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPostEditability,
  getSpace,
  getThread,
  getUser,
  isAdmin,
  listUsers,
  listPostEvents,
  listPosts,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";
import {
  computeStats,
  gravityScore,
  sedimentLayer,
  sedimentLevel,
  LAYER_LABEL,
  LAYER_ORDER,
  type SedimentLayer,
  type GravityContext,
} from "@/lib/domain/gravity";
import type { Post } from "@/lib/domain/types";
import { AuthGate } from "@/components/AuthGate";
import { currentUser } from "@/lib/session/identity";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { ReplyHashResolver } from "@/components/ReplyHashResolver";
import { currentTimeMs } from "@/lib/time";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string; threadId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  await refreshStoreFromPersistence();
  const { spaceId, threadId } = await params;
  const { view } = await searchParams;
  const space = getSpace(spaceId);
  const thread = getThread(threadId);
  if (!space || !thread || thread.spaceId !== space.id) notFound();
  // notFound() は never を返すが、クロージャ内 narrowing のため再束縛
  const currentSpace = space;
  const currentThread = thread;

  const me = await currentUser();
  const meIsAdmin = me ? isAdmin(me.id, currentSpace.id) : false;
  const meId = me?.id ?? null;
  const layered = view === "layers";

  const now = currentTimeMs();
  const allPosts = listPosts(currentThread.id);
  const latestPostId =
    allPosts.length > 0
      ? allPosts.reduce((latest, p) => (p.createdAt > latest.createdAt ? p : latest), allPosts[0])
          .id
      : null;
  const postById = new Map(allPosts.map((p) => [p.id, p]));
  const editabilityByPostId = new Map<string, { canEdit: boolean; reason?: string }>();
  if (meId) {
    for (const p of allPosts) {
      editabilityByPostId.set(p.id, getPostEditability(p.id, meId, now));
    }
  }
  const stats = computeStats(allPosts);
  const gravityByPostId: Record<string, number> = {};

  function ctxOf(p: Post): GravityContext {
    return {
      now,
      stats: {
        replyCount: stats.replyCountByPost[p.id] ?? 0,
        participants: stats.participantsByPost[p.id] ?? 0,
      },
      author: getUser(p.authorId),
      config: currentSpace.gravityConfig,
    };
  }
  function scoreOf(p: Post): number {
    const cached = gravityByPostId[p.id];
    if (cached !== undefined) return cached;
    const g = gravityScore(p, ctxOf(p));
    gravityByPostId[p.id] = g;
    return g;
  }

  for (const p of allPosts) scoreOf(p);

  const totalGravity = allPosts.reduce((sum, p) => sum + scoreOf(p), 0);
  const maxGravity =
    allPosts.length > 0 ? Math.max(...allPosts.map((p) => scoreOf(p))) : 0;
  const myPosts = meId ? allPosts.filter((p) => p.authorId === meId) : [];
  const myGravity = myPosts.reduce((sum, p) => sum + scoreOf(p), 0);
  const myGravityShare =
    totalGravity > 0 ? Math.min(1, myGravity / totalGravity) : 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStartMs = today.getTime();
  const myTodayPosts = myPosts.filter((p) => p.createdAt >= todayStartMs).length;

  const rankedUsers = listUsers()
    .map((u) => ({
      user: u,
      totalMass: (u.publicMass ?? 0) + (u.anonymousMass ?? 0),
    }))
    .sort((a, b) => b.totalMass - a.totalMass);
  const massRankingLimit = 5;
  const massTop = rankedUsers.slice(0, massRankingLimit);
  const hiddenMassCount = Math.max(0, rankedUsers.length - massRankingLimit);
  const meMassRank = meId
    ? rankedUsers.findIndex((entry) => entry.user.id === meId) + 1
    : 0;

  type Flat = { post: Post; depth: number };
  const flat: Flat[] = [];

  if (layered) {
    // 沈殿層モード: 深さ別に層分けして表示 (時系列ツリーは無視)
    for (const p of allPosts) flat.push({ post: p, depth: 0 });
  } else {
    const byParent: Record<string, Post[]> = {};
    const roots: Post[] = [];
    for (const p of allPosts) {
      if (p.replyTo) (byParent[p.replyTo] ||= []).push(p);
      else roots.push(p);
    }
    roots.sort((a, b) => scoreOf(b) - scoreOf(a));
    for (const k of Object.keys(byParent)) {
      byParent[k].sort((a, b) => a.createdAt - b.createdAt);
    }
    function walk(p: Post, depth: number) {
      flat.push({ post: p, depth });
      const cs = byParent[p.id];
      if (!cs) return;
      for (const c of cs) walk(c, depth + 1);
    }
    for (const r of roots) walk(r, 0);
  }

  // 層分けはモードに関わらず計算しておく (描画分岐で使う)
  const layerGroups: Record<SedimentLayer, Flat[]> = {
    surface: [],
    shallow: [],
    deep: [],
    abyss: [],
  };
  for (const f of flat) {
    const s = sedimentLevel(f.post, ctxOf(f.post));
    layerGroups[sedimentLayer(s)].push(f);
  }

  function renderCard(f: Flat) {
    const author = getUser(f.post.authorId);
    const displayName =
      f.post.identityMode === "named" && author ? author.displayName : "名無し";
    const parentPost = f.post.replyTo ? postById.get(f.post.replyTo) : undefined;
    const parentAuthor = parentPost ? getUser(parentPost.authorId) : undefined;
    const parentDisplayName =
      parentPost && parentPost.identityMode === "named" && parentAuthor
        ? parentAuthor.displayName
        : "名無し";
    const ctx = ctxOf(f.post);
    const g = scoreOf(f.post);
    const s = sedimentLevel(f.post, ctx);
    const isMyPost = !!meId && f.post.authorId === meId;
    const editability = isMyPost
      ? editabilityByPostId.get(f.post.id) ?? { canEdit: false }
      : { canEdit: false };
    const distortionLevel = maxGravity > 0 ? Math.min(1, g / maxGravity) : 0;
    return (
      <PostCard
        key={f.post.id}
        post={f.post}
        displayName={displayName}
        gravity={g}
        sediment={s}
        replyCount={stats.replyCountByPost[f.post.id] ?? 0}
        participants={stats.participantsByPost[f.post.id] ?? 0}
        meIsAdmin={meIsAdmin}
        meIsAnonymous={!meIsAdmin}
        canDelete={!!me && (meIsAdmin || f.post.authorId === meId)}
        canEdit={editability.canEdit}
        editDisabledReason={editability.reason}
        threadId={currentThread.id}
        depth={layered ? 0 : f.depth}
        halfLifeHours={currentSpace.gravityConfig?.halfLifeHours}
        events={listPostEvents(f.post.id)}
        isMyPost={isMyPost}
        distortionLevel={distortionLevel}
        replyContext={
          parentPost
            ? {
                postId: parentPost.id,
                displayName: parentDisplayName,
                body: parentPost.body,
                createdAt: parentPost.createdAt,
                lagMs: Math.max(0, f.post.createdAt - parentPost.createdAt),
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ReplyHashResolver latestPostId={latestPostId} />
      <section>
        <Link
          href={`/spaces/${currentSpace.id}`}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          ← {currentSpace.name}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{currentThread.title}</h1>
        <p className="mt-2 text-xs text-[var(--muted)]">
          まず本文を読み、必要な投稿に返信してください。補助情報は下の折りたたみから確認できます。
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="#thread-stream"
            className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            投稿を読む
          </a>
          <a
            href="#composer"
            className="rounded bg-[var(--accent)] px-2.5 py-1 font-medium text-black"
          >
            返信を始める
          </a>
          <span className="text-[var(--muted)]">返信ボタンは各投稿にもあります</span>
        </div>
      </section>

      {/* 表示モード切替 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">表示:</span>
        <Link
          href={`/spaces/${currentSpace.id}/threads/${currentThread.id}`}
          className={`px-2 py-0.5 rounded border ${
            !layered
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          時系列ツリー
        </Link>
        <Link
          href={`/spaces/${currentSpace.id}/threads/${currentThread.id}?view=layers`}
          className={`px-2 py-0.5 rounded border ${
            layered
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          沈殿層
        </Link>
      </div>

      <section id="thread-stream">
        {flat.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)] space-y-3">
            <p>まだ投稿はありません。最初のひとことが場をつくります。</p>
            <div className="text-xs space-y-1">
              <p>例: 「このスレで先に定義したい言葉は?」</p>
              <p>例: 「ここまでの議論を3行で要約すると?」</p>
              <p>例: 「次に試す改善案を1つ挙げると?」</p>
            </div>
            {!me && (
              <p className="text-xs">
                <Link
                  href={`/login?next=${encodeURIComponent(`/spaces/${currentSpace.id}/threads/${currentThread.id}`)}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  ログイン
                </Link>{" "}
                すると、このスレッドですぐ投稿できます。
              </p>
            )}
          </div>
        ) : layered ? (
          <section className="space-y-6">
            {LAYER_ORDER.map((layer) => {
              const group = layerGroups[layer];
              if (group.length === 0) return null;
              // 各層内は重力が高い順
              group.sort(
                (a, b) =>
                  gravityScore(b.post, ctxOf(b.post)) -
                  gravityScore(a.post, ctxOf(a.post))
              );
              return (
                <div key={layer} className="space-y-2">
                  <header className="flex flex-wrap items-baseline gap-2 border-b border-[var(--border)] pb-1">
                    <h2 className="text-sm font-medium">{LAYER_LABEL[layer]}</h2>
                    <span className="text-xs text-[var(--muted)]">
                      {group.length} 件
                    </span>
                  </header>
                  <div className="gravity-stream space-y-2">{group.map(renderCard)}</div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="gravity-stream space-y-3">{flat.map(renderCard)}</section>
        )}
      </section>

      <section id="composer" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        {me ? (
          <details open={flat.length === 0}>
            <summary className="cursor-pointer text-sm font-medium">返信・投稿を開始する</summary>
            <div className="mt-3 space-y-3">
              <PostComposer
                threadId={currentThread.id}
                canBeAnonymous={!meIsAdmin}
                todayCount={myTodayPosts}
              />
              <details className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer font-medium text-[var(--foreground)]">投稿ガイド</summary>
                <div className="mt-2 space-y-1">
                  <p>迷ったら「問い」「要約」「反証」「改善提案」のどれか1つで始めてください。</p>
                  <p>
                    匿名は視点を出しやすく、記名は責任を明示しやすいモードです。
                  </p>
                </div>
              </details>
              {meIsAdmin && (
                <p className="text-xs text-[var(--warn)]">
                  あなたはこの場の管理者です。記名投稿のみ可能です(責任の可視化のため)。
                </p>
              )}
            </div>
          </details>
        ) : (
          <AuthGate message="投稿や返信にはログインが必要です。" />
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-[var(--muted)]">
            スレッド補助情報を表示する
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
              <h2 className="text-sm font-semibold">あなたの重力歪み</h2>
              {me ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-[var(--muted)]">
                    あなたの投稿がこのスレッド全体の重力に与えている影響
                  </p>
                  <div className="h-2 rounded-full bg-[var(--panel-2)] overflow-hidden border border-[var(--border)]">
                    <div
                      className="gravity-share-fill h-full bg-[var(--accent)] transition-all duration-700"
                      style={{ width: `${(myGravityShare * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>
                      歪み率 <strong>{(myGravityShare * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="text-[var(--muted)]">
                      あなたの重力 {myGravity.toFixed(1)} / 全体 {totalGravity.toFixed(1)}
                    </span>
                    <span className="text-[var(--muted)]">投稿数 {myPosts.length}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    まずは、この数字が今のスレッドでどれくらい効いているかを見てください。
                  </p>
                  <Link
                    href="/about/gravity-guide"
                    className="inline-flex text-xs text-[var(--accent)] hover:underline"
                  >
                    重力歪みの見方を詳しく読む →
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  ログインすると「自分がどれだけ場をゆがめているか」を可視化できます。
                </p>
              )}
            </article>

            <article className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
              <h2 className="text-sm font-semibold">質量ランキング</h2>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                  ランキングを表示する
                </summary>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {massTop.map((entry, index) => {
                    const isMe = !!meId && entry.user.id === meId;
                    return (
                      <li
                        key={entry.user.id}
                        className={`flex items-center justify-between rounded px-2 py-1 border ${
                          isMe
                            ? "border-[var(--accent)]"
                            : "border-transparent"
                        }`}
                        style={
                          isMe
                            ? {
                                backgroundColor:
                                  "color-mix(in oklab, var(--panel) 75%, var(--accent) 10%)",
                              }
                            : undefined
                        }
                      >
                        <span className="truncate">
                          {index + 1}. {entry.user.displayName}
                          {isMe ? " (あなた)" : ""}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {entry.totalMass.toFixed(1)} mass
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {hiddenMassCount > 0 && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    ほか {hiddenMassCount} 件は省略表示しています。
                  </p>
                )}
                {me && meMassRank > massRankingLimit && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    あなたの順位: {meMassRank}位
                  </p>
                )}
              </details>
            </article>
          </div>
        </details>
      </section>
    </div>
  );
}
