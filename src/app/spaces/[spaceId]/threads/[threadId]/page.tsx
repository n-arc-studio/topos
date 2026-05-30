import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSpace,
  getThread,
  getUser,
  isAdmin,
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
  const layered = view === "layers";

  const now = Date.now();
  const allPosts = listPosts(currentThread.id);
  const stats = computeStats(allPosts);

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
    return gravityScore(p, ctxOf(p));
  }

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
    const ctx = ctxOf(f.post);
    const g = gravityScore(f.post, ctx);
    const s = sedimentLevel(f.post, ctx);
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
        threadId={currentThread.id}
        depth={layered ? 0 : f.depth}
        halfLifeHours={currentSpace.gravityConfig?.halfLifeHours}
        events={listPostEvents(f.post.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <Link
          href={`/spaces/${currentSpace.id}`}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          ← {currentSpace.name}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{currentThread.title}</h1>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        {me ? (
          <>
            <PostComposer threadId={currentThread.id} canBeAnonymous={!meIsAdmin} />
            {meIsAdmin && (
              <p className="text-xs text-[var(--warn)] mt-2">
                あなたはこの場の管理者です。記名投稿のみ可能です(責任の可視化のため)。
              </p>
            )}
          </>
        ) : (
          <AuthGate message="投稿や返信にはログインが必要です。" />
        )}
      </section>

      {/* 表示モード切替 */}
      <div className="flex items-center gap-2 text-xs">
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

      {flat.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          まだ投稿はありません。最初のひとことが場をつくります。
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
                <header className="flex items-baseline gap-2 border-b border-[var(--border)] pb-1">
                  <h2 className="text-sm font-medium">{LAYER_LABEL[layer]}</h2>
                  <span className="text-xs text-[var(--muted)]">
                    {group.length} 件
                  </span>
                </header>
                <div className="space-y-2">{group.map(renderCard)}</div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="space-y-3">{flat.map(renderCard)}</section>
      )}
    </div>
  );
}
