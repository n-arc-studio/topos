import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSpace,
  getThread,
  getUser,
  isAdmin,
  listPosts,
} from "@/lib/infra/store";
import {
  computeStats,
  gravityScore,
  sedimentLevel,
} from "@/lib/domain/gravity";
import type { Post } from "@/lib/domain/types";
import { currentUser } from "@/lib/session/identity";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ spaceId: string; threadId: string }>;
}) {
  const { spaceId, threadId } = await params;
  const space = getSpace(spaceId);
  const thread = getThread(threadId);
  if (!space || !thread || thread.spaceId !== space.id) notFound();

  const me = await currentUser();
  const meIsAdmin = isAdmin(me.id, space.id);

  const now = Date.now();
  const allPosts = listPosts(thread.id);
  const stats = computeStats(allPosts);

  function scoreOf(p: Post): number {
    return gravityScore(p, now, {
      replyCount: stats.replyCountByPost[p.id] ?? 0,
      participants: stats.participantsByPost[p.id] ?? 0,
    });
  }

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

  type Flat = { post: Post; depth: number };
  const flat: Flat[] = [];
  function walk(p: Post, depth: number) {
    flat.push({ post: p, depth });
    const cs = byParent[p.id];
    if (!cs) return;
    for (const c of cs) walk(c, depth + 1);
  }
  for (const r of roots) walk(r, 0);

  return (
    <div className="space-y-6">
      <section>
        <Link
          href={`/spaces/${space.id}`}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          ← {space.name}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{thread.title}</h1>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <PostComposer threadId={thread.id} canBeAnonymous={!meIsAdmin} />
        {meIsAdmin && (
          <p className="text-xs text-[var(--warn)] mt-2">
            あなたはこの場の管理者です。記名投稿のみ可能です(責任の可視化のため)。
          </p>
        )}
      </section>

      <section className="space-y-3">
        {flat.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            まだ投稿はありません。最初のひとことが場をつくります。
          </div>
        )}
        {flat.map(({ post, depth }) => {
          const author = getUser(post.authorId);
          const displayName =
            post.identityMode === "named" && author
              ? author.displayName
              : "名無し";
          const g = scoreOf(post);
          const s = sedimentLevel(post, now, {
            replyCount: stats.replyCountByPost[post.id] ?? 0,
            participants: stats.participantsByPost[post.id] ?? 0,
          });
          return (
            <PostCard
              key={post.id}
              post={post}
              displayName={displayName}
              gravity={g}
              sediment={s}
              replyCount={stats.replyCountByPost[post.id] ?? 0}
              participants={stats.participantsByPost[post.id] ?? 0}
              meIsAdmin={meIsAdmin}
              meIsAnonymous={!meIsAdmin}
              threadId={thread.id}
              depth={depth}
            />
          );
        })}
      </section>
    </div>
  );
}
